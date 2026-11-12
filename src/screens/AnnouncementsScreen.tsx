import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { api } from "../api";
import { useAuth } from "../auth";
import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_PUBLISHERS, announcementRoleAvailable, announcementAudienceCodes, announcementAudienceChanged, announcementAuthor, announcementsChanged, type Announcement, type AnnouncementAudience, type AnnouncementPage } from "../announcements";
import { DateField, SelectField } from "../components/VisitFields";
import { ActionButton, Card, ErrorNotice, Field, Heading, LoadingState, Page } from "../ui";
function AnnouncementForm({ item, onClose, onSaved }: { item: Announcement | null; onClose: () => void; onSaved: () => void }) {
  const [audience, setAudience] = useState<AnnouncementAudience | null>(null), [roles, setRoles] = useState<string[]>(announcementAudienceCodes(item?.audienceRoles ?? []));
  const [title, setTitle] = useState(item?.title ?? ""), [body, setBody] = useState(item?.body ?? ""), [category, setCategory] = useState(item?.category ?? "BUSINESS"), [expiry, setExpiry] = useState(item?.expiresAt ?? "");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [reload, setReload] = useState(0); const saving = useRef(false);
  useEffect(() => {
    let active = true;
    void api.get<AnnouncementAudience>("/announcements/audience").then(result => { if (active) { const roles = result.data.roles.filter(announcementRoleAvailable); setAudience({ ...result.data, roles }); setRoles(item ? announcementAudienceCodes(item.audienceRoles).filter(code => roles.some(role => role.code === code)) : roles.map(role => role.code)); setError(""); } }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load audience."); });
    return () => { active = false; };
  }, [item, reload]);
  async function save() {
    if (saving.current || !title.trim() || !body.trim() || !roles.length) return; saving.current = true; setBusy(true); setError("");
    try {
      const payload: Record<string, unknown> = { title: title.trim(), body: body.trim(), category };
      if (!item || announcementAudienceChanged(item.audienceRoles, roles)) payload.audienceRoles = roles;
      if (!item || expiry !== (item.expiresAt ?? "")) payload.expiresAt = expiry ? new Date(expiry).toISOString() : null;
      if (item) await api.patch(`/announcements/${item._id}`, payload); else await api.post("/announcements", payload);
      announcementsChanged(); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save announcement."); }
    finally { saving.current = false; setBusy(false); }
  }
  return <Card className="mb-4"><Text className="mb-4 text-lg font-bold text-brand-ink">{item ? "Edit announcement" : "Publish announcement"}</Text><SelectField label="Category" value={category} options={ANNOUNCEMENT_CATEGORIES.map(value => ({ value, label: value }))} placeholder="Choose category" disabled={busy} onChange={setCategory}/><Field label="Title" maxLength={160} editable={!busy} value={title} onChangeText={setTitle}/><Field label="Message" multiline numberOfLines={5} maxLength={2000} editable={!busy} value={body} onChangeText={setBody}/>
    <View className="mb-4"><Text className="mb-2 text-xs font-bold text-brand-ink">Audience {audience?.scope === "TEAM" ? "(your downline only)" : ""}</Text>{audience ? audience.roles.map(role => <Pressable key={role.code} accessibilityRole="checkbox" accessibilityState={{ checked: roles.includes(role.code), disabled: busy }} disabled={busy} className="mb-2 flex-row items-center gap-2 rounded-lg border border-brand-line p-3" onPress={() => setRoles(current => current.includes(role.code) ? current.filter(code => code !== role.code) : [...current, role.code])}><Text className="text-sm font-bold text-brand-navy">{roles.includes(role.code) ? "[x]" : "[ ]"}</Text><Text className="flex-1 text-xs text-brand-ink">{role.name} ({role.code})</Text></Pressable>) : <Text className="text-xs text-brand-muted">Loading permitted audiences...</Text>}</View><Text className="mb-4 text-xs text-brand-muted">Audience changes apply to {audience?.scope === "TEAM" ? "your downline only" : "the organization"}.</Text>
    <DateField label="Expires at (optional)" value={expiry} includeTime onChange={setExpiry}/>{expiry ? <View className="mb-4"><ActionButton label="Remove expiry" kind="secondary" disabled={busy} onPress={() => setExpiry("")}/></View> : null}{error ? <ErrorNotice message={error} onRetry={!audience ? () => setReload(value => value + 1) : undefined}/> : null}<View className="flex-row gap-3"><ActionButton label="Cancel" kind="secondary" disabled={busy} onPress={onClose}/><ActionButton label={busy ? "Saving..." : item ? "Save changes" : "Publish"} disabled={busy || !title.trim() || !body.trim() || !roles.length || (!audience)} onPress={() => void save()}/></View>
  </Card>;
}
export default function AnnouncementsScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth(), role = typeof user?.role === "string" ? user.role : user?.role?.code;
  const allowed = ANNOUNCEMENT_PUBLISHERS.includes(role ?? "");
  const [result, setResult] = useState<AnnouncementPage | null>(null), [page, setPage] = useState(1), [tick, setTick] = useState(0), [editing, setEditing] = useState<Announcement | null | undefined>(undefined), [error, setError] = useState(""), [busy, setBusy] = useState("");
  useEffect(() => { if (!allowed) return; let active = true; void api.get<AnnouncementPage>(`/announcements?page=${page}&limit=20`).then(response => { if (active) { setResult(response.data); setError(""); } }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load announcements."); }); return () => { active = false; }; }, [allowed, page, tick]);
  async function toggle(item: Announcement) {
    if (busy) return; setBusy(item._id); setError("");
    try { await api.patch(`/announcements/${item._id}`, { isActive: !item.isActive }); announcementsChanged(); setTick(value => value + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update announcement."); }
    finally { setBusy(""); }
  }
  if (!allowed) return <Page><Heading eyebrow="TEAM FOCUS" title="Announcements" onBack={onBack}/><Text>Announcements for you appear in the top bar.</Text></Page>;
  return <Page><Heading eyebrow="TEAM FOCUS" title="Announcements" description={role === "MD" ? "Manage all announcements across the organization." : "Publish business updates, targets and motivation for your permitted audience."} onBack={onBack}/><View className="mb-4 flex-row gap-3"><ActionButton label="Refresh" kind="secondary" onPress={() => { setTick(value => value + 1); announcementsChanged(); }}/><ActionButton label="New announcement" disabled={Boolean(busy)} onPress={() => setEditing(null)}/></View>{error ? <ErrorNotice message={error}/> : null}
    {editing !== undefined ? <AnnouncementForm key={editing?._id ?? "new"} item={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setPage(1); setTick(value => value + 1); }}/> : null}
    {result?.items.map(item => <Card key={item._id} className="mb-3"><View className="mb-3 flex-row justify-between"><Text className="text-[10px] font-bold text-brand-navy">{item.category}</Text><Text className="text-[10px] text-brand-muted">{!item.isActive ? "Stopped" : item.expiresAt && Date.parse(item.expiresAt) <= Date.now() ? "Expired" : "Active"}</Text></View><Text className="text-lg font-bold text-brand-ink">{item.title}</Text><Text className="my-3 text-sm leading-6 text-brand-ink">{item.body}</Text><Text className="mb-4 text-xs leading-5 text-brand-muted">By {announcementAuthor(item)} - {item.scope === "TEAM" ? "Author's downline" : "Organization"} - {announcementAudienceCodes(item.audienceRoles).join(", ")}{item.expiresAt ? ` - Expires ${new Date(item.expiresAt).toLocaleString("en-IN")}` : ""}</Text><View className="flex-row gap-3"><ActionButton label="Edit" kind="secondary" disabled={Boolean(busy)} onPress={() => setEditing(item)}/><ActionButton label={item.isActive ? "Stop announcement" : "Activate"} kind="secondary" disabled={Boolean(busy)} onPress={() => void toggle(item)}/></View></Card>)}
    {!result && !error ? <LoadingState label="Loading announcements..."/> : null}{result && !result.items.length ? <Text className="py-8 text-center text-brand-muted">No announcements yet.</Text> : null}<View className="mt-3 flex-row justify-between gap-3"><ActionButton label="Previous" kind="secondary" disabled={page === 1} onPress={() => setPage(page - 1)}/><Text className="self-center text-xs">Page {page}</Text><ActionButton label="Next" kind="secondary" disabled={!result || page >= result.meta.totalPages} onPress={() => setPage(page + 1)}/></View>
  </Page>;
}
