import { useEffect, useState } from "react";
import { AppState, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Bell, X } from "lucide-react-native";
import { api } from "../api";
import { useAuth } from "../auth";
import { QUERY_ROLES, notificationsChanged, useNotifications, type QueryNotification } from "../queries";
import { useCpPush } from "../cp-push";
import { ActionButton, ErrorNotice } from "../ui";
import { useTheme } from "../theme";
export default function NotificationBell({ onOpenThread }: { onOpenThread: (id: string) => void }) {
  const { theme } = useTheme();
  const { user } = useAuth(); const role = typeof user?.role === "string" ? user.role : user?.role?.code;
  const enabled = QUERY_ROLES.includes(role ?? "");
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => { const subscription = AppState.addEventListener("change", state => setActive(state === "active")); return () => subscription.remove(); }, []);
  const { inbox, error, page, setPage, refresh } = useNotifications(api, enabled ? user?.id ?? user?._id ?? "" : "", active);
  const [detail,setDetail]=useState<QueryNotification|null>(null);
  const push=useCpPush(role==="CP"?(user?.id??user?._id??""):"",id=>{void api.post<QueryNotification>(`/notifications/${id}/seen`).then(r=>{setDetail(r.data);setOpen(false);notificationsChanged();}).catch(()=>setActionError("Unable to open this notification for your current account."));});
  const [open, setOpen] = useState(false), [opening, setOpening] = useState(false), [actionError, setActionError] = useState("");
  if (!enabled) return null;
  const count = inbox?.unreadCount ?? 0;
  async function view(item: QueryNotification) {
    if (opening) return; setOpening(true); setActionError("");
    try { await api.post(`/notifications/${item._id}/seen`); notificationsChanged(); setOpen(false); if(item.kind==="CP_REMINDER"||!item.thread)setDetail(item);else onOpenThread(item.thread); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Unable to open notification."); }
    finally { setOpening(false); }
  }
  return <><Pressable accessibilityRole="button" accessibilityLabel={`Notifications, ${count} unread`} onPress={() => { setOpen(true); refresh(); }} className="mr-2 h-10 w-10 items-center justify-center"><Bell size={21} color={theme === "dark" ? "#c7d2fe" : "#17247a"}/>{count > 0 ? <View style={{ position: "absolute", top: 0, right: -3, borderRadius: 12, backgroundColor: "#dc2626", minWidth: 19, paddingHorizontal: 4 }}><Text style={{ color: "white", fontSize: 10, textAlign: "center", fontWeight: "700" }}>{count > 99 ? "99+" : count}</Text></View> : null}</Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}><View className="flex-1 justify-end bg-black/40"><View className="max-h-[85%] rounded-t-3xl bg-brand-canvas dark:bg-slate-950 p-5 pb-8"><View className="mb-4 flex-row items-center justify-between"><Text className="text-lg font-bold text-brand-ink dark:text-slate-100">Notifications ({count} unread)</Text><Pressable accessibilityLabel="Close notifications" onPress={() => setOpen(false)}><X size={22} color={theme === "dark" ? "#c7d2fe" : "#17247a"}/></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled">{error || actionError ? <ErrorNotice message={actionError || error} onRetry={refresh}/> : null}{!inbox && !error ? <Text>Loading notifications...</Text> : null}
      {role==="CP"?<View className="my-3"><Text className="mb-2 text-xs text-brand-muted dark:text-slate-400">{push.status}</Text><ActionButton label="Enable phone notifications" kind="secondary" disabled={push.busy} onPress={push.enable}/></View>:null}
      {inbox?.items.map(item => <Pressable key={item._id} disabled={opening} onPress={() => void view(item)} className={`mb-2 rounded-xl border p-4 ${item.readAt ? "border-brand-line dark:border-slate-700 bg-white dark:bg-slate-800" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"}`}><Text className="text-sm font-bold text-brand-ink dark:text-slate-100">{item.title}</Text><Text className="mt-2 text-xs text-brand-muted dark:text-slate-400">{new Date(item.createdAt).toLocaleString("en-IN")}{item.readAt ? "" : " - Unread"}</Text></Pressable>)}
      {inbox && !inbox.items.length ? <Text className="py-6 text-brand-muted dark:text-slate-400">No notifications yet.</Text> : null}
      <View className="mt-3"><ActionButton label="Refresh notifications" kind="secondary" onPress={refresh}/></View>
      <View className="mt-3 flex-row justify-between gap-3"><ActionButton label="Newer" kind="secondary" disabled={page === 1} onPress={() => setPage(page - 1)}/><ActionButton label="Older" kind="secondary" disabled={!inbox || page >= inbox.meta.totalPages} onPress={() => setPage(page + 1)}/></View></ScrollView>
    </View></View></Modal>
    <Modal visible={Boolean(detail)} transparent animationType="slide" onRequestClose={()=>setDetail(null)}><View className="flex-1 justify-end bg-black/40"><View className="max-h-[85%] rounded-t-3xl bg-brand-canvas dark:bg-slate-950 p-5 pb-8"><View className="mb-4 flex-row items-center justify-between"><Text className="flex-1 text-lg font-bold text-brand-ink dark:text-slate-100">{detail?.title}</Text><Pressable onPress={()=>setDetail(null)} accessibilityLabel="Close message"><X size={22}/></Pressable></View><ScrollView><Text className="text-base leading-6 text-brand-ink dark:text-slate-100">{detail?.body}</Text></ScrollView></View></View></Modal>
  </>;
}
