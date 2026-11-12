import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Pencil, Plus, X } from "lucide-react-native";
import { api } from "../api";
import { useAuth } from "../auth";
import { SelectField } from "../components/VisitFields";
import { ActionButton, Card, ErrorNotice, Field, Heading, LoadingState, Page, RefreshAction } from "../ui";

type Level = "states" | "districts" | "branches";
type Location = { _id: string; name: string; code?: string; isActive?: boolean; address?: string; state?: unknown; district?: unknown };
const emptyRows: Location[] = [];
const titles: Record<Level, string> = { states: "States", districts: "Districts", branches: "Branches" };
const singular: Record<Level, string> = { states: "state", districts: "district", branches: "branch" };

function list(value: unknown): Location[] {
  const rows = Array.isArray(value) ? value : value && typeof value === "object" && "data" in value ? value.data : null;
  if (!Array.isArray(rows)) throw new Error("The API returned an invalid geography list.");
  return rows.filter((item): item is Location => Boolean(item) && typeof item === "object" && typeof item._id === "string" && typeof item.name === "string");
}

// Keep each response attached to its parent path so a late response cannot replace another location's records.
function useLocations(path: string | null) {
  const [result, setResult] = useState<{ path: string | null; rows: Location[]; loading: boolean; loaded: boolean; error: string }>({ path: null, rows: emptyRows, loading: false, loaded: false, error: "" });
  const requestId = useRef(0);
  const reload = useCallback(async () => {
    const current = ++requestId.current;
    if (!path) { setResult({ path, rows: emptyRows, loading: false, loaded: true, error: "" }); return; }
    setResult((previous) => ({ path, rows: previous.path === path ? previous.rows : emptyRows, loading: true, loaded: false, error: "" }));
    try {
      const response = await api.get<unknown>(path);
      if (current !== requestId.current) return;
      setResult({ path, rows: list(response.data), loading: false, loaded: true, error: "" });
    } catch (cause) {
      if (current === requestId.current) setResult({ path, rows: emptyRows, loading: false, loaded: true, error: cause instanceof Error ? cause.message : "Unable to load geography." });
    }
  }, [path]);
  useEffect(() => { void reload(); return () => { requestId.current += 1; }; }, [reload]);
  const matches = result.path === path;
  return { rows: matches ? result.rows : emptyRows, loading: Boolean(path) && (!matches || result.loading), loaded: matches && result.loaded, error: matches ? result.error : "", reload };
}

