import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { Image, Linking, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Download, ExternalLink, Eye, ShieldCheck, X } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import { api } from "../api";
import { useAuth } from "../auth";
import CustomerCpConversionModal from "./CustomerCpConversionModal";
import { SelectField } from "../components/VisitFields";
import type { RecordValue } from "../types";
import { ActionButton, Card, ErrorNotice, Field, LoadingState } from "../ui";

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function label(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

function readable(value: unknown) {
  return typeof value === "string" ? value.replace(/_/g, " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase()) : "Unknown";
}

const hiddenField = /password|token|secret|s3key|uploadId|^key$|^__v$|^_id$|^id$/i;

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
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(display).join(", ") || "—";
  if (isRecord(value)) {
    if (typeof value.$numberDecimal === "string") return value.$numberDecimal;
    const person = [value.firstName, value.lastName].filter((part) => typeof part === "string" && part).join(" ");
    if (person) return [person, value.employeeCode].filter(Boolean).join(" · ");
    for (const key of ["name", "customerName", "leadCode", "employeeCode", "customerCode", "code"]) {
      if (typeof value[key] === "string" && value[key]) return value[key];
    }
    return Object.entries(value).filter(([key]) => !hiddenField.test(key)).map(([key, part]) => `${label(key)}: ${display(part)}`).join(", ") || "—";
  }
  return "—";
}

function Details({ record }: { record: RecordValue }) {
  return <>{Object.entries(record).filter(([key]) => !hiddenField.test(key) && !(record.isFixedRate && key === "ratePerKW")).map(([key, value]) => (
    <View key={key} className="border-b border-brand-line dark:border-slate-700 py-3">
      <Text className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted dark:text-slate-400">{label(key)}</Text>
      <Text className="mt-1 text-sm leading-5 text-brand-ink dark:text-slate-100">{display(value)}</Text>
    </View>
  ))}</>;
}

const editFields = [
  { key: "customerName", label: "Customer name", maxLength: 160 },
  { key: "mobileNumber", label: "Mobile number", maxLength: 16 },
  { key: "alternateNumber", label: "Alternate number", maxLength: 16 },
  { key: "siteAddress", label: "Site address", maxLength: 1000, multiline: true },
  { key: "blockOrTehsil", label: "Block / tehsil", maxLength: 120 },
  { key: "requiredCapacityKW", label: "Capacity (kW)", numeric: true },
  { key: "ratePerKW", label: "Rate per kW", numeric: true },
  { key: "paymentMode", label: "Payment mode", maxLength: 100 },
  { key: "panelBrand", label: "Panel brand", maxLength: 100 },
  { key: "panelTechnology", label: "Panel technology", maxLength: 100 },
];
const statuses = ["ONBOARDING", "ACTIVE", "COMPLETED", "CANCELLED"];
const documentTypes = ["PAN", "AADHAAR", "ELECTRICITY_BILL", "BANK_PASSBOOK", "GEO_TAG_PHOTO"];
type DocumentPreview = { documentId: string; url: string; contentType: string; fileName: string };

function editValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return isRecord(value) && typeof value.$numberDecimal === "string" ? value.$numberDecimal : "";
}

function documentUrl(value: unknown): string {
  if (typeof value !== "string") throw new Error("The API did not return a document URL.");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("The document URL must use HTTP or HTTPS.");
  return url.toString();
}

