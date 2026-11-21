import { useAuth } from "../auth";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LogOut, RefreshCw, ShieldCheck } from "lucide-react-native";
import { api } from "../api";
import type { ModuleKey, RecordValue } from "../types";
import { ActionButton, Card, EmptyState, ErrorNotice, Field, Heading, LoadingState, Page, SectionTitle } from "../ui";
import GeographyScreen from "./GeographyScreen";
import ReportAnalysis from "../ReportAnalysis";

function list(data: unknown): RecordValue[] {
  if (Array.isArray(data)) return data.filter((item): item is RecordValue => Boolean(item) && typeof item === "object");
  if (data && typeof data === "object" && "data" in data && Array.isArray(data.data)) {
    return data.data.filter((item): item is RecordValue => Boolean(item) && typeof item === "object");
  }
  return [];
}

const reportOptions = [
  ["employee-performance", "Employee performance"],
  ["branch-performance", "Branch performance"],
  ["district-performance", "District performance"],
  ["state-performance", "State performance"],
  ["lead-conversion", "Lead conversion"],
  ["customers", "Customer report"],
  ["follow-ups", "Follow-up report"],
  ["quotations", "Quotation report"],
] as const;

function ReportsScreen({ onBack }: { onBack: () => void }) {
  const [kind, setKind] = useState<string>(reportOptions[0][0]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function fetchReport(queryString: string, page = 1) {
    setBusy(true);
    setError("");
    const query = new URLSearchParams(queryString);
    if (kind !== "lead-conversion") query.set("page", String(page));
    try {
      const response = await api.get<unknown>(`/reports/${kind}${query.size ? `?${query.toString()}` : ""}`);
      setResult(response.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Report could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    const query = new URLSearchParams();
    if (dateFrom.trim()) query.set("dateFrom", dateFrom.trim());
    if (dateTo.trim()) query.set("dateTo", dateTo.trim());
    setResult(null);
    setSubmittedQuery(query.toString());
    await fetchReport(query.toString());
  }

  return (
    <Page>
      <Heading eyebrow="INSIGHTS & ANALYSIS" title="Reports" description="Generate live analytics from your management workspace." onBack={onBack} />
      <Card className="mb-4">
        <SectionTitle title="Choose a report" />
        <Text className="mb-2 text-xs text-brand-muted dark:text-slate-400">Filters are validated against your access scope.</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {reportOptions.map(([value, label]) => (
            <Pressable
              key={value}
              disabled={busy}
              onPress={() => { setKind(value); setResult(null); }}
              className={`rounded-full px-3 py-2 ${kind === value ? "bg-brand-navy" : "bg-brand-canvas dark:bg-slate-950"}`}
            >
              <Text className={`text-xs font-semibold ${kind === value ? "text-white" : "text-brand-ink dark:text-slate-100"}`}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="From date (YYYY-MM-DD)" onChangeText={setDateFrom} placeholder="Optional" value={dateFrom} />
        <Field label="To date (YYYY-MM-DD)" onChangeText={setDateTo} placeholder="Optional" value={dateTo} />
        {error ? <ErrorNotice message={error} /> : null}
        <ActionButton label={busy ? "Generating…" : "Generate report"} icon={RefreshCw} disabled={busy} onPress={() => void generate()} />
      </Card>
      <Card>
        <SectionTitle title={reportOptions.find(([value]) => value === kind)?.[1] ?? "Report results"} />
        {busy ? <LoadingState label="Generating report…" /> : result !== null ? (
          <ReportAnalysis kind={kind} data={result} onPage={page => void fetchReport(submittedQuery, page)} busy={busy} />
        ) : <EmptyState label="Your report will appear here" />}
      </Card>
    </Page>
  );
}

function RolesScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const canManage = (typeof user?.role === "string" ? user.role : user?.role?.code) === "MD";
  const [roles, setRoles] = useState<RecordValue[]>([]);
  const [permissions, setPermissions] = useState<RecordValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!canManage) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const [roleResponse, permissionResponse] = await Promise.all([
        api.get<unknown>("/roles"),
        api.get<unknown>("/roles/permissions"),
      ]);
      setRoles(list(roleResponse.data).filter((role) => {
        const code = String(role.code ?? role.name ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
        const name = String(role.name ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
        return !["ADMIN_HEAD", "MH", "MARKETING_HEAD"].some((hidden) => code === hidden || name === hidden);
      }));
      setPermissions(list(permissionResponse.data));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load roles and permissions.");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => { void load(); }, [load]);
  if (!canManage) return <Page><Heading eyebrow="ACCESS CONTROL" title="Roles & permissions" onBack={onBack}/><Text>Only MD can manage roles and permissions.</Text></Page>;
  return (
    <Page refresh={{ refreshing: loading, onRefresh: () => void load() }}>
      <Heading eyebrow="ACCESS CONTROL" title="Roles & permissions" description="Review configured roles and capabilities for your account." onBack={onBack} />
      {error ? <ErrorNotice message={error} onRetry={() => void load()} /> : null}
      <Card className="mb-4">
        <SectionTitle title={`Configured roles · ${roles.length}`} />
        {loading && !roles.length ? <LoadingState /> : roles.length ? (
          <View className="gap-2">
            {roles.map((role, index) => (
              <View key={String(role._id ?? index)} className="rounded-xl border border-brand-line dark:border-slate-700 p-3.5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-bold text-brand-ink dark:text-slate-100">{String(role.name ?? "Role")}</Text>
                  <Text className={`text-[10px] font-semibold ${role.isActive === false ? "text-brand-muted dark:text-slate-400" : "text-emerald-700"}`}>
                    {role.isActive === false ? "Inactive" : "Active"}
                  </Text>
                </View>
                <Text className="mt-1 text-[10px] text-brand-muted dark:text-slate-400">{String(role.code ?? "—")}</Text>
                <Text className="mt-2 text-xs leading-5 text-brand-ink dark:text-slate-100">
                  {Array.isArray(role.permissions) ? role.permissions.map((item) => typeof item === "object" && item && "code" in item ? String(item.code) : String(item)).join(", ") || "No permissions listed" : "No permissions listed"}
                </Text>
              </View>
            ))}
          </View>
        ) : <EmptyState label="No roles are available for this account." />}
      </Card>
      <Card>
        <SectionTitle title={`Permissions · ${permissions.length}`} />
        <View className="flex-row flex-wrap gap-2">
          {permissions.map((permission, index) => (
            <Text key={String(permission._id ?? index)} className="rounded-full bg-indigo-50 px-3 py-2 text-[10px] font-semibold text-brand-navy">
              {String(permission.code ?? `${permission.module ?? ""}.${permission.action ?? ""}`)}
            </Text>
          ))}
        </View>
      </Card>
    </Page>
  );
}

function SessionsScreen({ onBack }: { onBack: () => void }) {
  const [sessions, setSessions] = useState<RecordValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revoking, setRevoking] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<unknown>("/auth/sessions");
      const data = response.data;
      setSessions(Array.isArray(data) ? list(data) : data && typeof data === "object" && "sessions" in data ? list(data.sessions) : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load active sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function revoke(session: RecordValue) {
    const id = String(session._id ?? session.id ?? "");
    if (!id) {
      setError("This session does not have a revocable identifier.");
      return;
    }
    setRevoking(id);
    setError("");
    try {
      await api.delete(`/auth/sessions/${encodeURIComponent(id)}`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not revoke this session.");
    } finally {
      setRevoking("");
    }
  }

  return (
    <Page refresh={{ refreshing: loading, onRefresh: () => void load() }}>
      <Heading eyebrow="ACCOUNT SECURITY" title="Active sessions" description="Review devices signed in to your account and revoke sessions you don’t recognize." onBack={onBack} />
      <Card>
        <SectionTitle title="Signed-in devices" action={<ShieldCheck size={18} color="#17247a" />} />
        {error ? <ErrorNotice message={error} onRetry={() => void load()} /> : null}
        {loading && !sessions.length ? <LoadingState /> : sessions.length ? sessions.map((session, index) => (
          <View key={String(session._id ?? session.id ?? index)} className="mb-3 flex-row items-center rounded-xl border border-brand-line dark:border-slate-700 p-3">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
              <ShieldCheck size={18} color="#17247a" />
            </View>
            <View className="flex-1 pr-2">
              <Text numberOfLines={1} className="text-xs font-bold text-brand-ink dark:text-slate-100">{String(session.deviceName ?? session.userAgent ?? "Browser session")}</Text>
              <Text className="mt-1 text-[10px] text-brand-muted dark:text-slate-400">{String(session.createdAt ?? session.lastUsedAt ?? "Session active")}</Text>
            </View>
            <Pressable
              accessibilityLabel="Revoke session"
              disabled={Boolean(revoking)}
              onPress={() => void revoke(session)}
              className="h-9 w-9 items-center justify-center rounded-lg bg-red-50"
            >
              <LogOut size={15} color="#b91c1c" />
            </Pressable>
          </View>
        )) : <EmptyState label="No session details are available." />}
      </Card>
      <Text className="mt-3 px-1 text-[10px] leading-4 text-brand-muted dark:text-slate-400">Revoke a device to end its access to your account.</Text>
    </Page>
  );
}

export default function DirectoryScreens({ type, onBack }: { type: ModuleKey; onBack: () => void }) {
  if (type === "geography") return <GeographyScreen onBack={onBack} />;
  if (type === "reports") return <ReportsScreen onBack={onBack} />;
  if (type === "roles") return <RolesScreen onBack={onBack} />;
  if (type === "sessions") return <SessionsScreen onBack={onBack} />;
  return null;
}