type Editor = { level: Level; record: Location | null };
function GeographyEditor({ editor, states, stateId, districtId, onClose, onSaved }: {
  editor: Editor; states: Location[]; stateId: string; districtId: string;
  onClose: () => void;
  onSaved: (editor: Editor, parentState: string, parentDistrict: string) => void;
}) {
  const { level, record } = editor;
  const [name, setName] = useState(record?.name ?? "");
  const [code, setCode] = useState(record?.code ?? "");
  const [address, setAddress] = useState(record?.address ?? "");
  const [isActive, setIsActive] = useState(record?.isActive !== false ? "true" : "false");
  const [parentState, setParentState] = useState(stateId || states[0]?._id || "");
  const [parentDistrict, setParentDistrict] = useState(level === "branches" ? districtId : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const districts = useLocations(!record && level === "branches" && parentState ? `/geography/states/${encodeURIComponent(parentState)}/districts` : null);

  useEffect(() => {
    if (districts.loaded && parentDistrict && !districts.rows.some((district) => district._id === parentDistrict)) setParentDistrict("");
  }, [districts.loaded, districts.rows, parentDistrict]);

  async function save() {
    if (busy) return;
    setError("");
    try {
      const trimmedName = name.trim();
      const trimmedCode = code.trim().toUpperCase();
      if (trimmedName.length < 2 || trimmedName.length > 100) throw new Error("Name must be 2–100 characters.");
      if (level === "states" && trimmedCode && !/^[A-Z0-9_-]{1,12}$/.test(trimmedCode)) throw new Error("State code must use 1–12 letters, numbers, hyphens, or underscores.");
      if (level === "branches" && !/^[A-Z0-9_-]{1,30}$/.test(trimmedCode)) throw new Error("Branch code is required (1–30 letters, numbers, hyphens, or underscores).");
      if (level === "branches" && address.trim().length > 500) throw new Error("Branch address must be 500 characters or fewer.");
      if (!record && level !== "states" && !states.some((state) => state._id === parentState)) throw new Error("Choose a parent state.");
      if (!record && level === "branches" && !districts.rows.some((district) => district._id === parentDistrict)) throw new Error("Choose a district belonging to the selected state.");
      const payload: Record<string, unknown> = { name: trimmedName, isActive: isActive === "true" };
      if (level === "states" && (record || trimmedCode)) payload.code = trimmedCode;
      if (level === "branches") { payload.code = trimmedCode; payload.address = address.trim(); }
      if (!record && level !== "states") payload.state = parentState;
      if (!record && level === "branches") payload.district = parentDistrict;
      setBusy(true);
      if (record) await api.patch(`/geography/${level}/${encodeURIComponent(record._id)}`, payload);
      else await api.post(`/geography/${level}`, payload);
      onSaved(editor, parentState, parentDistrict);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save geography record."); }
    finally { setBusy(false); }
  }

  return <Modal transparent animationType="slide" visible onRequestClose={() => { if (!busy) onClose(); }}>
    <View className="flex-1 justify-end bg-black/40"><View className="max-h-[92%] rounded-t-3xl bg-brand-canvas px-5 pb-8 pt-5">
      <View className="mb-4 flex-row items-center justify-between"><View><Text className="text-[10px] font-bold tracking-wide text-brand-navy">ORGANIZATION SETUP</Text><Text className="mt-1 text-xl font-bold text-brand-ink">{record ? "Edit" : "Add"} {singular[level]}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close geography form" disabled={busy} onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-white"><X size={19} color="#17204f" /></Pressable></View>
      <ScrollView className="max-h-[78%]" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Field label="Name" accessibilityLabel="Name" value={name} onChangeText={setName} maxLength={100} editable={!busy} />
        {level !== "districts" ? <Field label={level === "states" ? "Code (optional)" : "Code"} accessibilityLabel="Code" value={code} onChangeText={setCode} maxLength={level === "states" ? 12 : 30} autoCapitalize="characters" editable={!busy} /> : null}
        {!record && level !== "states" ? <SelectField label="Parent state" value={parentState} options={states.map((state) => ({ value: state._id, label: state.name }))} placeholder="Choose state" disabled={busy} onChange={(value) => { setParentState(value); setParentDistrict(""); }} /> : null}
        {!record && level === "branches" ? <>
          <SelectField label="Parent district" value={parentDistrict} options={districts.rows.map((district) => ({ value: district._id, label: district.name }))} placeholder={parentState ? "Choose district" : "Choose state first"} loading={districts.loading} disabled={busy || !parentState} onChange={setParentDistrict} />
          {districts.error ? <ErrorNotice message={districts.error} onRetry={() => void districts.reload()} /> : parentState && districts.loaded && !districts.rows.length ? <Text className="mb-4 text-xs leading-5 text-brand-muted">No active districts for this state. Add a district first.</Text> : null}
        </> : null}
        {level === "branches" ? <Field label="Address" accessibilityLabel="Address" value={address} onChangeText={setAddress} maxLength={500} multiline numberOfLines={3} editable={!busy} /> : null}
        <SelectField label="Active" value={isActive} options={[{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }]} placeholder="Choose status" disabled={busy} onChange={(value) => setIsActive(value || "true")} />
        {error ? <ErrorNotice message={error} /> : null}
      </ScrollView>
      <View className="mt-4 flex-row justify-end gap-2"><ActionButton label="Cancel" kind="secondary" disabled={busy} onPress={onClose} /><ActionButton label={busy ? "Saving…" : "Save"} disabled={busy || (!record && level === "branches" && districts.loading)} onPress={() => void save()} /></View>
    </View></View>
  </Modal>;
}

export default function GeographyScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const roleCode = typeof user?.role === "string" ? user.role : user?.role?.code;
  const canAdd = roleCode === "MD" || roleCode === "MIS";
  const [level, setLevel] = useState<Level>("states");
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [notice, setNotice] = useState("");
  const states = useLocations("/geography/states");
  const districts = useLocations(stateId ? `/geography/states/${encodeURIComponent(stateId)}/districts` : null);
  const branches = useLocations(districtId ? `/geography/districts/${encodeURIComponent(districtId)}/branches` : null);

  useEffect(() => {
    if (states.loaded) setStateId((current) => current && states.rows.some((state) => state._id === current) ? current : states.rows[0]?._id ?? "");
  }, [states.loaded, states.rows]);
  useEffect(() => {
    if (districts.loaded) setDistrictId((current) => current && districts.rows.some((district) => district._id === current) ? current : districts.rows[0]?._id ?? "");
  }, [districts.loaded, districts.rows]);

  const current = level === "states" ? states : level === "districts" ? districts : branches;
  const error = states.error || (level !== "states" ? districts.error : "") || (level === "branches" ? branches.error : "");
  const loading = current.loading || (level !== "states" && states.loading) || (level === "branches" && districts.loading);
  const refresh = async () => {
    if (states.error) await states.reload();
    else if (level !== "states" && districts.error) await districts.reload();
    else await current.reload();
  };
  function openCreate(target: Level) { setLevel(target); setNotice(""); setEditor({ level: target, record: null }); }
  function saved(value: Editor, parentState: string, parentDistrict: string) {
    setNotice(value.record ? "Geography record updated." : "Geography record created.");
    setEditor(null);
    if (value.level === "states") void states.reload();
    else if (value.record) void (value.level === "districts" ? districts : branches).reload();
    else {
      setStateId(parentState);
      if (value.level === "districts") {
        if (stateId !== parentState) setDistrictId("");
        else void districts.reload();
      } else {
        setDistrictId(parentDistrict);
        if (districtId === parentDistrict) void branches.reload();
      }
    }
  }

  return <>
    <Page refresh={{ refreshing: loading, onRefresh: () => void refresh() }}>
      <Heading eyebrow="ORGANIZATION SETUP" title="Geography" description="Manage states, districts and branches used across the organization." onBack={onBack} />
      {canAdd ? <View className="mb-5 flex-row flex-wrap gap-2">
        <ActionButton label="Add state" icon={Plus} kind="secondary" onPress={() => openCreate("states")} />
        <ActionButton label="Add district" icon={Plus} kind="secondary" disabled={!states.rows.length} onPress={() => openCreate("districts")} />
        <ActionButton label="Add branch" icon={Plus} disabled={!states.rows.length} onPress={() => openCreate("branches")} />
      </View> : null}
      <Card>
        <View className="mb-3 flex-row items-center justify-between"><Text className="text-base font-bold text-brand-ink">{titles[level]}</Text><RefreshAction loading={loading} onPress={() => void refresh()} /></View>
        <SelectField label="Geography level" value={level} options={Object.entries(titles).map(([value, title]) => ({ value, label: title }))} placeholder="Choose level" onChange={(value) => { setLevel((value || "states") as Level); setNotice(""); }} />
        {level !== "states" ? <SelectField label="State" value={stateId} options={states.rows.map((state) => ({ value: state._id, label: state.name }))} placeholder="Choose state" loading={states.loading} onChange={(value) => { setStateId(value); setDistrictId(""); setNotice(""); }} /> : null}
        {level === "branches" ? <SelectField label="District" value={districtId} options={districts.rows.map((district) => ({ value: district._id, label: district.name }))} placeholder="Choose district" disabled={!stateId} loading={districts.loading} onChange={(value) => { setDistrictId(value); setNotice(""); }} /> : null}
        {error ? <ErrorNotice message={error} onRetry={() => void refresh()} /> : null}
        {notice ? <View className="mb-4 rounded-xl bg-emerald-50 p-3"><Text accessibilityRole="alert" className="text-sm text-emerald-800">{notice}</Text></View> : null}
        {loading ? <LoadingState label={`Loading ${level}…`} /> : current.rows.length ? <View className="gap-3">{current.rows.map((row) => <View key={row._id} className="rounded-xl border border-brand-line p-3.5">
          <View className="mb-2 flex-row items-start justify-between gap-3"><Text className="flex-1 text-sm font-bold text-brand-ink">{row.name}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${row.name}`} onPress={() => { setNotice(""); setEditor({ level, record: row }); }} className="h-10 w-10 items-center justify-center rounded-lg bg-indigo-50"><Pencil size={16} color="#17247a" /></Pressable></View>
          <Text className="text-xs leading-5 text-brand-muted">Code: {row.code || "—"}</Text>
          <Text className="mt-1 text-xs leading-5 text-brand-muted">Active: {row.isActive === false ? "No" : "Yes"}</Text>
          {row.address ? <Text className="mt-1 text-xs leading-5 text-brand-ink">Address: {row.address}</Text> : null}
        </View>)}</View> : <Text className="py-7 text-center text-sm leading-5 text-brand-muted">{level !== "states" && (!stateId || (level === "branches" && !districtId)) ? "Choose a parent location to view records." : `No ${level} found.`}</Text>}
      </Card>
    </Page>
    {editor ? <GeographyEditor editor={editor} states={states.rows} stateId={stateId} districtId={districtId} onClose={() => setEditor(null)} onSaved={saved} /> : null}
  </>;
}
