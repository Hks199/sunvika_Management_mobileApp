import CallingAvailability from "../components/CallingAvailability";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Download, Eye, Phone, Trash2, Upload, X } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import CallingBulkPanel from "../components/CallingBulkPanel";
import CandidateCallStatus from "../components/CandidateCallStatus";
import { api } from "../api";
import { saveCallingListTemplate } from "../callingListTemplate";
import { useAuth } from "../auth";
import { DateField, SelectField } from "../components/VisitFields";
import { ActionButton, Card, EmptyState, ErrorNotice, Field, Heading, LoadingState, Page } from "../ui";
import { EXCEL_TYPE, MAX_EXCEL_SIZE, candidatePhoneNumber, candidateDraft, cpPayload, personName, totalCalling, callStatusLabel, type CallingList, type CallingPreview, type Candidate, type CpDraft, type Person } from "../calling-lists";
const message = (error: unknown) => error instanceof Error ? error.message : "Request failed. Please retry.";
type Place = { _id: string; name: string };

function CandidateDialButton({ headers, candidate, disabled, onPress }: { headers: string[]; candidate: Candidate; disabled: boolean; onPress: () => void }) {
  const number = candidatePhoneNumber(headers, candidate.values);
  return <Pressable accessibilityRole="button" accessibilityLabel={number ? `Call ${number}, candidate row ${candidate.rowNumber}` : `No valid mobile number for candidate row ${candidate.rowNumber}`} accessibilityState={{ disabled: disabled || !number }} disabled={disabled || !number} onPress={onPress} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: number ? "#dcfce7" : "#f1f5f9", opacity: disabled ? 0.5 : 1 }}><Phone size={18} color={number ? "#15803d" : "#94a3b8"}/></Pressable>;
}

