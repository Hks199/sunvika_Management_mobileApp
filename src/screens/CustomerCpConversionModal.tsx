import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { X } from "lucide-react-native";
import { api } from "../api";
import { cpPayload, personName, type CpDraft } from "../calling-lists";
import { customerCpDraft, type CustomerCpOptions } from "../customer-cp";
import { SelectField } from "../components/VisitFields";
import { ActionButton, ErrorNotice, Field, LoadingState } from "../ui";
type Place = { _id: string; name: string };

export default function CustomerCpConversionModal({ customerId, onClose, onSaved }: { customerId: string; onClose: () => void; onSaved: (sent: boolean, already: boolean) => void }) {
  const [options, setOptions] = useState<CustomerCpOptions | null>(null), [draft, setDraft] = useState<CpDraft | null>(null);
  const [manager, setManager] = useState(""), [states, setStates] = useState<Place[]>([]), [districts, setDistricts] = useState<Place[]>([]);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    void Promise.all([api.get<CustomerCpOptions>(`/customers/${customerId}/cp-conversion`), api.get<Place[]>("/geography/states")]).then(([r, locations]) => {
      if (!active) return; setOptions(r.data); setDraft(customerCpDraft(r.data.defaults)); setStates(locations.data);
      setManager(r.data.defaults.reportingManagerId ?? (r.data.managers.length === 1 ? r.data.managers[0]._id : ""));
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to prepare conversion"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customerId, reload]);
  useEffect(() => { let active = true; setDistricts([]); if (draft?.state) void api.get<Place[]>(`/geography/states/${encodeURIComponent(draft.state)}/districts`).then(r => { if (active) setDistricts(r.data); }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load districts"); }); return () => { active = false; }; }, [draft?.state]);
  function update(key: keyof CpDraft, value: string) { setDraft(previous => previous ? ({ ...previous, [key]: value, ...(key === "state" ? { district: "" } : {}) }) : previous); }
  async function submit() {
    if (!draft || !manager || busy) return; setBusy(true); setError("");
    try {
      const r = await api.post<{ invitationSent: boolean; alreadyConverted: boolean }>(`/customers/${customerId}/convert-to-cp`, {
        ...cpPayload(draft), confirmed: true, reportingManagerId: manager,
        ...(options?.defaults.branch && draft.state === options.defaults.state && draft.district === options.defaults.district ? { branch: options.defaults.branch } : {})
      }); onSaved(r.data.invitationSent, r.data.alreadyConverted);
    } catch (e) { setError(e instanceof Error ? e.message : "Conversion failed"); } finally { setBusy(false); }
  }
  return <Modal transparent animationType="slide" visible onRequestClose={() => { if (!busy) onClose(); }}><View className="flex-1 justify-end bg-black/40"><View className="max-h-[92%] rounded-t-3xl bg-brand-canvas dark:bg-slate-950 p-5 pb-8">
    <View className="mb-3 flex-row items-center justify-between"><Text className="text-xl font-bold text-brand-ink dark:text-slate-100">Convert customer to CP?</Text><Pressable disabled={busy} onPress={onClose} accessibilityLabel="Close conversion" className="p-3"><X size={19}/></Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled"><Text className="mb-4 text-xs leading-5 text-brand-muted dark:text-slate-400">This creates a CP employee account and sends a password-setup email. The customer record and all history remain linked to the CP and visible to their upline.</Text>
      {loading ? <LoadingState/> : options?.cpEmployee ? <Text className="mb-4 text-sm text-brand-muted dark:text-slate-400">This customer already has a CP account. Use Employees to view it or resend its invitation.</Text> : draft && options ? <>
        {([["firstName", "First name"], ["lastName", "Last name"], ["email", "Invitation email"], ["mobileNumber", "Mobile number"], ["addressLine", "Address"], ["city", "City (optional)"], ["pincode", "Postal code (optional)"]] as const).map(([key, label]) => <Field key={key} label={label} value={draft[key]} editable={!busy} keyboardType={key === "email" ? "email-address" : key === "mobileNumber" ? "phone-pad" : "default"} autoCapitalize={key === "email" ? "none" : "words"} maxLength={key === "addressLine" ? 300 : key === "email" ? 254 : key === "mobileNumber" ? 16 : key === "pincode" ? 12 : 80} onChangeText={value => update(key, value)}/>)}
        <SelectField label="State" value={draft.state} options={states.map(item => ({ value: item._id, label: item.name }))} placeholder="Select state" disabled={busy} onChange={value => update("state", value)}/>
        <SelectField label="District" value={draft.district} options={districts.map(item => ({ value: item._id, label: item.name }))} placeholder="Select district" disabled={busy || !draft.state} onChange={value => update("district", value)}/>
        <SelectField label="Reporting RM" value={manager} options={options.managers.map(rm => ({ value: rm._id, label: `${personName(rm)} - ${rm.employeeCode ?? ""}` }))} placeholder="Select RM" disabled={busy} onChange={setManager}/>
        {!options.managers.length ? <Text className="mb-3 text-xs text-brand-muted dark:text-slate-400">No active RM is available in your permitted hierarchy.</Text> : null}
      </> : null}
      {error ? <ErrorNotice message={error} onRetry={() => setReload(value => value + 1)}/> : null}
      <View className="mt-3 flex-row flex-wrap gap-2"><ActionButton label="Cancel" kind="secondary" disabled={busy} onPress={onClose}/>{options && !options.cpEmployee ? <ActionButton label={busy ? "Converting..." : "OK, convert to CP"} disabled={busy || loading || !manager || !draft} onPress={() => void submit()}/> : null}</View>
    </ScrollView>
  </View></View></Modal>;
}
