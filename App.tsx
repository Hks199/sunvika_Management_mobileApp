import ProfileScreen from "./src/screens/ProfileScreen";
import CallingAvailability from "./src/components/CallingAvailability";
import StateCandidatesScreen from "./src/screens/StateCandidatesScreen";
import HoldCustomersScreen from './src/screens/HoldCustomersScreen';
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  ContactRound,
  FileText,
  Home,
  LogOut,
  MoreHorizontal,
  ShieldCheck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import "./global.css";
import { api } from "./src/api";
import { AuthProvider, useAuth } from "./src/auth";
import DashboardScreen from "./src/screens/DashboardScreen";
import AnnouncementsScreen from "./src/screens/AnnouncementsScreen";
import AnnouncementBar from "./src/components/AnnouncementBar";
import { ANNOUNCEMENT_PUBLISHERS } from "./src/announcements";
import QueriesScreen from "./src/screens/QueriesScreen";
import NotificationBell from "./src/components/NotificationBell";
import { QUERY_ROLES } from "./src/queries";
import CpRemindersScreen from "./src/screens/CpRemindersScreen";
import CallingReportsScreen from "./src/screens/CallingReportsScreen";
import CallingListsScreen from "./src/screens/CallingListsScreen";
import DirectoryScreens from "./src/screens/DirectoryScreens";
import LoginScreen from "./src/screens/LoginScreen";
import RecordsScreen from "./src/screens/RecordsScreen";
import type { ModuleKey, ScreenKey } from "./src/types";
import { Card, Page } from "./src/ui";
import { AppearanceSetting, ThemeProvider, useTheme } from "./src/theme";

type AppScreen = ScreenKey | "more" | "profile";

const moduleLabels: Record<ModuleKey, string> = {
  announcements: "Announcements",
  queries: "Queries",
  "cp-notifications": "CP notifications",
  leads: "Leads",
  visits: "Site visits",
  customers: "Customers",
  "hold-customers": "Hold customers",
  "document-review": "New customers",
  quotations: "Quotations",
  amc: "AMC contracts",
  "calling-reports": "Calling reports",
  "calling-lists": "CP calling lists",
  "state-candidates": "Candidate sheets",
  "channel-partners": "Channel Partners",
  employees: "Employees",
  geography: "Geography",
  reports: "Reports",
  roles: "Roles & permissions",
  audit: "Audit log",
  sessions: "Active sessions",
};

const sections: Array<{
  title: string;
  items: Array<{ key: ModuleKey; icon: LucideIcon }>;
}> = [
  {
    title: "WORKSPACE",
    items: [
      { key: "leads", icon: ContactRound },
      { key: "visits", icon: CalendarClock },
      { key: "customers", icon: Users },
      { key: "hold-customers", icon: Users },
      { key: "document-review", icon: ShieldCheck },
      { key: "quotations", icon: FileText },
      { key: "amc", icon: Wrench },
    ],
  },
  {
    title: "ORGANIZATION",
    items: [
      { key: "announcements", icon: ContactRound },
      { key: "cp-notifications", icon: ContactRound },
      { key: "queries", icon: ContactRound },
      { key: "calling-reports", icon: BarChart3 },
      { key: "calling-lists", icon: ContactRound },
      { key: "state-candidates", icon: ContactRound },
      { key: "employees", icon: BriefcaseBusiness },
      { key: "channel-partners", icon: Users },
      { key: "geography", icon: Building2 },
      { key: "reports", icon: BarChart3 },
    ],
  },
  {
    title: "ADMINISTRATION",
    items: [
      { key: "roles", icon: ShieldCheck },
      { key: "audit", icon: Activity },
      { key: "sessions", icon: ShieldCheck },
    ],
  },
];