function CpForm({ listId, candidate, headers, manager, onClose, onSaved }: { listId: string; candidate: Candidate; headers: string[]; manager: string; onClose: () => void; onSaved: (sent: boolean) => void }) {
  const [draft, setDraft] = useState<CpDraft>(() => candidateDraft(headers, candidate.values));
  const [identityFiles, setIdentityFiles] = useState<Partial<Record<"PAN" | "AADHAAR", DocumentPicker.DocumentPickerAsset>>>({});
  const [states, setStates] = useState<Place[]>([]), [districts, setDistricts] = useState<Place[]>([]);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
  useEffect(() => { let active = true; void api.get<Place[]>("/geography/states").then(r => { if (active) setStates(r.data); }).catch(e => { if (active) setError(message(e)); }); return () => { active = false; }; }, [reload]);
  useEffect(() => { let active = true; setDistricts([]); if (draft.state) void api.get<Place[]>(`/geography/states/${encodeURIComponent(draft.state)}/districts`).then(r => { if (active) setDistricts(r.data); }).catch(e => { if (active) setError(message(e)); }); return () => { active = false; }; }, [draft.state, reload]);
  function update(key: keyof CpDraft, value: string) { setDraft(previous => ({ ...previous, [key]: value, ...(key === "state" ? { district: "" } : {}) })); }
  async function pickIdentity(documentType: "PAN" | "AADHAAR") {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf','image/jpeg','image/png','image/webp'], multiple: false, copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      if (!file || !file.mimeType || !['application/pdf','image/jpeg','image/png','image/webp'].includes(file.mimeType) || !file.size || file.size > 20 * 1024 * 1024) throw new Error('Choose a PDF, JPEG, PNG or WebP file up to 20 MB.');
      setIdentityFiles(current => ({ ...current, [documentType]: file })); setError("");
    } catch (cause) { setError(message(cause)); }
  }
  async function submit() {
    if (Object.values(identityFiles).some(Boolean)) { setError("Identity document storage is awaiting approval. Remove the selected files to create the CP without documents."); return; }
    setBusy(true); setError("");
    try { const result = await api.post<{ invitationSent: boolean }>(`/calling-lists/${listId}/candidates/${candidate._id}/create-cp`, cpPayload(draft)); onSaved(result.data.invitationSent); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <Modal transparent animationType="slide" visible onRequestClose={() => { if (!busy) onClose(); }}><View className="flex-1 justify-end bg-black/40"><View className="max-h-[92%] rounded-t-3xl bg-brand-canvas dark:bg-slate-950 p-5 pb-8"><View className="mb-4 flex-row items-center justify-between"><Text className="text-xl font-bold text-brand-ink dark:text-slate-100">Create CP ? Row {candidate.rowNumber}</Text><Pressable accessibilityLabel="Close CP form" disabled={busy} onPress={onClose} className="p-3"><X size={20}/></Pressable></View><ScrollView keyboardShouldPersistTaps="handled"><Text className="mb-4 text-xs leading-5 text-brand-muted dark:text-slate-400">Review candidate details. This CP will report to {manager}. An invitation will be sent to their email.</Text><Text className="mb-4 text-xs leading-5 text-brand-muted dark:text-slate-400">Use the candidate’s own email and mobile number. Each must be unique across active employees and channel partners. An existing CP should use their current account.</Text>
    {([["firstName", "First name"], ["lastName", "Last name"], ["email", "Email"], ["mobileNumber", "Mobile number"], ["addressLine", "Address"], ["city", "City (optional)"], ["pincode", "Postal code (optional)"]] as const).map(([key, label]) => <Field key={key} label={label} value={draft[key]} editable={!busy} autoCapitalize={key === "email" ? "none" : "words"} keyboardType={key === "email" ? "email-address" : key === "mobileNumber" ? "phone-pad" : "default"} maxLength={key === "addressLine" ? 300 : key === "email" ? 254 : key === "mobileNumber" ? 16 : key === "pincode" ? 12 : 80} onChangeText={value => update(key, value)}/>)}
    <SelectField label="State" placeholder="Choose state" value={draft.state} options={states.map(item => ({ value: item._id, label: item.name }))} disabled={busy} onChange={value => update("state", value)}/><SelectField label="District" placeholder="Choose district" value={draft.district} options={districts.map(item => ({ value: item._id, label: item.name }))} disabled={busy || !draft.state} onChange={value => update("district", value)}/>
    {(["PAN", "AADHAAR"] as const).map(documentType => <View key={documentType} className="mb-3"><ActionButton label={`Select ${documentType === "PAN" ? "PAN card" : "Aadhaar card"} (optional)`} kind="secondary" disabled={busy} onPress={() => void pickIdentity(documentType)}/>{identityFiles[documentType] ? <><Text className="mt-1 text-xs text-brand-muted dark:text-slate-400">{identityFiles[documentType]?.name}</Text><ActionButton label={`Remove ${documentType === "PAN" ? "PAN" : "Aadhaar"}`} kind="secondary" disabled={busy} onPress={() => setIdentityFiles(current => ({ ...current, [documentType]: undefined }))}/></> : null}</View>)}
    <Text className="mb-3 text-xs text-brand-muted dark:text-slate-400">Both documents are optional. PDF, JPEG, PNG or WebP, up to 20 MB each. Identity document storage is awaiting approval; selected files will not be uploaded yet.</Text>
    {error ? <ErrorNotice message={error} onRetry={() => setReload(value => value + 1)}/> : null}<ActionButton label={busy ? "Creating?" : "Create CP & send invitation"} disabled={busy} onPress={() => void submit()}/></ScrollView></View></View></Modal>;
}

export default function CallingListsScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const role = typeof user?.role === "string" ? user.role : user?.role?.code;
  const canManage = role === "MD" || role === "MIS", canFilter = canManage || role === "CP_HEAD", canWork = role !== "CP_HEAD", allowed = canFilter || role === "RM";
  const [sheetStates,setSheetStates]=useState<Place[]>([]),[sheetDistricts,setSheetDistricts]=useState<Place[]>([]),[sheetState,setSheetState]=useState(''),[sheetDistrict,setSheetDistrict]=useState('');
  useEffect(()=>{if(role==='MD'||role==='MIS')void api.get<Place[]>('/geography/states').then(r=>setSheetStates(r.data)).catch(e=>setError(message(e)));},[role]);
  useEffect(()=>{setSheetDistricts([]);if(sheetState)void api.get<Place[]>(`/geography/states/${sheetState}/districts`).then(r=>setSheetDistricts(r.data)).catch(e=>setError(message(e)));},[sheetState]);
  const [lists, setLists] = useState<CallingList[]>([]), [managers, setManagers] = useState<Person[]>([]);
  const [filterManagers,setFilterManagers]=useState<Person[]>([]),[filterRmId,setFilterRmId]=useState(""),[dateFrom,setDateFrom]=useState(""),[dateTo,setDateTo]=useState("");
  const listRequest=useRef(0);
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null), [bulkRefresh, setBulkRefresh] = useState(0), [pool, setPool] = useState("");
  const [selected, setSelected] = useState<CallingList | null>(null), [preview, setPreview] = useState<CallingPreview | null>(null), [previewPage, setPreviewPage] = useState(1);
  const [previewLoading, setPreviewLoading] = useState(false), [previewReload, setPreviewReload] = useState(0), [candidate, setCandidate] = useState<Candidate | null>(null);
  const [deleting, setDeleting] = useState<{ row: Candidate; listId: string } | null>(null), [deleteError, setDeleteError] = useState("");
  const [statusTarget, setStatusTarget] = useState<{ row: Candidate; listId: string } | null>(null);
  const deletionInFlight = useRef(false);
  const previewRequest = useRef(0);
  const load = useCallback(async () => {
    if (!allowed) { setLoading(false); return; }
    const request=++listRequest.current;setLoading(true);setError("");
    try {
      if(canFilter&&dateFrom&&dateTo&&dateFrom>dateTo)throw new Error("Uploaded to must be on or after uploaded from.");
      const query=new URLSearchParams({page:String(page),limit:"20"});
      if(canManage&&pool)query.set("assignmentState",pool);
      if(canFilter){if(filterRmId)query.set("rmId",filterRmId);if(dateFrom)query.set("dateFrom",dateFrom);if(dateTo)query.set("dateTo",dateTo);}
      const [result,rms,filterOptions]=await Promise.all([api.get<{data:CallingList[];total:number}>(`/calling-lists?${query}`),canManage?api.get<Person[]>("/calling-lists/managers"):Promise.resolve(null),canFilter?api.get<Person[]>("/calling-lists/filter-options"):Promise.resolve(null)]);
      if(request!==listRequest.current)return;
      setLists(result.data.data);setTotal(result.data.total);if(rms)setManagers(rms.data);
      if(filterOptions)setFilterManagers(previous=>{const selected=previous.find(rm=>rm._id===filterRmId);return selected&&!filterOptions.data.some(rm=>rm._id===filterRmId)?[selected,...filterOptions.data]:filterOptions.data;});
    }catch(e){if(request===listRequest.current){setError(message(e));setLists([]);setTotal(0);}}finally{if(request===listRequest.current)setLoading(false);}
  },[allowed,canManage,canFilter,page,filterRmId,dateFrom,dateTo,pool]);
  useEffect(()=>{void load();return()=>{listRequest.current++;};},[load]);
  function resetPreview(){setPage(1);setSelected(null);setCandidate(null);}

  useEffect(() => {
    const request = ++previewRequest.current; setPreview(null);
    if (!selected) return;
    setPreviewLoading(true);
    void api.get<CallingPreview>(`/calling-lists/${selected._id}/preview?page=${previewPage}&limit=25`).then(r => { if (request === previewRequest.current) setPreview(r.data); }).catch(e => { if (request === previewRequest.current) setError(message(e)); }).finally(() => { if (request === previewRequest.current) setPreviewLoading(false); });
    return () => { previewRequest.current++; };
  }, [selected, previewPage, previewReload]);
  async function downloadTemplate() {
    setBusy(true); setError("");
    try {
      const response = await api.get<{ fileName: string; base64: string }>("/calling-lists/template");
      await saveCallingListTemplate(response.data);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function pick() {
    try { const result = await DocumentPicker.getDocumentAsync({ type: [EXCEL_TYPE, "application/octet-stream"], copyToCacheDirectory: true }); if (!result.canceled) { const picked = result.assets[0]; if (!picked || !/\.xlsx$/i.test(picked.name) || (picked.size ?? 0) > MAX_EXCEL_SIZE) throw new Error("Choose an .xlsx workbook up to 100 MB."); setFile(picked); } }
    catch (e) { setError(message(e)); }
  }
  async function upload() {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!file) throw new Error("Choose an Excel workbook.");
      const response = await fetch(file.uri); const bytes = await response.arrayBuffer();
      if (bytes.byteLength < 22 || bytes.byteLength > MAX_EXCEL_SIZE) throw new Error("Choose an .xlsx workbook up to 100 MB.");
      const reservation = await api.post<{ _id: string }>("/calling-lists/batches", { fileName: file.name, size: bytes.byteLength });
      await api.putBinary(`/calling-lists/batches/${reservation.data._id}/file`, bytes, EXCEL_TYPE);
      setFile(null); setBulkRefresh(v=>v+1); setNotice("Workbook queued for splitting into 50-entry S3 sheets. Refresh to see progress."); await load();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function assign(list: CallingList, rmId: string) {
    setBusy(true); setError(""); setNotice("");
    try { await api.patch(`/calling-lists/${list._id}/assignment`, { assignedTo: rmId || null }); setSelected(null); setCandidate(null); setNotice(rmId ? "Calling list assigned to the selected RM." : "Assignment removed."); await load(); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function download(list: CallingList) {
    setBusy(true); setError("");
    try { const result = await api.get<{ url: string }>(`/calling-lists/${list._id}/download-url`); await Linking.openURL(result.data.url); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function deleteCandidate() {
    if (!deleting || deletionInFlight.current) return;
    const target = deleting; deletionInFlight.current = true; setBusy(true); setDeleteError(""); setNotice("");
    try {
      const response = await api.delete<{ rowCount: number }>(`/calling-lists/${target.listId}/candidates/${target.row._id}?confirm=true`);
      const rowCount = response.data.rowCount;
      setLists(previous => previous.map(list => list._id === target.listId ? { ...list, rowCount } : list));
      setSelected(previous => previous?._id === target.listId ? { ...previous, rowCount } : previous);
      setPreviewPage(previous => Math.min(previous, Math.max(1, Math.ceil(rowCount / 25))));
      setPreviewReload(value => value + 1); setCandidate(null); setDeleting(null); setNotice("Candidate permanently deleted."); await load();
    } catch (e) { setDeleteError(message(e)); } finally { setBusy(false); deletionInFlight.current = false; }
  }
  async function dialCandidate(row: Candidate) {
    if (!preview || busy) return;
    const number = candidatePhoneNumber(preview.headers, row.values);
    if (!number) return;
    try { await Linking.openURL(`tel:${number}`); }
    catch { setError("Unable to open the phone dialer on this device."); }
  }
  const progress = lists.find(list => list._id === selected?._id);
  return <Page refresh={{ refreshing: loading, onRefresh: () => { setError(""); setPreviewReload(value => value + 1); setBulkRefresh(v=>v+1); void load(); } }}><Heading eyebrow="CHANNEL PARTNER DEVELOPMENT" title="CP calling lists" description={canManage ? "Upload Excel candidates and assign an active RM." : role === "CP_HEAD" ? "Review calling lists assigned to RMs in your team." : "Review assigned candidates and create CP accounts."} onBack={onBack}/>
    {!allowed ? <EmptyState label="Available to MD, MIS, CP Head and assigned RMs."/> : <>
    {error ? <ErrorNotice message={error} onRetry={() => { setError(""); void load(); }}/>:null}{notice ? <Text accessibilityRole="alert" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</Text>:null}
    {role === "RM" ? <CallingAvailability/> : null}
    {canManage ? <Card className="mb-4"><Text className="mb-3 text-base font-bold text-brand-ink dark:text-slate-100">Upload and split workbook</Text><ActionButton label="Download blank Excel template" icon={Download} kind="secondary" disabled={busy} onPress={() => void downloadTemplate()}/><Text className="mb-4 mt-3 text-xs leading-5 text-brand-muted dark:text-slate-400">Save the blank template, fill one candidate per row below the headers, then upload the saved Excel file here.</Text><Text className="mb-4 text-xs leading-5 text-brand-muted dark:text-slate-400">One .xlsx worksheet, up to 100 MB, 50 columns and 1,000,000 candidates. Each generated sheet contains up to 50 candidates and stays in S3 until assignment. Put headers in row 1. Every row must include mobile number, state and district, and all rows must use the same state and district names configured in Geography (capitalization does not matter). The file name and location are read automatically. Other details are optional.</Text><Text className="mb-3 text-xs text-brand-muted dark:text-slate-400">{file?.name ?? "No Excel workbook selected"}</Text><View className="flex-row flex-wrap gap-2"><ActionButton label="Choose Excel" icon={Upload} kind="secondary" disabled={busy} onPress={() => void pick()}/><ActionButton label={busy ? "Uploading?" : "Upload list"} disabled={busy || !file} onPress={() => void upload()}/></View></Card>:null}
    {canFilter ? <Card className="mb-4"><Text className="mb-3 text-base font-bold text-brand-ink dark:text-slate-100">Filter calling lists</Text><>{canManage ? <SelectField label="Assignment" value={pool} placeholder="All sheets" options={[{value:"unassigned",label:"Unassigned (S3 only)"},{value:"assigned",label:"Assigned"}]} disabled={busy} onChange={value=>{setPool(value);setPage(1);setSelected(null);}}/> : null}</><SelectField label="RM" placeholder="All assigned RMs" searchPlaceholder="Search RM name or employee code" value={filterRmId} options={filterManagers.map(rm=>({value:rm._id,label:`${personName(rm)} ${rm.employeeCode??""}${rm.isActive===false?" (inactive)":""}`}))} disabled={busy} onChange={value=>{setFilterRmId(value);resetPreview();}}/><View pointerEvents={busy?"none":"auto"}><DateField label="Uploaded from" value={dateFrom} onChange={value=>{setDateFrom(value);resetPreview();}}/><DateField label="Uploaded to" value={dateTo} onChange={value=>{setDateTo(value);resetPreview();}}/></View><Text className="mb-3 text-xs text-brand-muted dark:text-slate-400">Filter by upload date in India time (IST).</Text><ActionButton label="Clear filters" kind="secondary" disabled={busy||(!filterRmId&&!dateFrom&&!dateTo&&!pool)} onPress={()=>{setFilterRmId("");setDateFrom("");setDateTo("");setPool("");resetPreview();}}/></Card> : null}
    <Text className="mb-3 text-base font-bold text-brand-ink dark:text-slate-100">{canFilter ? "Calling lists" : "My assigned lists"} ({total})</Text>
    {canManage ? <Card className="mb-4"><Text className="mb-3 font-bold">Set location for an older batch</Text><Text className="mb-3 text-xs">Select a state and district, then use Set selected location on the batch below.</Text><SelectField label="State" value={sheetState} options={sheetStates.map(x=>({value:x._id,label:x.name}))} placeholder="Choose state" disabled={busy} onChange={value=>{setSheetState(value);setSheetDistrict('');}}/><SelectField label="District" value={sheetDistrict} options={sheetDistricts.map(x=>({value:x._id,label:x.name}))} placeholder="Choose district" disabled={busy||!sheetState} onChange={setSheetDistrict}/></Card> : null}
    {canManage ? <CallingBulkPanel refreshKey={bulkRefresh} allocationState={sheetState} allocationDistrict={sheetDistrict} states={sheetStates} districts={sheetDistricts}/> : null}
    {loading ? <LoadingState/> : !lists.length ? <EmptyState label={canFilter ? "No calling lists match the selected filters." : "No calling lists assigned to you yet."}/> : lists.map(list => <Card key={list._id} className="mb-4"><Text className="text-base font-bold text-brand-ink dark:text-slate-100">{list.title}</Text><Text className="mb-3 mt-1 text-xs text-brand-muted dark:text-slate-400">{list.fileName} · {list.rowCount} candidates · {list.candidateStorage==="S3"?"Unassigned · S3 only":list.assignmentSource==="AUTO"?"Automatically assigned":""}</Text><Text className="mb-3 text-xs text-brand-muted dark:text-slate-400">Uploaded by {personName(list.uploadedBy)}</Text>{canManage ? <SelectField label="Assigned RM" value={list.assignedTo?._id ?? ""} placeholder="Unassigned" options={[...(list.assignedTo && !managers.some(rm => rm._id === list.assignedTo?._id) ? [{ value: list.assignedTo._id, label: `${personName(list.assignedTo)} (inactive)` }] : []), ...managers.map(rm => ({ value: rm._id, label: personName(rm) }))]} disabled={busy} onChange={value => void assign(list, value)}/> : <Text className="mb-3 text-xs text-brand-muted dark:text-slate-400">Assigned to {personName(list.assignedTo)}</Text>}<View className="mb-3 flex-row flex-wrap gap-2"><View className="rounded-xl bg-indigo-50 px-3 py-2"><Text className="text-xs text-indigo-800">Total uploaded</Text><Text className="text-base font-bold text-indigo-800">{list.originalRowCount ?? "—"}</Text></View><View className="rounded-xl bg-teal-700 px-3 py-2" accessibilityLabel="Total calling equals deleted plus converted to CP plus interested plus needs follow-up"><Text className="text-xs text-white">Total calling</Text><Text className="text-base font-bold text-white">{totalCalling(list) ?? "—"}</Text></View><View className="rounded-xl bg-blue-100 px-3 py-2"><Text className="text-xs text-blue-800">Converted to CP</Text><Text className="text-base font-bold text-blue-800">{list.convertedCount}</Text></View><View className="rounded-xl bg-amber-100 px-3 py-2"><Text className="text-xs text-amber-800">Not called</Text><Text className="text-base font-bold text-amber-800">{list.notCalledCount ?? 0}</Text></View></View>{Boolean(list.deletedCount) ? <Text className="mb-3 text-xs text-brand-muted dark:text-slate-400">{list.deletedCount} candidates deleted from this list.</Text> : null}{list.originalRowCount === null ? <Text className="mb-3 text-xs text-brand-muted dark:text-slate-400">Original upload count is temporarily unavailable.</Text> : null}<View className="mb-3 flex-row gap-2"><View className="flex-1 rounded-xl bg-emerald-50 px-3 py-2"><Text className="text-[11px] text-emerald-800">Interested</Text><Text className="text-base font-bold text-emerald-800">{list.interestedCount ?? 0}</Text></View><View className="flex-1 rounded-xl bg-amber-50 px-3 py-2"><Text className="text-[11px] text-amber-800">Needs follow-up</Text><Text className="text-base font-bold text-amber-800">{list.followUpCount ?? 0}</Text></View></View><View className="flex-row flex-wrap gap-2"><ActionButton label="Preview" icon={Eye} kind="secondary" disabled={busy} onPress={() => { setSelected(list); setPreviewPage(1); setPreviewReload(value => value + 1); setError(""); }}/><ActionButton label="Download Excel" icon={Download} kind="secondary" disabled={busy} onPress={() => void download(list)}/></View></Card>)}
    <View className="mb-5 flex-row items-center justify-between"><ActionButton label="Previous" kind="secondary" disabled={page === 1 || loading} onPress={() => setPage(value => value - 1)}/><Text className="text-xs text-brand-muted dark:text-slate-400">Page {page}</Text><ActionButton label="Next" kind="secondary" disabled={page * 20 >= total || loading} onPress={() => setPage(value => value + 1)}/></View>
    {selected ? <Card className="mb-4"><View className="mb-3 flex-row items-center justify-between"><Text className="flex-1 text-base font-bold text-brand-ink dark:text-slate-100">{selected.title}</Text><Pressable accessibilityLabel="Close preview" onPress={() => setSelected(null)} className="p-3"><X size={18}/></Pressable></View><Text className="mb-3 text-xs text-brand-muted dark:text-slate-400">All columns · Swipe sideways to view details{selected.candidateStorage==="S3"?" · Preview from S3; assign to an RM to start calling.":""}</Text>{progress ? <View className="mb-3 flex-row gap-2"><View className="flex-1 rounded-xl bg-emerald-50 p-3"><Text className="text-[11px] text-emerald-800">Interested</Text><Text className="text-base font-bold text-emerald-800">{progress.interestedCount ?? 0}</Text></View><View className="flex-1 rounded-xl bg-amber-50 p-3"><Text className="text-[11px] text-amber-800">Needs follow-up</Text><Text className="text-base font-bold text-amber-800">{progress.followUpCount ?? 0}</Text></View></View> : null}{previewLoading ? <LoadingState label="Loading preview?"/> : preview ? <><ScrollView horizontal><View><View className="flex-row bg-indigo-50">{["Row", "Call", "Calling status", ...preview.headers, ...((role === "MD" || role === "RM") ? ["CP account"] : []), ...(canWork && selected.candidateStorage!=="S3" ? ["Delete"] : [])].map((header, i) => <Text key={i} style={{ width: i === 0 ? 60 : i === 1 ? 72 : 160 }} className="p-3 text-xs font-bold text-brand-ink dark:text-slate-100">{header}</Text>)}</View>{preview.rows.map(row => <View key={row._id} className="flex-row items-center border-b border-brand-line dark:border-slate-700"><Text style={{ width: 60 }} className="p-3 text-xs text-brand-muted dark:text-slate-400">{row.rowNumber}</Text><View style={{ width: 72 }} className="items-center p-2"><CandidateDialButton headers={preview.headers} candidate={row} disabled={busy} onPress={() => void dialCandidate(row)}/></View><View style={{ width: 160 }} className="p-2"><Text className="mb-2 text-xs font-bold text-brand-navy dark:text-indigo-200">{callStatusLabel(row)}</Text>{canWork && selected.candidateStorage!=="S3" && !row.employee ? <ActionButton label="Record call" kind="secondary" disabled={busy} onPress={() => setStatusTarget({ row, listId: selected._id })}/> : null}{!row.employee && row.callStatus === "NEEDS_FOLLOWUP" && row.nextFollowUpAt ? <Text className="mt-2 text-xs text-amber-800">Follow up: {new Date(row.nextFollowUpAt).toLocaleString("en-IN")}</Text> : null}{row.callNote ? <Text className="mt-2 text-xs text-brand-muted dark:text-slate-400">{row.callNote}</Text> : null}</View>{row.values.map((value, i) => <Text key={i} style={{ width: 160 }} className="p-3 text-xs text-brand-ink dark:text-slate-100">{value || "?"}</Text>)}{role === "MD" || role === "RM" ? <View style={{ width: 160 }} className="p-2">{row.employee ? <View style={{ alignSelf: "flex-start", borderRadius: 20, borderWidth: 1, borderColor: "#93c5fd", backgroundColor: "#dbeafe", paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: "#1e40af", fontSize: 11, fontWeight: "700" }}>CP created</Text></View> : <ActionButton label="Create CP" kind="secondary" disabled={!selected.assignedTo || busy} onPress={() => setCandidate(row)}/>}</View> : null}{canWork && selected.candidateStorage!=="S3" ? <View style={{ width: 160 }} className="p-2"><ActionButton label="Delete" icon={Trash2} kind="danger" disabled={busy} onPress={() => { setDeleteError(""); setDeleting({ row, listId: selected._id }); }}/></View> : null}</View>)}</View></ScrollView>{!preview.rows.length ? <Text className="mt-3 text-sm text-brand-muted dark:text-slate-400">No candidates remain in this list.</Text> : null}{!selected.assignedTo && role === "MD" ? <Text className="mt-3 text-xs text-brand-muted dark:text-slate-400">Assign this list to an RM before creating CP accounts.</Text> : null}<View className="mt-4 flex-row items-center justify-between"><ActionButton label="Previous rows" kind="secondary" disabled={previewPage === 1} onPress={() => setPreviewPage(value => value - 1)}/><Text className="text-xs text-brand-muted dark:text-slate-400">{previewPage}</Text><ActionButton label="Next rows" kind="secondary" disabled={previewPage * 25 >= preview.total} onPress={() => setPreviewPage(value => value + 1)}/></View></> : <ActionButton label="Retry preview" kind="secondary" onPress={() => setPreviewReload(value => value + 1)}/>}</Card>:null}
    {statusTarget ? <CandidateCallStatus key={statusTarget.row._id} listId={statusTarget.listId} candidate={statusTarget.row} onClose={() => setStatusTarget(null)} onSaved={() => { setStatusTarget(null); setPreviewReload(value => value + 1); void load(); setNotice("Calling status saved."); }}/> : null}
    {deleting ? <Modal transparent animationType="fade" visible onRequestClose={() => { if (!busy) setDeleting(null); }}><View className="flex-1 justify-center bg-black/40 p-5"><View accessibilityViewIsModal className="rounded-3xl bg-white dark:bg-slate-800 p-5"><Text className="mb-3 text-xl font-bold text-brand-ink dark:text-slate-100">Delete candidate row {deleting.row.rowNumber}?</Text><Text className="mb-4 text-sm leading-6 text-brand-muted dark:text-slate-400">This permanently removes the candidate from the database and preview. This cannot be undone. The original uploaded Excel file{deleting.row.employee ? " and the existing CP account are" : " is"} kept.</Text>{deleteError ? <Text accessibilityRole="alert" className="mb-4 text-sm text-red-700">{deleteError}</Text> : null}<View className="flex-row flex-wrap gap-3"><ActionButton label="Cancel" kind="secondary" disabled={busy} onPress={() => setDeleting(null)}/><ActionButton label={busy ? "Deleting..." : "Delete permanently"} kind="danger" icon={Trash2} disabled={busy} onPress={() => void deleteCandidate()}/></View></View></View></Modal> : null}
    {candidate && selected && preview ? <CpForm key={candidate._id} listId={selected._id} candidate={candidate} headers={preview.headers} manager={personName(selected.assignedTo)} onClose={() => setCandidate(null)} onSaved={sent => { setCandidate(null); void load(); setPreviewReload(value => value + 1); setNotice(sent ? "CP account created and invitation sent." : "CP account created. Invitation was not delivered; use Employees to resend it."); }}/>:null}
    </>}
  </Page>;
}