export default function CustomerDetailsModal({ customerId, onClose, onSaved }: {
  customerId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const roleCode = typeof user?.role === "string" ? user.role : user?.role?.code;
  const [convertCp, setConvertCp] = useState(false);
  const [record, setRecord] = useState<RecordValue | null>(null);
  const [context, setContext] = useState<RecordValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [documentBusy, setDocumentBusy] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [rejectId, setRejectId] = useState("");
  const [rejectRemark, setRejectRemark] = useState("");
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [download, setDownload] = useState<{ documentId: string; url: string } | null>(null);
  const [documents, setDocuments] = useState<RecordValue[] | null>(null);
  const [documentType, setDocumentType] = useState("");
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const requestId = useRef(0);
  const path = `/customers/${encodeURIComponent(customerId)}`;

  const load = useCallback(async () => {
    const current = ++requestId.current;
    const response = await api.get<unknown>(path);
    if (current !== requestId.current) return;
    if (!isRecord(response.data)) throw new Error("The API returned invalid customer details.");
    const nested = "customer" in response.data;
    const customer = nested ? response.data.customer : response.data;
    if (!isRecord(customer)) throw new Error("No customer details are available for this record.");
    setRecord(customer);
    setContext(nested ? response.data : { customer });
    setError("");
  }, [path]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try { await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load customer details."); }
    finally { setLoading(false); }
  }, [load]);

  useEffect(() => {
    void reload();
    return () => { requestId.current += 1; };
  }, [reload]);

  const rows = (key: string): RecordValue[] => key === "documents" && documents !== null ? documents : Array.isArray(context?.[key]) ? context[key].filter(isRecord) : [];

  async function loadDocuments() {
    const response = await api.get<unknown>(`${path}/documents`);
    const data = response.data;
    const list = Array.isArray(data) ? data : isRecord(data) ? data.items ?? data.data ?? data.documents : null;
    if (!Array.isArray(list)) throw new Error("The API returned an invalid document list.");
    setDocuments(list.filter(isRecord));
  }

  async function refreshDocuments() {
    setDocumentBusy(true);
    setDocumentError("");
    try { await loadDocuments(); }
    catch (cause) { setDocumentError(cause instanceof Error ? cause.message : "Unable to load customer documents."); }
    finally { setDocumentBusy(false); }
  }

  async function pickFile() {
    setUploadError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png", "image/webp"], copyToCacheDirectory: true, multiple: false });
      if (!result.canceled && result.assets[0]) setFile(result.assets[0]);
    } catch (cause) { setUploadError(cause instanceof Error ? cause.message : "Unable to select document."); }
  }

  async function uploadDocument() {
    if (uploadBusy) return;
    setUploadError("");
    setNotice("");
    try {
      if (!documentTypes.includes(documentType)) throw new Error("Choose a document type.");
      if (!file) throw new Error("Choose a customer document to upload.");
      const mimeType = file.mimeType ?? "";
      if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType) || !file.size || file.size > 20 * 1024 * 1024) throw new Error("Choose a PDF, JPEG, PNG, or WebP file no larger than 20 MB.");
      setUploadBusy(true);
      const content = file.file ? await file.file.arrayBuffer() : await (await fetch(file.uri)).arrayBuffer();
      if (!content.byteLength || content.byteLength > 20 * 1024 * 1024) throw new Error("Choose a nonempty document no larger than 20 MB.");
      const reservation = await api.post<{ uploadId: string; uploadUrl: string }>(`${path}/documents/upload-url`, { documentType, fileName: file.name, mimeType, fileSize: content.byteLength });
      if (!reservation.data?.uploadId || !reservation.data.uploadUrl) throw new Error("The API did not return a valid upload reservation.");
      await api.putBinary(`${path}/documents/${encodeURIComponent(reservation.data.uploadId)}/upload`, content, mimeType);
      await api.post(`${path}/documents/complete`, { uploadId: reservation.data.uploadId });
      setFile(null);
      setDocumentType("");
      setNotice("Document uploaded.");
      onSaved();
      await load();
      await loadDocuments();
    } catch (cause) { setUploadError(cause instanceof Error ? cause.message : "Document upload failed."); }
    finally { setUploadBusy(false); }
  }

  function startEdit() {
    if (!record) return;
    setValues(Object.fromEntries([...editFields.map((field) => field.key), "status"].map((key) => [key, editValue(record[key])])));
    setActionError("");
    setNotice("");
    setEditing(true);
  }

  async function save() {
    if (!record || busy) return;
    setActionError("");
    try {
      const payload: RecordValue = {};
      for (const field of editFields) {
        const value = (values[field.key] ?? "").trim();
        if (value === editValue(record[field.key])) continue;
        if (field.numeric) {
          const number = Number(value);
          const capacity = field.key === "requiredCapacityKW";
          if (!value || !Number.isFinite(number) || (capacity ? number <= 0 || number > 100000 : number < 0 || number > 100000000)) throw new Error(capacity ? "Enter a capacity greater than 0 and up to 100,000 kW." : "Enter a rate from 0 to 100,000,000 per kW.");
          payload[field.key] = number;
        } else {
          const minimum = field.key === "customerName" || field.key === "paymentMode" ? 2 : field.key === "siteAddress" ? 3 : ["alternateNumber", "blockOrTehsil"].includes(field.key) ? 0 : 1;
          if (value.length < minimum || (field.maxLength && value.length > field.maxLength)) throw new Error(`Enter a valid ${field.label.toLowerCase()}.`);
          if ((field.key === "mobileNumber" || (field.key === "alternateNumber" && value)) && !/^\+?[0-9]{10,15}$/.test(value)) throw new Error(`Enter a valid ${field.label.toLowerCase()} (10–15 digits).`);
          payload[field.key] = value;
        }
      }
      if (values.status !== editValue(record.status)) {
        if (!statuses.includes(values.status)) throw new Error("Choose a valid customer status.");
        payload.status = values.status;
      }
      if (!Object.keys(payload).length) throw new Error("Change a customer field before saving.");
      setBusy(true);
      await api.patch(path, payload);
      setEditing(false);
      setNotice("Customer updated.");
      onSaved();
      await load();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Unable to update customer."); }
    finally { setBusy(false); }
  }

  async function documentAction(document: RecordValue, action: "preview" | "download" | "verify" | "reject" | "mis-verify" | "mis-pending") {
    if (documentBusy) return;
    const documentId = String(document._id ?? document.id ?? "");
    setDocumentError("");
    if (!documentId) { setDocumentError("The document ID is missing from the API response."); return; }
    if (action === "preview" && preview?.documentId === documentId) { setPreview(null); return; }
    if ((action === "verify" || action === "reject") && document.verificationStatus !== "PENDING") return;
    if ((action === "reject" || action === "mis-pending") && !rejectRemark.trim()) { setDocumentError("Enter a rejection reason."); return; }
    setDocumentBusy(true);
    try {
      const documentPath = `${path}/documents/${encodeURIComponent(documentId)}`;
      if (action === "mis-verify" || action === "mis-pending") {
        await api.patch(`${documentPath}/mis-verification`, action === "mis-verify" ? { status: "VERIFIED" } : { status: "PENDING", remark: rejectRemark.trim() });
        setRejectId(""); setRejectRemark(""); setNotice(action === "mis-verify" ? "MIS verification saved." : "Document marked pending with your remark.");
        onSaved(); await load(); if (documents !== null) await loadDocuments();
      } else if (action === "verify" || action === "reject") {
        await api.patch(`${documentPath}/verification`, action === "verify" ? { status: "VERIFIED" } : { status: "REJECTED", remark: rejectRemark.trim() });
        setRejectId(""); setRejectRemark("");
        setNotice(action === "verify" ? "Document verified." : "Document rejected and sent back to the channel partner.");
        onSaved();
        await load();
        if (documents !== null) await loadDocuments();
      } else {
        const response = await api.get<{ url?: string; contentType?: string }>(`${documentPath}/${action === "preview" ? "preview-url" : "download-url"}`);
        const url = documentUrl(response.data?.url);
        if (action === "preview") {
          if (!response.data.contentType) throw new Error("The API did not return a document preview type.");
          setPreview({ documentId, url, contentType: response.data.contentType, fileName: String(document.fileName ?? "Customer document") });
        } else setDownload({ documentId, url });
      }
    } catch (cause) { setDocumentError(cause instanceof Error ? cause.message : "Unable to complete the document action."); }
    finally { setDocumentBusy(false); }
  }

  async function openUrl(url: string) {
    try { await Linking.openURL(documentUrl(url)); }
    catch (cause) { setDocumentError(cause instanceof Error ? cause.message : "Unable to open document."); }
  }

  return (
    <>
    <Modal transparent animationType="slide" visible onRequestClose={() => { if (!busy && !documentBusy && !uploadBusy) onClose(); }}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[92%] rounded-t-3xl bg-brand-canvas dark:bg-slate-950 px-5 pb-8 pt-5">
          <View className="mb-4 flex-row items-center justify-between gap-3">
            <View className="flex-1"><Text className="text-[10px] font-bold tracking-wide text-brand-navy dark:text-indigo-200">CUSTOMER DETAILS</Text><Text numberOfLines={2} className="mt-1 text-xl font-bold text-brand-ink dark:text-slate-100">{record ? display(record.customerName) : "Loading customer…"}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close customer details" disabled={busy || documentBusy || uploadBusy} onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800"><X size={19} color="#17204f" /></Pressable>
          </View>
          <ScrollView className="max-h-[84%]" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {loading ? <LoadingState label="Loading customer details…" /> : null}
            {error ? <ErrorNotice message={error} onRetry={() => void reload()} /> : null}
            {record && !loading ? <>
              {notice ? <View className="mb-4 rounded-xl bg-emerald-50 p-3"><Text accessibilityRole="alert" className="text-sm text-emerald-800">{notice}</Text></View> : null}
              <View className="mb-4 self-start"><ActionButton label={editing ? "Cancel edit" : "Edit customer"} kind={editing ? "secondary" : "primary"} disabled={busy || documentBusy || uploadBusy} onPress={() => { if (editing) { setEditing(false); setActionError(""); } else startEdit(); }} /></View>
              {["MD", "CP_HEAD", "RM"].includes(roleCode ?? "") ? <View className="mb-4 self-start"><ActionButton label={record.cpEmployee ? "CP account created" : "Convert to CP"} disabled={Boolean(record.cpEmployee) || busy || documentBusy || uploadBusy} onPress={() => setConvertCp(true)}/></View> : null}
              {["quotations", "amcContracts"].map(key => <Card key={key} className="mb-4"><Text className="mb-2 text-base font-bold text-brand-ink dark:text-slate-100">{key === "quotations" ? "Quotation history" : "AMC history"}</Text>{rows(key).length ? rows(key).map((item, index) => <View key={String(item._id ?? index)} className="mb-2"><Details record={item}/></View>) : <Text className="text-xs text-brand-muted dark:text-slate-400">No records yet.</Text>}</Card>)}
              {actionError ? <ErrorNotice message={actionError} /> : null}
              {editing ? <Card className="mb-4">
                <Text className="mb-3 text-base font-bold text-brand-ink dark:text-slate-100">Edit customer</Text>
                {editFields.map((field) => <Field key={field.key} accessibilityLabel={field.label} label={field.key === "ratePerKW" && record?.isFixedRate ? "Rate" : field.label} value={values[field.key] ?? ""} editable={!busy} keyboardType={field.numeric ? "decimal-pad" : field.key.includes("Number") ? "phone-pad" : "default"} maxLength={field.maxLength} multiline={field.multiline} numberOfLines={field.multiline ? 3 : 1} onChangeText={(text) => setValues((current) => ({ ...current, [field.key]: text }))} />)}
                <SelectField label="Status" value={values.status ?? ""} options={statuses.map((status) => ({ value: status, label: status }))} placeholder="Choose status" disabled={busy} onChange={(status) => setValues((current) => ({ ...current, status }))} />
                <ActionButton label={busy ? "Saving…" : "Save customer"} disabled={busy} onPress={() => void save()} />
              </Card> : null}
              <Card className="mb-4"><Text className="mb-1 text-base font-bold text-brand-ink dark:text-slate-100">Customer information</Text><Details record={record} /></Card>
              {context ? <>
                {isRecord(context.sourceLead) ? <Card className="mb-4"><Text className="mb-1 text-base font-bold text-brand-ink dark:text-slate-100">Source lead</Text><Details record={Object.fromEntries(["leadCode", "status", "customerName", "mobileNumber", "siteAddress"].filter((key) => isRecord(context.sourceLead) && context.sourceLead[key] != null && context.sourceLead[key] !== "").map((key) => [key, key === "status" ? readable((context.sourceLead as RecordValue)[key]) : (context.sourceLead as RecordValue)[key]]))} /></Card> : null}
                <Card className="mb-4">
                  <Text className="mb-3 text-base font-bold text-brand-ink dark:text-slate-100">Documents</Text>
                  <View className="mb-3 self-start"><ActionButton label="Customer documents" kind="secondary" disabled={busy || documentBusy || uploadBusy} onPress={() => void refreshDocuments()} /></View>
                  {documentError ? <ErrorNotice message={documentError} /> : null}
                  {documentBusy ? <Text accessibilityRole="alert" className="mb-3 text-xs text-brand-muted dark:text-slate-400">Processing document…</Text> : null}
                  {rows("documents").length ? rows("documents").map((document, index) => {
                    const documentId = String(document._id ?? document.id ?? index);
                    return <View key={documentId} className="mb-3 rounded-xl border border-brand-line dark:border-slate-700 p-3">
                      <Text className="text-sm font-bold text-brand-ink dark:text-slate-100">{readable(document.documentType)}</Text>
                      <Text className="mt-1 text-xs leading-5 text-brand-muted dark:text-slate-400">{String(document.fileName ?? "File name unavailable")} · {readable(document.verificationStatus)}</Text>
                      <Text className="mt-1 text-xs leading-5 text-brand-muted dark:text-slate-400">Uploaded {display(document.uploadedAt)}{isRecord(document.uploadedBy) ? ` · By ${display(document.uploadedBy)}` : ""}</Text>
                      {document.verifiedAt ? <Text className="mt-1 text-xs leading-5 text-brand-muted dark:text-slate-400">Verified {display(document.verifiedAt)}{isRecord(document.verifiedBy) ? ` · By ${display(document.verifiedBy)}` : ""}</Text> : null}
                      {typeof document.verificationRemark === "string" && document.verificationRemark ? <Text className="mt-1 text-xs text-brand-ink dark:text-slate-100">Note: {document.verificationRemark}</Text> : null}
                      {roleCode === "MIS" ? <Text className="mt-1 text-xs text-brand-muted dark:text-slate-400">MIS: {readable(document.misVerificationStatus ?? "PENDING")}{typeof document.misVerificationRemark === "string" && document.misVerificationRemark ? ` - ${document.misVerificationRemark}` : ""}</Text> : null}
                      <View className="mt-3 flex-row flex-wrap gap-2">
                        <ActionButton label={preview?.documentId === documentId ? "Hide preview" : "Preview"} icon={Eye} kind="secondary" disabled={busy || documentBusy || uploadBusy} onPress={() => void documentAction(document, "preview")} />
                        <ActionButton label="Download" icon={Download} kind="secondary" disabled={busy || documentBusy || uploadBusy} onPress={() => void documentAction(document, "download")} />
                        {roleCode === "MIS" && document.verificationStatus === "VERIFIED" && String(rows("documents").find(item => item.documentType === document.documentType)?._id ?? "") === documentId ? <><Pressable accessibilityRole="button" accessibilityState={{ selected: document.misVerificationStatus === "VERIFIED", disabled: documentBusy || document.misVerificationStatus === "VERIFIED" }} disabled={documentBusy || document.misVerificationStatus === "VERIFIED"} onPress={() => void documentAction(document, "mis-verify")} className="min-h-11 justify-center rounded-xl border border-brand-line px-4" style={document.misVerificationStatus === "VERIFIED" ? { backgroundColor: "#15803d", borderColor: "#15803d" } : undefined}><Text className={document.misVerificationStatus === "VERIFIED" ? "text-sm font-bold text-white" : "text-sm font-bold text-brand-ink dark:text-slate-100"}>{document.misVerificationStatus === "VERIFIED" ? "Verified" : "MIS verify"}</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ selected: document.misVerificationStatus !== "VERIFIED" && Boolean(document.misVerificationRemark), disabled: documentBusy }} disabled={documentBusy} onPress={() => { setRejectId(documentId); setRejectRemark(""); }} className="min-h-11 justify-center rounded-xl border border-brand-line px-4" style={document.misVerificationStatus !== "VERIFIED" && document.misVerificationRemark ? { backgroundColor: "#b91c1c", borderColor: "#b91c1c" } : undefined}><Text className={document.misVerificationStatus !== "VERIFIED" && document.misVerificationRemark ? "text-sm font-bold text-white" : "text-sm font-bold text-brand-ink dark:text-slate-100"}>{document.misVerificationStatus !== "VERIFIED" && document.misVerificationRemark ? "Pending" : "Mark pending"}</Text></Pressable></> : null}
                        {(record.reviewCp ? roleCode === "RM" : roleCode !== "CP" && roleCode !== "MIS") && document.verificationStatus === "PENDING" ? <><ActionButton label="Verify" icon={ShieldCheck} kind="secondary" disabled={busy || documentBusy || uploadBusy} onPress={() => void documentAction(document, "verify")} /><ActionButton label="Reject" kind="secondary" disabled={busy || documentBusy || uploadBusy} onPress={() => { setRejectId(documentId); setRejectRemark(""); }}/></> : null}
                      </View>
                      {rejectId === documentId ? <View className="mt-3"><Field label={roleCode === "MIS" ? "Issue with this file" : "Rejection reason"} value={rejectRemark} maxLength={1000} multiline onChangeText={setRejectRemark}/><ActionButton label={roleCode === "MIS" ? "Save pending remark" : "Send rejection"} disabled={documentBusy || !rejectRemark.trim()} onPress={() => void documentAction(document, roleCode === "MIS" ? "mis-pending" : "reject")}/></View> : null}
                      {preview?.documentId === documentId ? <View className="mt-3">
                        {preview.contentType.startsWith("image/") ? <Image accessibilityLabel={preview.fileName} source={{ uri: preview.url }} resizeMode="contain" style={{ width: "100%", height: 300 }} onError={() => { setDocumentError("The preview could not be loaded. Try requesting a new preview."); setPreview(null); }} />
                          : preview.contentType === "application/pdf" && Platform.OS === "web" ? createElement("iframe", { title: preview.fileName, src: preview.url, style: { width: "100%", height: 400, border: 0 } }) : null}
                        <View className="mt-2"><ActionButton label={preview.contentType === "application/pdf" ? "Open PDF preview" : "Open document preview"} icon={ExternalLink} kind="secondary" onPress={() => void openUrl(preview.url)} /></View>
                      </View> : null}
                      {download?.documentId === documentId ? <View className="mt-3"><ActionButton label="Open download" icon={ExternalLink} onPress={() => void openUrl(download.url)} /></View> : null}
                    </View>;
                  }) : <Text className="text-sm text-brand-muted dark:text-slate-400">No customer documents have been uploaded.</Text>}
                </Card>
                {!record.reviewCp || roleCode === "CP" ? <Card className="mb-4">
                  <Text className="mb-3 text-base font-bold text-brand-ink dark:text-slate-100">{record.reviewCp ? "Replace rejected document" : "Upload customer document"}</Text>
                  <SelectField label="Document type" value={documentType} options={documentTypes.filter(value => !record.reviewCp || (Array.isArray(record.reviewRequiredTypes) && record.reviewRequiredTypes.includes(value) && (!rows("documents").find(doc => doc.documentType === value) || rows("documents").find(doc => doc.documentType === value)?.verificationStatus === "REJECTED"))).map((value) => ({ value, label: readable(value) }))} placeholder="Choose document type" disabled={busy || documentBusy || uploadBusy} onChange={setDocumentType} />
                  <Text className="mb-2 text-xs text-brand-muted dark:text-slate-400">File (PDF or image, max 20 MB)</Text>
                  <ActionButton label={file ? "Change file" : "Choose file"} kind="secondary" disabled={busy || documentBusy || uploadBusy} onPress={() => void pickFile()} />
                  {file ? <Text className="mt-2 text-xs text-brand-ink dark:text-slate-100">{file.name}</Text> : null}
                  {uploadError ? <View className="mt-3"><ErrorNotice message={uploadError} /></View> : null}
                  <View className="mt-3"><ActionButton label={uploadBusy ? "Uploading…" : "Upload document"} disabled={busy || documentBusy || uploadBusy} onPress={() => void uploadDocument()} /></View>
                </Card> : null}
                <Card className="mb-4"><Text className="mb-2 text-base font-bold text-brand-ink dark:text-slate-100">Lead status history</Text>
                  {rows("leadStatusHistory").length ? rows("leadStatusHistory").map((entry, index) => <View key={String(entry._id ?? index)} className="border-b border-brand-line dark:border-slate-700 py-3">
                    <Text className="text-sm font-bold text-brand-ink dark:text-slate-100">{readable(entry.previousStatus)} → {readable(entry.newStatus)}</Text>
                    <Text className="mt-1 text-xs leading-5 text-brand-muted dark:text-slate-400">{display(entry.changedAt)}{isRecord(entry.changedBy) ? ` · Updated by ${display(entry.changedBy)}` : ""}</Text>
                    {typeof entry.remark === "string" ? <Text className="mt-1 text-sm text-brand-ink dark:text-slate-100">Note: {entry.remark}</Text> : null}
                    {entry.nextFollowUpDate ? <Text className="mt-1 text-xs text-brand-muted dark:text-slate-400">Next follow-up: {display(entry.nextFollowUpDate)}</Text> : null}
                  </View>) : <Text className="text-sm text-brand-muted dark:text-slate-400">No lead status history is available.</Text>}
                </Card>
                <Card className="mb-4"><Text className="mb-2 text-base font-bold text-brand-ink dark:text-slate-100">Site visits</Text>
                  {rows("visits").length ? rows("visits").map((visit, index) => <View key={String(visit._id ?? index)} className="border-b border-brand-line dark:border-slate-700 py-3">
                    <Text className="text-sm font-bold text-brand-ink dark:text-slate-100">Visit · {display(visit.visitDate)}</Text>
                    {typeof visit.remark === "string" ? <Text className="mt-1 text-sm text-brand-ink dark:text-slate-100">Note: {visit.remark}</Text> : null}
                    {visit.nextVisitDate ? <Text className="mt-1 text-xs text-brand-muted dark:text-slate-400">Next visit: {display(visit.nextVisitDate)}</Text> : null}
                    {isRecord(visit.visitedBy) ? <Text className="mt-1 text-xs text-brand-muted dark:text-slate-400">Visited by {display(visit.visitedBy)}</Text> : null}
                  </View>) : <Text className="text-sm text-brand-muted dark:text-slate-400">No site visits are recorded.</Text>}
                </Card>
                <Card className="mb-4"><Text className="mb-2 text-base font-bold text-brand-ink dark:text-slate-100">Customer activity</Text>
                  {rows("activities").length ? rows("activities").map((activity, index) => <View key={String(activity._id ?? index)} className="border-b border-brand-line dark:border-slate-700 py-3">
                    <Text className="text-sm font-bold text-brand-ink dark:text-slate-100">{readable(activity.action)}</Text>
                    <Text className="mt-1 text-xs text-brand-muted dark:text-slate-400">{display(activity.occurredAt)}{isRecord(activity.actor) ? ` · By ${display(activity.actor)}` : ""}</Text>
                    {typeof activity.description === "string" ? <Text className="mt-1 text-sm leading-5 text-brand-ink dark:text-slate-100">{activity.description}</Text> : null}
                  </View>) : <Text className="text-sm text-brand-muted dark:text-slate-400">No customer activity is recorded.</Text>}
                </Card>
              </> : null}
            </> : null}
          </ScrollView>
        </View>
      </View>
    {convertCp ? <CustomerCpConversionModal customerId={customerId} onClose={() => setConvertCp(false)} onSaved={(sent, already) => { setConvertCp(false); setNotice(already ? "This customer already has a CP account." : sent ? "CP account created. Password-setup invitation sent." : "CP account created. Invitation was not delivered; use Employees to resend it."); void load().then(onSaved).catch(cause => setActionError(cause instanceof Error ? cause.message : "Unable to refresh customer")); }}/> : null}
</Modal>
    
    </>
  );
}
