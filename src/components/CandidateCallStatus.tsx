import { useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { api } from "../api";
import { CALL_STATUSES, type CallStatus, type Candidate } from "../calling-lists";
import { DateField, SelectField } from "./VisitFields";
import { ActionButton, Field } from "../ui";

export default function CandidateCallStatus({ listId, candidate, onClose, onSaved }: { listId: string; candidate: Candidate; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<CallStatus>(candidate.callStatus ?? "NOT_CALLED");
  const [note, setNote] = useState(candidate.callNote ?? ""), [followUp, setFollowUp] = useState(candidate.nextFollowUpAt ?? "");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (status === "NEEDS_FOLLOWUP" && (!followUp || Number.isNaN(new Date(followUp).getTime()))) throw new Error("Choose a follow-up date and time.");
      await api.patch(`/calling-lists/${listId}/candidates/${candidate._id}/status`, { callStatus: status, callNote: note.trim(), nextFollowUpAt: status === "NEEDS_FOLLOWUP" ? new Date(followUp).toISOString() : null });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save calling status."); } finally { setBusy(false); }
  }
  return <Modal transparent animationType="slide" visible onRequestClose={() => { if (!busy) onClose(); }}><View className="flex-1 justify-end bg-black/40"><View className="max-h-[92%] rounded-t-3xl bg-brand-canvas p-5 pb-8"><ScrollView keyboardShouldPersistTaps="handled"><Text className="mb-3 text-xl font-bold text-brand-ink">Calling status - row {candidate.rowNumber}</Text><Text className="mb-4 text-xs leading-5 text-brand-muted">Mark the outcome after calling. Save the calling outcome and any follow-up details. Recorded calls uses the calling sheet's Total calling value.</Text><SelectField label="Status" placeholder="Choose status" value={status} options={CALL_STATUSES} disabled={busy} onChange={value => { if (CALL_STATUSES.some(option => option.value === value)) setStatus(value as CallStatus); }}/>{status === "NEEDS_FOLLOWUP" ? <View pointerEvents={busy ? "none" : "auto"}><DateField label="Follow-up date and time" value={followUp} onChange={setFollowUp} includeTime/></View> : null}<Field label="Calling note (optional)" value={note} onChangeText={setNote} maxLength={1000} multiline editable={!busy}/>{error ? <Text accessibilityRole="alert" className="mb-4 text-sm text-red-700">{error}</Text> : null}<View className="flex-row flex-wrap gap-3"><ActionButton label="Cancel" kind="secondary" disabled={busy} onPress={onClose}/><ActionButton label={busy ? "Saving..." : "Record call"} disabled={busy} onPress={() => void submit()}/></View></ScrollView></View></View></Modal>;
}
