import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  ContactRound,
  FileText,
  RefreshCw,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import { api } from "../api";
import { useAuth } from "../auth";
import type { RecordValue, ScreenKey } from "../types";
import { Card, ErrorNotice, Heading, LoadingState, Page, SectionTitle } from "../ui";

function object(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
}

function rows(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.filter((row): row is RecordValue => Boolean(row) && typeof row === "object") : [];
}

function count(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "—";
}

const focusItems: Array<{ title: string; caption: string; screen: ScreenKey; icon: LucideIcon; tone: string }> = [
  { title: "Lead follow-ups", caption: "Review upcoming and overdue follow-ups", screen: "leads", icon: CalendarClock, tone: "bg-emerald-50" },
  { title: "Team activity", caption: "View employees and reporting hierarchy", screen: "employees", icon: BriefcaseBusiness, tone: "bg-indigo-50" },
  { title: "Service renewals", caption: "Review upcoming AMC renewals and service", screen: "amc", icon: BadgeCheck, tone: "bg-orange-50" },
];

export default function DashboardScreen({ onNavigate }: { onNavigate: (screen: ScreenKey) => void }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<RecordValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<unknown>("/dashboard/summary");
      setSummary(object(response.data));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const leads = object(summary?.leads);
  const customers = object(summary?.customers);
  const quotations = object(summary?.quotations);
  const branches = rows(summary?.branchPerformance);
  const maxLeads = Math.max(1, ...branches.map((branch) => typeof branch.leads === "number" ? branch.leads : 0));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const metrics: Array<{ title: string; value: unknown; icon: LucideIcon; tint: string }> = [
    { title: "Total leads", value: leads.total, icon: ContactRound, tint: "bg-indigo-50 text-brand-navy" },
    { title: "Customers", value: customers.total, icon: Users, tint: "bg-emerald-50 text-emerald-700" },
    { title: "Site visits", value: summary?.siteVisits, icon: CalendarClock, tint: "bg-orange-50 text-orange-700" },
    { title: "Quotations", value: quotations.total, icon: FileText, tint: "bg-violet-50 text-violet-700" },
  ];

  return (
    <Page refresh={{ refreshing: loading, onRefresh: () => void load() }}>
      <View className="mb-5 flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="mb-1 text-[10px] font-bold tracking-[1.7px] text-brand-navy">YOUR BUSINESS AT A GLANCE</Text>
          <Text className="text-[26px] font-bold leading-8 text-brand-ink">
            {greeting}, {user?.firstName || "there"} <Text className="text-brand-orange">✳</Text>
          </Text>
          <Text className="mt-1 text-xs leading-5 text-brand-muted">Live totals and branch performance within your account scope.</Text>
        </View>
        <Pressable onPress={() => void load()} className="mt-1 h-10 w-10 items-center justify-center rounded-xl border border-brand-line bg-white">
          <RefreshCw size={17} color="#17247a" />
        </Pressable>
      </View>

      {error ? <ErrorNotice message={error} onRetry={() => void load()} /> : null}
      <View className="mb-5 flex-row flex-wrap justify-between gap-y-3">
        {metrics.map(({ title, value, icon: Icon, tint }) => (
          <Card key={title} className="w-[48%] p-3.5">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xs font-medium text-brand-muted">{title}</Text>
              <View className={`h-9 w-9 items-center justify-center rounded-xl ${tint.split(" ")[0]}`}>
                <Icon size={17} color={tint.includes("emerald") ? "#047857" : tint.includes("orange") ? "#c65a0a" : tint.includes("violet") ? "#6d28d9" : "#17247a"} />
              </View>
            </View>
            <Text className="text-[26px] font-bold text-brand-ink">{loading && !summary ? "…" : count(value)}</Text>
            <Text className="mt-1 text-[10px] text-brand-muted">Scoped to your access</Text>
          </Card>
        ))}
      </View>

      <Card className="mb-4">
        <SectionTitle
          title="Branch pipeline"
          action={
            <View className="flex-row items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1">
              <View className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              <Text className="text-[9px] font-bold tracking-wide text-emerald-800">LIVE</Text>
            </View>
          }
        />
        <Text className="mb-4 text-xs text-brand-muted">Leads and conversions from the dashboard API</Text>
        {loading && !summary ? <LoadingState label="Loading branch performance…" /> : branches.length ? (
          branches.slice(0, 8).map((branch, index) => {
            const total = typeof branch.leads === "number" ? branch.leads : 0;
            const converted = typeof branch.converted === "number" ? branch.converted : 0;
            return (
              <View key={String(branch._id ?? branch.name ?? index)} className="mb-4">
                <View className="mb-1.5 flex-row justify-between gap-2">
                  <Text numberOfLines={1} className="flex-1 text-xs font-semibold text-brand-ink">{String(branch.name ?? "Unassigned branch")}</Text>
                  <Text className="text-[10px] text-brand-muted">{count(converted)} converted · {count(total)} leads</Text>
                </View>
                <View className="h-2 overflow-hidden rounded-full bg-indigo-50">
                  <View className="h-full rounded-full bg-brand-navy" style={{ width: `${Math.min(100, total / maxLeads * 100)}%` }} />
                </View>
              </View>
            );
          })
        ) : <Text className="py-5 text-center text-sm text-brand-muted">No branch performance data is available for this account.</Text>}
      </Card>

      <Card className="mb-4">
        <SectionTitle title="Today’s focus" />
        <Text className="mb-3 text-xs text-brand-muted">Open your live work queues</Text>
        {focusItems.map(({ title, caption, screen, icon: Icon, tone }) => (
          <Pressable
            key={screen}
            onPress={() => onNavigate(screen)}
            className="mb-2 flex-row items-center rounded-xl border border-brand-line p-3"
          >
            <View className={`mr-3 h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
              <Icon size={18} color="#17247a" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-brand-ink">{title}</Text>
              <Text className="mt-0.5 text-[10px] text-brand-muted">{caption}</Text>
            </View>
            <ArrowUpRight size={16} color="#78819b" />
          </Pressable>
        ))}
        <Pressable onPress={() => onNavigate("reports")} className="mt-2 flex-row items-center self-start">
          <Text className="text-xs font-bold text-brand-navy">Explore reports</Text>
          <ArrowUpRight size={14} color="#17247a" />
        </Pressable>
      </Card>

      <Card className="border-brand-navy bg-brand-deep">
        <Text className="text-[10px] font-bold tracking-[1.5px] text-orange-300">ONE TEAM, ONE VIEW</Text>
        <Text className="mt-2 text-xl font-bold text-white">Make every interaction count.</Text>
        <Text className="mt-2 text-xs leading-5 text-indigo-100">
          Follow the customer journey from lead to quotation, service, and long-term support.
        </Text>
      </Card>
    </Page>
  );
}