function MoreScreen({ onNavigate }: { onNavigate: (screen: ScreenKey | "profile") => void }) {
  const { user } = useAuth();
  const role = typeof user?.role === "string" ? user.role : user?.role?.code;
  return (
    <Page contentClassName="pt-5">
      <Text className="mb-1 text-[10px] font-bold tracking-[1.7px] text-brand-navy dark:text-indigo-200">YOUR WORKSPACE</Text>
      <Text className="mb-1 text-[27px] font-bold text-brand-ink dark:text-slate-100">More</Text>
      <Text className="mb-5 text-xs leading-5 text-brand-muted dark:text-slate-400">Organization tools, reports, and account security.</Text>
      <AppearanceSetting />
      <Pressable accessibilityRole="button" onPress={() => onNavigate("profile")} className="mb-5 rounded-xl border border-brand-line dark:border-slate-700 bg-white dark:bg-slate-800 p-4"><Text className="font-bold text-brand-ink dark:text-slate-100">My profile</Text></Pressable>
      {sections.map((section) => (
          <View key={section.title} className="mb-5">
            <Text className="mb-2 ml-1 text-[10px] font-bold tracking-[1.4px] text-brand-muted dark:text-slate-400">{section.title}</Text>
            <Card className="p-1">
              {section.items.filter(item => role === "RM" && ["reports","audit","amc"].includes(item.key) ? false : role === "CP" && ["employees","channel-partners","amc","reports","audit"].includes(item.key) ? false : item.key === "state-candidates" ? ["MD", "MIS", "CP_HEAD"].includes(role ?? "") : item.key === "document-review" ? ["MD", "CP_HEAD", "RM", "MIS"].includes(role ?? "") : item.key === "hold-customers" ? role === "CP" : (item.key === "calling-reports" || item.key === "cp-notifications") ? ["MD", "MIS", "CP_HEAD", "RM"].includes(role ?? "") : item.key === "announcements" ? ANNOUNCEMENT_PUBLISHERS.includes(role ?? "") : item.key === "roles" ? role === "MD" : item.key === "queries" ? QUERY_ROLES.includes(role ?? "") : item.key !== "calling-lists" || ["MD", "MIS", "CP_HEAD", "RM"].includes(role ?? "")).map(({ key, icon: Icon }, index) => (
                <Pressable
                  key={key}
                  onPress={() => onNavigate(key)}
                  className={`flex-row items-center px-3 py-3.5 ${index ? "border-t border-brand-line dark:border-slate-700" : ""}`}
                >
                  <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
                    <Icon size={17} color="#17247a" />
                  </View>
                  <Text className="flex-1 text-sm font-semibold text-brand-ink dark:text-slate-100">{moduleLabels[key]}</Text>
                  <Text className="text-lg text-brand-muted dark:text-slate-400">â€º</Text>
                </Pressable>
              ))}
            </Card>
          </View>
      ))}
    </Page>
  );
}

