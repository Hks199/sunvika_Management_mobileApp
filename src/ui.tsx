import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { RefreshControl } from "react-native";
import { ChevronLeft, RefreshCw, type LucideIcon } from "lucide-react-native";
import { useTheme } from "./theme";

export function Page({
  children,
  className = "",
  contentClassName = "",
  refresh,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  refresh?: { refreshing: boolean; onRefresh: () => void };
}) {
  return (
    <ScrollView
      className={`flex-1 bg-brand-canvas dark:bg-slate-950 ${className}`}
      contentContainerClassName={`px-5 pb-8 pt-5 ${contentClassName}`}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refresh ? (
        <RefreshControl refreshing={refresh.refreshing} onRefresh={refresh.onRefresh} tintColor="#080875" />
      ) : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Heading({
  eyebrow,
  title,
  description,
  onBack,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  onBack?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View className="mb-5">
      {onBack ? (
        <Pressable onPress={onBack} className="mb-3 flex-row items-center self-start">
          <ChevronLeft size={17} color={theme === "dark" ? "#c7d2fe" : "#080875"} />
          <Text className="font-semibold text-brand-navy dark:text-indigo-200">Back</Text>
        </Pressable>
      ) : null}
      <Text className="mb-1 text-[10px] font-bold tracking-[1.7px] text-brand-navy dark:text-indigo-200">{eyebrow}</Text>
      <Text className="text-[27px] font-bold leading-8 text-brand-ink dark:text-slate-100">{title}</Text>
      {description ? <Text className="mt-1 text-[13px] leading-5 text-brand-muted dark:text-slate-400">{description}</Text> : null}
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  icon: Icon,
  kind = "primary",
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  kind?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const style = kind === "primary"
    ? "bg-brand-navy"
    : kind === "danger"
      ? "border border-red-200 bg-red-50"
      : "border border-brand-line dark:border-slate-700 bg-white dark:bg-slate-800";
  const textStyle = kind === "primary" ? "text-white" : kind === "danger" ? "text-red-700" : "text-brand-ink dark:text-slate-100";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`min-h-11 flex-row items-center justify-center gap-2 rounded-xl px-4 ${style} ${disabled ? "opacity-50" : ""}`}
    >
      {Icon ? <Icon size={16} color={kind === "primary" ? "#ffffff" : kind === "danger" ? "#b91c1c" : theme === "dark" ? "#e2e8f0" : "#171b4b"} /> : null}
      <Text className={`text-sm font-bold ${textStyle}`}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  leftIcon,
  rightAccessory,
  ...props
}: TextInputProps & { label: string; leftIcon?: ReactNode; rightAccessory?: ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-xs font-semibold text-brand-ink dark:text-slate-100">{label}</Text>
      <View className="min-h-12 flex-row items-center rounded-xl border border-brand-line dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5">
        {leftIcon ? <View className="mr-2">{leftIcon}</View> : null}
        <TextInput
          {...props}
          className={`flex-1 py-3 text-sm text-brand-ink dark:text-slate-100 ${props.className ?? ""}`}
          placeholderTextColor="#9aa1b5"
        />
        {rightAccessory ? <View className="ml-2">{rightAccessory}</View> : null}
      </View>
    </View>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-2xl border border-brand-line dark:border-slate-700 bg-white dark:bg-slate-800 p-4 ${className}`}>{children}</View>;
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5">
      <Text className="text-sm leading-5 text-red-800">{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} className="mt-2 self-start">
          <Text className="text-xs font-bold text-red-800">Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function LoadingState({ label = "Loadingâ€¦" }: { label?: string }) {
  return (
    <View className="items-center justify-center py-12">
      <ActivityIndicator color="#080875" />
      <Text className="mt-3 text-sm text-brand-muted dark:text-slate-400">{label}</Text>
    </View>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <View className="items-center rounded-xl bg-brand-canvas dark:bg-slate-950 px-4 py-8">
      <Text className="text-sm font-semibold text-brand-ink dark:text-slate-100">{label}</Text>
      <Text className="mt-1 text-center text-xs text-brand-muted dark:text-slate-400">Records will appear here when available to your account.</Text>
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-base font-bold text-brand-ink dark:text-slate-100">{title}</Text>
      {action}
    </View>
  );
}

export function RefreshAction({ onPress, loading = false }: { onPress: () => void; loading?: boolean }) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityLabel="Refresh"
      disabled={loading}
      onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-xl border border-brand-line dark:border-slate-700 bg-white dark:bg-slate-800"
    >
      <RefreshCw size={17} color={theme === "dark" ? "#c7d2fe" : "#080875"} />
    </Pressable>
  );
}
