import EmployeeProfileImageEditor from '../components/EmployeeProfileImageEditor';
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Clock3, X } from "lucide-react-native";
import { api } from "../api";
import { SelectField } from "../components/VisitFields";
import { branchChoices, branchSelectionUpdate, employeeDistrictId, type BranchChoice } from "../employee-branches";
import { useAuth } from "../auth";
import CpCustomerConversionModal from "./CpCustomerConversionModal";
import CustomerDetailsModal from "./CustomerDetailsModal";
import type { RecordValue } from "../types";
import { ActionButton, Card, ErrorNotice, Field, LoadingState } from "../ui";

function isRecord(value: unknown): value is RecordValue { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
const hiddenField = /password|token|secret|s3key|uploadId|^key$|^__v$|^_id$|^id$|^profileImage$|^failedLoginAttempts$|^lockedUntil$/i;
function label(key: string) { const references: Record<string, string> = { reportingTo: "Reporting manager", hierarchyPath: "Reporting chain", sourceCustomer: "Linked customer" }; return references[key] ?? key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()); }
function display(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string") {
    if (/^[a-f\d]{24}$/i.test(value)) return "Linked record";
    if (/^\d{4}-\d\d-\d\dT/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }
    return value;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(display).join(", ") || "—";
  if (isRecord(value)) {
    const name = [value.firstName, value.middleName, value.lastName].filter((part) => typeof part === "string" && part).join(" ");
    if (name) return [name, value.employeeCode].filter(Boolean).join(" · ");
    for (const key of ["name", "customerName", "customerCode", "employeeCode", "code"]) if (typeof value[key] === "string" && value[key]) return value[key];
    return Object.entries(value).filter(([key]) => !hiddenField.test(key)).map(([key, item]) => `${label(key)}: ${display(item)}`).join(", ") || "—";
  }
  return "—";
}
function recordId(value: unknown): string { return typeof value === "string" ? value : isRecord(value) ? String(value._id ?? value.id ?? "") : ""; }
function Details({ record, channelPartner = false }: { record: RecordValue; channelPartner?: boolean }) {
  return <>{Object.entries(record).filter(([key]) => !hiddenField.test(key)).map(([key, value]) => <View key={key} className="border-b border-brand-line dark:border-slate-700 py-3"><Text className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted dark:text-slate-400">{channelPartner && key === "employeeCode" ? "CP code" : label(key)}</Text><Text className="mt-1 text-sm leading-5 text-brand-ink dark:text-slate-100">{display(value)}</Text></View>)}</>;
}
const editFields = [{ key: "firstName", label: "First name", max: 80 }, { key: "middleName", label: "Middle name", max: 80 }, { key: "lastName", label: "Last name", max: 80 }, { key: "mobileNumber", label: "Mobile number", max: 16 }, { key: "branch", label: "Branch (optional)", max: 24 }];

export default function EmployeeDetailsModal({ employeeId, onClose, onSaved, channelPartner = false }: { employeeId: string; onClose: () => void; onSaved: () => void; channelPartner?: boolean }) {
  const { user } = useAuth();
  const roleCode = typeof user?.role === "string" ? user.role : user?.role?.code;
  const [convertCustomer, setConvertCustomer] = useState(false);
  const [customerHistory, setCustomerHistory] = useState(false);
  const [record, setRecord] = useState<RecordValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<"edit" | "manager" | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [managerId, setManagerId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [hierarchy, setHierarchy] = useState<RecordValue[] | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierarchyError, setHierarchyError] = useState("");
  const requestId = useRef(0);
  const imageRequest = useRef(0);
  const path = `/employees/${encodeURIComponent(employeeId)}`;
  const isChannelPartner = channelPartner || record?.role === "CP" || (isRecord(record?.role) && record.role.code === "CP");
  const entity = isChannelPartner ? "Channel Partner" : "Employee";
  const [branches, setBranches] = useState<BranchChoice[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchError, setBranchError] = useState("");
  const [branchReload, setBranchReload] = useState(0);
  const districtId = employeeDistrictId(record?.address);
  const currentBranch = record?.branch;
  useEffect(() => {
    if (action !== "edit") return;
    let active = true;
    setBranches(branchChoices([], currentBranch)); setBranchError("");
    if (!districtId) { setBranchesLoading(false); return; }
    setBranchesLoading(true);
    void api.get<unknown>(`/geography/districts/${encodeURIComponent(districtId)}/branches`)
      .then(result => { if (active) setBranches(branchChoices(result.data, currentBranch)); })
      .catch(cause => { if (active) setBranchError(cause instanceof Error ? cause.message : "Unable to load branches."); })
      .finally(() => { if (active) setBranchesLoading(false); });
    return () => { active = false; };
  }, [action, districtId, currentBranch, branchReload]);


  const load = useCallback(async () => {
    const current = ++requestId.current;
    const response = await api.get<unknown>(path);
    if (current !== requestId.current) return;
    if (!isRecord(response.data)) throw new Error(`No ${entity.toLowerCase()} details are available for this record.`);
    setRecord(response.data); setError("");
  }, [path, entity]);
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : `Unable to load ${entity.toLowerCase()} details.`); }
    finally { setLoading(false); }
  }, [load]);
  useEffect(() => { void reload(); return () => { requestId.current += 1; imageRequest.current += 1; }; }, [reload]);

  const loadImage = useCallback(async () => {
    const current = ++imageRequest.current;
    setImageLoading(true); setImageError(""); setImageUrl("");
    try {
      const response = await api.get<{ url?: string }>(`${path}/profile-image-url`);
      if (current !== imageRequest.current) return;
      if (!response.data?.url) throw new Error("No profile image URL was returned.");
      const url = new URL(response.data.url);
      if (!["https:", "http:"].includes(url.protocol)) throw new Error("The API returned an invalid profile image URL.");
      setImageUrl(url.toString());
    } catch (cause) { if (current === imageRequest.current) setImageError((cause as {status?: number})?.status === 404 ? "No profile image is saved. Use Change / add profile image to upload one." : cause instanceof Error ? cause.message : "Unable to load profile image."); }
    finally { if (current === imageRequest.current) setImageLoading(false); }
  }, [path]);
  const hasImage = isRecord(record?.profileImage) && Boolean(record.profileImage.key || record.profileImage.url);
  useEffect(() => { if (hasImage) void loadImage(); }, [hasImage, record?.profileImage, loadImage]);

  async function loadHierarchy() {
    setHierarchyLoading(true); setHierarchyError("");
    try {
      const response = await api.get<unknown>(`${path}/hierarchy`);
      const value = response.data;
      const list = Array.isArray(value) ? value : isRecord(value) ? value.items ?? value.data : null;
      if (!Array.isArray(list)) throw new Error("The API returned an invalid reporting hierarchy.");
      setHierarchy(list.filter(isRecord));
    } catch (cause) { setHierarchyError(cause instanceof Error ? cause.message : "Unable to load reporting hierarchy."); }
    finally { setHierarchyLoading(false); }
  }

  function openAction(next: "edit" | "manager") {
    setActionError(""); setNotice("");
    if (action === next) { setAction(null); return; }
    setAction(next);
    setManagerId(recordId(record?.reportingTo));
    setValues(Object.fromEntries(editFields.map((field) => {
      const value = record?.[field.key];
      return [field.key, field.key === "branch" ? recordId(value) : typeof value === "string" ? value : ""];
    })));
  }
  async function save() {
    if (!record || busy || (action === "edit" && branchesLoading)) return;
    setActionError(""); setNotice("");
    try {
      let payload: RecordValue = {};
      if (action === "manager") {
        const id = managerId.trim();
        if (!/^[a-f\d]{24}$/i.test(id)) throw new Error("Enter a valid 24-character reporting manager employee ID.");
        if (id.toLowerCase() === employeeId.toLowerCase()) throw new Error("An employee cannot report to themselves.");
        payload = { reportingManagerId: id };
      } else if (action === "edit") {
        for (const field of editFields) {
          const value = (values[field.key] ?? "").trim();
          const previous = field.key === "branch" ? recordId(record.branch) : String(record[field.key] ?? "");
          if (value === previous) continue;
          if (field.key === "branch") {
            Object.assign(payload, branchSelectionUpdate(record.branch, value, branches));
          } else if (field.key === "mobileNumber") {
            if (!/^\+?[1-9]\d{7,14}$/.test(value)) throw new Error("Enter a valid mobile number.");
            payload.mobileNumber = value;
          } else {
            if (value.length > 80 || (field.key !== "middleName" && !value)) throw new Error("First and last names are required; names must be 80 characters or fewer.");
            payload[field.key] = value;
          }
        }
        if (!Object.keys(payload).length) throw new Error(`Change a ${entity.toLowerCase()} field before saving.`);
      } else return;
      setBusy(true);
      await api.patch(action === "manager" ? `${path}/reporting-manager` : path, payload);
      setNotice(action === "manager" ? "Reporting manager updated." : `${entity} updated.`);
      setAction(null); onSaved();
      await load();
      if (hierarchy !== null) await loadHierarchy();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : `Unable to update ${entity.toLowerCase()}.`); }
    finally { setBusy(false); }
  }
  async function directAction(kind: "activate" | "deactivate" | "resend-invitation") {
    if (busy) return;
    setBusy(true); setActionError(""); setNotice("");
    try {
      const response = await api.post<unknown>(`${path}/${kind}`);
      setNotice(response.message || (kind === "resend-invitation" ? "Invitation request processed." : kind === "activate" ? `${entity} activated.` : `${entity} deactivated.`));
      onSaved(); await load();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "The requested action failed."); }
    finally { setBusy(false); }
  }

  return <><Modal transparent animationType="slide" visible onRequestClose={() => { if (!busy) onClose(); }}>
    <View className="flex-1 justify-end bg-black/40"><View className="max-h-[92%] rounded-t-3xl bg-brand-canvas dark:bg-slate-950 px-5 pb-8 pt-5">
      <View className="mb-4 flex-row items-center justify-between gap-3"><View className="flex-1"><Text className="text-[10px] font-bold tracking-wide text-brand-navy dark:text-indigo-200">{entity.toUpperCase()} DETAILS</Text><Text numberOfLines={2} className="mt-1 text-xl font-bold text-brand-ink dark:text-slate-100">{record ? [record.firstName, record.middleName, record.lastName].filter(Boolean).join(" ") || display(record.employeeCode) : `Loading ${entity.toLowerCase()}…`}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Close ${entity.toLowerCase()} details`} disabled={busy} onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800"><X size={19} color="#17204f" /></Pressable></View>
      <ScrollView className="max-h-[84%]" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {loading ? <LoadingState label={`Loading ${entity.toLowerCase()} details…`} /> : null}
        {error ? <ErrorNotice message={error} onRetry={() => void reload()} /> : null}
        {record && !loading ? <>
          {notice ? <View className="mb-4 rounded-xl bg-emerald-50 p-3"><Text accessibilityRole="alert" className="text-sm text-emerald-800">{notice}</Text></View> : null}
          <View className="mb-4 flex-row flex-wrap gap-2">
            <ActionButton label={action === "edit" ? "Cancel edit" : `Edit ${entity.toLowerCase()}`} disabled={busy} onPress={() => openAction("edit")} />
            <ActionButton label={action === "manager" ? "Cancel manager change" : "Change reporting manager"} kind="secondary" disabled={busy} onPress={() => openAction("manager")} />
            <ActionButton label="Activate" kind="secondary" disabled={busy || record.isActive === true} onPress={() => void directAction("activate")} />
            <ActionButton label="Deactivate" kind="secondary" disabled={busy || record.isActive === false} onPress={() => void directAction("deactivate")} />
            <ActionButton label="Resend invitation" kind="secondary" disabled={busy} onPress={() => void directAction("resend-invitation")} />
            <ActionButton label="Profile image" kind="secondary" disabled={imageLoading} onPress={() => { setImagePreviewOpen(true); void loadImage(); }} />
            <ActionButton label="Reporting hierarchy" icon={Clock3} kind="secondary" disabled={hierarchyLoading} onPress={() => void loadHierarchy()} />
          </View>
          <EmployeeProfileImageEditor key={employeeId} employeeId={employeeId} onSaved={async()=>{await load();onSaved();}}/>
          {actionError ? <ErrorNotice message={actionError} /> : null}
          {action ? <Card className="mb-4"><Text className="mb-3 text-base font-bold text-brand-ink dark:text-slate-100">{action === "edit" ? `Edit ${entity.toLowerCase()}` : "Change reporting manager"}</Text>
            {action === "edit" ? editFields.map((field) => field.key === "branch" ? <SelectField key={field.key} label={field.label} value={values.branch ?? ""} options={branches} placeholder="No branch" disabled={busy} loading={branchesLoading} onChange={(value) => setValues(current => ({ ...current, branch: value }))} /> : <Field key={field.key} label={field.label} accessibilityLabel={field.label} maxLength={field.max} editable={!busy} keyboardType={field.key === "mobileNumber" ? "phone-pad" : "default"} autoCapitalize={field.key === "branch" ? "none" : "words"} value={values[field.key] ?? ""} onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))} />) : <Field label="Reporting manager ID" accessibilityLabel="Reporting manager ID" autoCapitalize="none" maxLength={24} editable={!busy} value={managerId} onChangeText={setManagerId} />}
            {action === "edit" ? <Text className="mb-3 text-xs text-brand-muted dark:text-slate-400">{districtId ? "Branches in the current address district. Choose No branch to remove the assignment." : "No address district is available. You can keep or remove the current branch."}</Text> : null}
            {action === "edit" && branchError ? <ErrorNotice message={branchError} onRetry={() => setBranchReload(value => value + 1)} /> : null}
            <ActionButton label={busy ? "Saving…" : action === "edit" ? `Save ${entity.toLowerCase()}` : "Save reporting manager"} disabled={busy || (action === "edit" && branchesLoading)} onPress={() => void save()} />
          </Card> : null}
          {hasImage || imageUrl || imageError || imageLoading ? <Card className="mb-4"><Text className="mb-3 text-base font-bold text-brand-ink dark:text-slate-100">Profile image</Text>
            {imageLoading ? <LoadingState label="Loading profile image…" /> : null}
            {imageError ? <ErrorNotice message={imageError} onRetry={() => void loadImage()} /> : null}
            {imageUrl ? <Image accessibilityLabel={`${entity} profile image`} source={{ uri: imageUrl }} resizeMode="contain" style={{ width: "100%", height: 220, borderRadius: 12 }} onError={() => { setImageUrl(""); setImageError("The image could not be loaded. Request a fresh profile image link."); }} /> : null}
            <View className="mt-3 self-start"><ActionButton label="Refresh image" kind="secondary" disabled={imageLoading} onPress={() => void loadImage()} /></View>
          </Card> : null}
          {isChannelPartner && !recordId(record.sourceCustomer) && record.isActive !== false && ["MD", "CP_HEAD", "RM"].includes(roleCode ?? "") ? <View className="mb-4 self-start"><ActionButton label="Convert to customer" disabled={busy} onPress={() => setConvertCustomer(true)}/></View> : null}
          {recordId(record.sourceCustomer) ? <View className="mb-4 self-start"><ActionButton label="Customer history" kind="secondary" onPress={() => setCustomerHistory(true)}/></View> : null}
          <Card className="mb-4"><Text className="mb-1 text-base font-bold text-brand-ink dark:text-slate-100">{entity} information</Text><Details record={record} channelPartner={isChannelPartner} /></Card>
          {hierarchyLoading || hierarchyError || hierarchy !== null ? <Card className="mb-4"><Text className="mb-3 text-base font-bold text-brand-ink dark:text-slate-100">Reporting hierarchy</Text>
            {hierarchyError ? <ErrorNotice message={hierarchyError} onRetry={() => void loadHierarchy()} /> : null}
            {hierarchyLoading ? <LoadingState label="Loading reporting hierarchy…" /> : hierarchy?.length ? hierarchy.map((employee, index) => <View key={String(employee._id ?? index)} className="mb-3 rounded-xl border border-brand-line dark:border-slate-700 p-3"><Text className="text-sm font-bold text-brand-ink dark:text-slate-100">{index + 1}. {display(employee)}</Text><Details record={employee} /></View>) : !hierarchyError ? <Text className="text-sm text-brand-muted dark:text-slate-400">No reporting hierarchy is available.</Text> : null}
          </Card> : null}
        </> : null}
      </ScrollView>
    </View></View>
  <Modal transparent animationType="fade" visible={imagePreviewOpen} onRequestClose={() => setImagePreviewOpen(false)}>
    <View className="flex-1 justify-center bg-black/60 p-5"><View className="rounded-2xl bg-white dark:bg-slate-800 p-5">
      <View className="mb-4 flex-row items-center justify-between"><Text className="text-lg font-bold text-brand-ink dark:text-slate-100">Profile image</Text><Pressable accessibilityRole="button" accessibilityLabel="Close profile image" onPress={() => setImagePreviewOpen(false)} className="p-2"><X size={22}/></Pressable></View>
      {imageLoading ? <LoadingState label="Loading profile image..."/> : null}
      {imageError ? <ErrorNotice message={imageError} onRetry={() => void loadImage()}/> : null}
      {imageUrl ? <Image accessibilityLabel={`${entity} profile image`} source={{uri:imageUrl}} resizeMode="contain" style={{width:"100%",height:300}} onError={() => {setImageUrl("");setImageError("The saved photo could not be loaded. Retry, or replace it using Change / add profile image.");}}/> : null}
      <View className="mt-4"><ActionButton label="Refresh image" kind="secondary" disabled={imageLoading} onPress={() => void loadImage()}/></View>
    </View></View>
  </Modal>
  {convertCustomer ? <CpCustomerConversionModal cpId={employeeId} onClose={() => setConvertCustomer(false)} onSaved={() => { setConvertCustomer(false); setNotice("Customer created and linked to this channel partner."); onSaved(); void reload(); }}/> : null}
  {customerHistory && recordId(record?.sourceCustomer) ? <CustomerDetailsModal customerId={recordId(record?.sourceCustomer)} onClose={() => setCustomerHistory(false)} onSaved={() => { void load(); }}/> : null}
</Modal>
  
  </>;
}