function Workspace() {
  const { user, loading, signOut } = useAuth();
  const { theme } = useTheme();
  const [queryLink, setQueryLink] = useState({ id: "", version: 0 });
  const [screen, setScreen] = useState<AppScreen>("overview");
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [signOutError, setSignOutError] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [rmActive,setRmActive] = useState(false);
  const [profileImageVersion, setProfileImageVersion] = useState(0);

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout>;
    const employeeId = user?.id ?? user?._id;
    setProfileImageUrl("");

    if (!employeeId) return () => { active = false; };

    const loadProfileImage = async () => {
      try {
        const response = await api.get<{ url?: string }>(
          "/employees/me/profile-image-url",
        );
        if (active) setProfileImageUrl(response.data?.url ?? "");
      } catch {
        if (active) setProfileImageUrl("");
      } finally {
        if (active) refreshTimer = setTimeout(() => void loadProfileImage(), 240_000);
      }
    };

    void loadProfileImage();
    return () => {
      active = false;
      clearTimeout(refreshTimer);
    };
  }, [user?.id, user?._id, profileImageVersion]);

  useEffect(() => {
    let active = true;
    void api.get<unknown>("/health")
      .then(() => { if (active) setApiOnline(true); })
      .catch(() => { if (active) setApiOnline(false); });
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-canvas dark:bg-slate-950">
        <ActivityIndicator size="large" color="#17247a" />
        <Text className="mt-3 text-sm text-brand-muted dark:text-slate-400">Loading your workspaceâ€¦</Text>
      </View>
    );
  }
  if (!user) return <LoginScreen />;

  const isRm=(typeof user.role === "string" ? user.role : user.role?.code) === "RM";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || "Team member";
  const initials = name.trim().slice(0, 1).toUpperCase();
  const title = screen === "overview" ? "Overview" : screen === "more" ? "More" : screen === "profile" ? "My profile" : moduleLabels[screen];

  async function logout() {
    setSignOutError("");
    try {
      await signOut();
      setRmActive(false);
      setScreen("overview");
    } catch (cause) {
      setSignOutError(cause instanceof Error ? cause.message : "Unable to sign out.");
    }
  }

  function navigate(next: ScreenKey | "profile") {
    const role = typeof user?.role === "string" ? user.role : user?.role?.code;
    if (role === "RM" && ["reports","audit","amc"].includes(next)) return;
    if (role === "CP" && ["employees","channel-partners","amc","reports","audit"].includes(next)) return;
    if (next === "queries") setQueryLink(current => ({ id: "", version: current.version + 1 }));
    setScreen(next);
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-canvas dark:bg-slate-950" edges={["top", "left", "right", "bottom"]}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <View className="z-10 flex-row items-center border-b border-brand-line dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-brand-navy">
          <Text className="text-base font-bold text-white">S</Text>
        </View>
        <View className="flex-1">
          <Text className="text-[10px] font-semibold text-brand-muted dark:text-slate-400">SUNVIKA MANAGEMENT</Text>
          <Text numberOfLines={1} className="text-sm font-bold text-brand-ink dark:text-slate-100">{title}</Text>
        </View>
        <View className="mr-3 flex-row items-center rounded-full bg-brand-canvas dark:bg-slate-950 px-2.5 py-1.5">
          <View className={`mr-1.5 h-1.5 w-1.5 rounded-full ${apiOnline ? "bg-emerald-600" : apiOnline === false ? "bg-red-500" : "bg-amber-500"}`} />
          <Text className="text-[9px] font-semibold text-brand-ink dark:text-slate-100">
            {apiOnline === null ? "Checking" : apiOnline ? "API connected" : "API offline"}
          </Text>
        </View>
        {(!isRm||rmActive) && <NotificationBell onOpenThread={id => { setQueryLink(current => ({ id, version: current.version + 1 })); setScreen("queries"); }}/> }
        <Pressable accessibilityRole="button" accessibilityLabel="My profile" onPress={() => setScreen("profile")} className="mr-2 h-9 w-9 overflow-hidden items-center justify-center rounded-full bg-indigo-50">
          {profileImageUrl ? (
            <Image
              source={{ uri: profileImageUrl }}
              onError={() => setProfileImageUrl("")}
              resizeMode="cover"
              className="h-full w-full"
            />
          ) : (
            <Text className="text-sm font-bold text-brand-navy">{initials}</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityLabel="Sign out"
          onPress={() => void logout()}
          className="h-9 w-9 items-center justify-center rounded-lg"
        >
          <LogOut size={17} color="#78819b" />
        </Pressable>
      </View>
      {(!isRm||rmActive) && <AnnouncementBar/>}
      {isRm && <View className="px-4 pt-2"><CallingAvailability onChange={setRmActive}/></View>}
      {signOutError ? (
        <View className="bg-red-50 px-4 py-2">
          <Text className="text-xs text-red-800">{signOutError}</Text>
        </View>
      ) : null}
      <View className="flex-1">
        {isRm && !rmActive ? <Text className="p-5 text-brand-muted dark:text-slate-400">Activate availability to access the app.</Text> : screen === "profile" ? (
          <ProfileScreen onBack={() => setScreen("more")} onImageSaved={() => setProfileImageVersion(v => v + 1)} />
        ) : screen === "overview" ? (
          <DashboardScreen onNavigate={navigate} />
        ) : screen === "announcements" ? (
          <AnnouncementsScreen onBack={() => setScreen("more")}/>
        ) : screen === "queries" ? (
          <QueriesScreen key={queryLink.version} initialThread={queryLink.id} onBack={() => setScreen("more")}/>
        ) : screen === "cp-notifications" ? (
          <CpRemindersScreen onBack={() => setScreen("more")}/>
        ) : screen === "document-review" ? (
          <HoldCustomersScreen review onBack={() => setScreen("more")}/>
        ) : screen === "hold-customers" ? (
          <HoldCustomersScreen onBack={() => setScreen("more")}/>
        ) : screen === "calling-reports" ? (
          <CallingReportsScreen onBack={() => setScreen("more")}/>
        ) : screen === "state-candidates" ? (
          <StateCandidatesScreen onBack={() => setScreen("more")} />
        ) : screen === "calling-lists" ? (
          <CallingListsScreen onBack={() => setScreen("more")} />
        ) : screen === "more" ? (
          <MoreScreen onNavigate={navigate} />
        ) : screen === "geography" || screen === "reports" || screen === "roles" || screen === "sessions" ? (
          <DirectoryScreens type={screen} onBack={() => setScreen("more")} />
        ) : (
          <RecordsScreen
            key={screen}
            type={screen}
            onBack={() => setScreen(screen === "audit" ? "more" : "more")}
          />
        )}
      </View>
      <View className="flex-row border-t border-brand-line dark:border-slate-700 bg-white dark:bg-slate-800 px-2 pb-1 pt-2">
        <TabButton label="Overview" icon={Home} active={screen === "overview"} onPress={() => setScreen("overview")} />
        <TabButton label="Leads" icon={ContactRound} active={screen === "leads"} onPress={() => setScreen("leads")} />
        <TabButton label="Visits" icon={CalendarClock} active={screen === "visits"} onPress={() => setScreen("visits")} />
        {(typeof user.role === "string" ? user.role : user.role?.code) !== "CP" ? <TabButton label="Team" icon={Users} active={screen === "employees"} onPress={() => setScreen("employees")} /> : null}
        <TabButton label="More" icon={MoreHorizontal} active={screen === "more"} onPress={() => setScreen("more")} />
      </View>
    </SafeAreaView>
  );
}

function TabButton({
  label,
  icon: Icon,
  active,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} className="flex-1 items-center py-1.5">
      <Icon size={19} color={active ? (theme === "dark" ? "#c7d2fe" : "#17247a") : "#8991a8"} />
      <Text className={`mt-1 text-[9px] font-semibold ${active ? "text-brand-navy dark:text-indigo-200" : "text-brand-muted dark:text-slate-400"}`}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <Workspace />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
