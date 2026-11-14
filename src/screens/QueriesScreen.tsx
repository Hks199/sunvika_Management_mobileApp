import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { api } from "../api";
import { useAuth } from "../auth";
import { QUERY_ROLES, notificationsChanged, personName, type QueryDetail, type QueryRecipient, type QueryThread, type PageMeta } from "../queries";
import { SelectField } from "../components/VisitFields";
import { ActionButton, Card, ErrorNotice, Field, Heading, LoadingState, Page } from "../ui";
function Conversation({ id, onBack }: { id: string; onBack: () => void }) {
  const [detail, setDetail] = useState<QueryDetail | null>(null), [page, setPage] = useState(1), [tick, setTick] = useState(0);
  const [error, setError] = useState(""), [body, setBody] = useState(""), [busy, setBusy] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");
  const sending = useRef(false);
  useEffect(() => { const subscription = AppState.addEventListener("change", state => setActive(state === "active")); return () => subscription.remove(); }, []);
  useEffect(() => {
    if (!active) return; let current = true; setDetail(null); setError("");
    void api.get<QueryDetail>(`/queries/${encodeURIComponent(id)}?page=${page}&limit=50`).then(result => { if (current) setDetail(result.data); }).catch(cause => { if (current) setError(cause instanceof Error ? cause.message : "Unable to load query."); });
    return () => { current = false; };
  }, [id, page, tick, active]);
  useEffect(() => {
    if (!active || !detail?.messages.length) return; let current = true;
    void api.post(`/queries/${encodeURIComponent(id)}/seen`, { messageIds: detail.messages.map(message => message._id) }).then(notificationsChanged).catch(cause => { if (current) setError(cause instanceof Error ? cause.message : "Unable to mark messages as seen."); });
    return () => { current = false; };
  }, [detail, id, active]);
  async function reply() {
    if (sending.current || !body.trim()) return; sending.current = true; setBusy(true); setError("");
    try { await api.post(`/queries/${encodeURIComponent(id)}/replies`, { body: body.trim() }); setBody(""); setPage(1); setTick(value => value + 1); notificationsChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to send reply."); }
    finally { sending.current = false; setBusy(false); }
  }
  return <Page><Heading eyebrow="TEAM SUPPORT" title={detail?.thread.title ?? "Query conversation"} onBack={() => { if (!busy) onBack(); }}/><ActionButton label="Refresh" kind="secondary" onPress={() => setTick(value => value + 1)}/>{error ? <ErrorNotice message={error}/> : null}{!detail && !error ? <LoadingState label="Loading conversation..."/> : null}
    {detail ? <><Text className="my-4 text-xs leading-5 text-brand-muted">From {personName(detail.thread.createdBy)} to {personName(detail.thread.assignedTo)} ({detail.thread.recipientRole === "CP_HEAD" ? "CP Head" : detail.thread.recipientRole})</Text><View className="mb-4 flex-row justify-between gap-2"><ActionButton label="Older messages" kind="secondary" disabled={page >= detail.meta.totalPages} onPress={() => setPage(page + 1)}/><ActionButton label="Newer messages" kind="secondary" disabled={page === 1} onPress={() => setPage(page - 1)}/></View>
    {detail.messages.map(message => <Card key={message._id} className="mb-3"><Text className="text-sm font-bold text-brand-ink">{personName(message.sender)}</Text><Text className="mt-1 text-[10px] text-brand-muted">{new Date(message.createdAt).toLocaleString("en-IN")}</Text><Text className="mt-3 text-sm leading-6 text-brand-ink">{message.body}</Text></Card>)}
    <Card className="mt-3"><Field label="Reply" multiline numberOfLines={4} maxLength={5000} editable={!busy} value={body} onChangeText={setBody}/><ActionButton label={busy ? "Sending..." : "Send reply"} disabled={busy || !body.trim()} onPress={() => void reply()}/></Card></> : null}
  </Page>;
}
export default function QueriesScreen({ onBack, initialThread = "" }: { onBack: () => void; initialThread?: string }) {
  const { user } = useAuth(); const role = typeof user?.role === "string" ? user.role : user?.role?.code;
  const enabled = QUERY_ROLES.includes(role ?? ""), canCreate = ["MD", "RM", "CP"].includes(role ?? "");
  const [selected, setSelected] = useState(initialThread), [items, setItems] = useState<QueryThread[]>([]), [meta, setMeta] = useState<PageMeta | null>(null), [page, setPage] = useState(1), [tick, setTick] = useState(0);
  const [recipients, setRecipients] = useState<QueryRecipient[]>([]), [recipientRole, setRecipientRole] = useState("CP_HEAD"), [recipientId, setRecipientId] = useState("");
  const [title, setTitle] = useState(""), [body, setBody] = useState(""), [error, setError] = useState(""), [recipientError, setRecipientError] = useState(""), [creating, setCreating] = useState(false), [busy, setBusy] = useState(false);
  const sending = useRef(false);
  useEffect(() => {
    if (!enabled || selected) return; let current = true;
    void api.get<{ items: QueryThread[]; meta: PageMeta }>(`/queries?page=${page}&limit=20`).then(result => { if (current) { setItems(result.data.items); setMeta(result.data.meta); setError(""); } }).catch(cause => { if (current) setError(cause instanceof Error ? cause.message : "Unable to load queries."); });
    return () => { current = false; };
  }, [enabled, page, tick, selected]);
  useEffect(() => {
    if (!canCreate || !creating) return; let current = true; setRecipientError("");
    void api.get<QueryRecipient[]>("/queries/recipients").then(result => { if (current) setRecipients(result.data); }).catch(cause => { if (current) setRecipientError(cause instanceof Error ? cause.message : "Unable to load recipients."); });
    return () => { current = false; };
  }, [canCreate, creating, tick]);
  async function create() {
    if (sending.current || !recipientId || !title.trim() || !body.trim()) return; sending.current = true; setBusy(true); setError("");
    try { const result = await api.post<{ _id: string }>("/queries", { title: title.trim(), body: body.trim(), recipientRole, recipientId }); setCreating(false); setTitle(""); setBody(""); setRecipientId(""); setPage(1); setSelected(result.data._id); notificationsChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to raise query."); }
    finally { sending.current = false; setBusy(false); }
  }
  if (!enabled) return <Page><Heading eyebrow="TEAM SUPPORT" title="Queries" onBack={onBack}/><Text>Queries are not available for your role.</Text></Page>;
  if (selected) return <Conversation key={selected} id={selected} onBack={() => { setSelected(""); setTick(value => value + 1); }}/>;
  const choices = recipients.filter(person => person.roleCode === recipientRole);
  return <Page><Heading eyebrow="TEAM SUPPORT" title="Queries" description="Send questions, follow replies, and keep MD informed." onBack={onBack}/><View className="mb-4 flex-row gap-3"><ActionButton label="Refresh" kind="secondary" onPress={() => setTick(value => value + 1)}/>{canCreate ? <ActionButton label={creating ? "Cancel" : "Raise query"} disabled={busy} onPress={() => setCreating(!creating)}/> : null}</View>
    {error ? <ErrorNotice message={error}/> : null}
    {creating ? <Card className="mb-4"><SelectField label="Send to" value={recipientRole} options={[{ value: "CP_HEAD", label: "CP Head" }, { value: "MIS", label: "MIS" }, ...((role === "CP" || role === "MD") ? [{ value: "RM", label: "RM" }] : [])]} placeholder="Choose recipient role" disabled={busy} onChange={value => { setRecipientRole(value); setRecipientId(""); }}/><SelectField label="Recipient" value={recipientId} options={choices.map(person => ({ value: person._id, label: `${personName(person)} (${person.employeeCode})` }))} placeholder="Choose recipient" disabled={busy} onChange={setRecipientId}/>{recipientError ? <ErrorNotice message={recipientError}/> : null}{!choices.length && !recipientError ? <Text className="mb-3 text-xs text-brand-muted">No available recipient for this role. Try the other option or contact MD.</Text> : null}<Field label="Subject" maxLength={160} editable={!busy} value={title} onChangeText={setTitle}/><Field label="Query" multiline numberOfLines={5} maxLength={5000} editable={!busy} value={body} onChangeText={setBody}/><ActionButton label={busy ? "Sending..." : "Send query"} disabled={busy || !recipientId || !title.trim() || !body.trim()} onPress={() => void create()}/></Card> : null}
    {items.map(item => <Pressable key={item._id} onPress={() => setSelected(item._id)}><Card className="mb-3"><Text className="text-base font-bold text-brand-ink">{item.title}</Text><Text className="mt-2 text-xs text-brand-muted">{personName(item.createdBy)} to {personName(item.assignedTo)}</Text><Text className="mt-2 text-[10px] text-brand-muted">{new Date(item.lastMessageAt).toLocaleString("en-IN")}</Text></Card></Pressable>)}
    {!items.length ? <Text className="py-8 text-center text-brand-muted">No queries yet.</Text> : null}<View className="mt-3 flex-row justify-between gap-3"><ActionButton label="Previous" kind="secondary" disabled={page === 1} onPress={() => setPage(page - 1)}/><Text className="self-center text-xs">Page {page}</Text><ActionButton label="Next" kind="secondary" disabled={!meta || page >= meta.totalPages} onPress={() => setPage(page + 1)}/></View>
  </Page>;
}
