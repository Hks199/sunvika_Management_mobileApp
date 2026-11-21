import { useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react-native";
import { API_HOST, api } from "../api";
import { useAuth } from "../auth";
import { ActionButton, ErrorNotice, Field } from "../ui";
import { ThemeToggle } from "../theme";

const logo = require("../../assets/SUNVIKA_Logo.png");

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retrySeconds, setRetrySeconds] = useState(0);
  const submitting = useRef(false);

  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = setTimeout(() => setRetrySeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [retrySeconds]);

  function formatWait(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return minutes ? `${minutes}m ${String(remaining).padStart(2, "0")}s` : `${remaining}s`;
  }

  async function submit() {
    if (submitting.current || retrySeconds > 0) return;
    setError("");
    setNotice("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254) {
      setError("Enter a valid work email address.");
      return;
    }
    if (!forgot && (!password || password.length > 128)) {
      setError("Enter your password.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      if (forgot) {
        const result = await api.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
        setNotice(result.message || "If the account exists, password reset instructions will be sent.");
      } else {
        await signIn(email, password);
      }
    } catch (cause) {
      const requestError = cause instanceof Error ? cause as Error & {
        status?: number;
        retryAfterSeconds?: number;
      } : null;
      if (requestError?.status === 429) {
        const fallbackWait = forgot ? 60 * 60 : 15 * 60;
        setRetrySeconds(Math.max(1, Math.ceil(requestError.retryAfterSeconds ?? fallbackWait)));
        setError(forgot
          ? "Too many recovery requests. The server has temporarily limited requests. Wait before trying again."
          : "Too many sign-in attempts. The server has temporarily limited login requests. Wait before trying again.");
      } else {
        setError(requestError?.message ?? "Unable to complete this request.");
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-brand-canvas dark:bg-slate-950"
    >
      <View className="flex-1 justify-center px-6 py-10">
        <View className="mb-4 items-end"><ThemeToggle /></View>
        <View className="mb-7 items-center">
          <View className="mb-8 w-full items-center rounded-2xl bg-white px-5 py-4 shadow-sm">
            <Image source={logo} resizeMode="contain" className="h-14 w-56" />
          </View>
          <View className="w-full">
            <Text className="mb-2 text-[10px] font-bold tracking-[1.7px] text-brand-navy dark:text-indigo-200">
              {forgot ? "ACCOUNT RECOVERY" : "WELCOME BACK"}
            </Text>
            <Text className="text-[28px] font-bold leading-9 text-brand-ink dark:text-slate-100">
              {forgot ? "Reset your password" : "Sign in to your workspace"}
            </Text>
            <Text className="mt-2 text-sm leading-5 text-brand-muted dark:text-slate-400">
              {forgot
                ? "We’ll send instructions if an account matches that address."
                : "Enter your work credentials to continue."}
            </Text>
          </View>
        </View>
        <View className="rounded-2xl border border-brand-line dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <Field
            label="Work email"
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect={false}
            keyboardType="email-address"
            maxLength={254}
            onChangeText={setEmail}
            placeholder="you@company.com"
            value={email}
            leftIcon={<Mail size={17} color="#78819b" />}
          />
          {!forgot ? (
            <Field
              label="Password"
              autoCapitalize="none"
              autoComplete="current-password"
              autoCorrect={false}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              value={password}
              leftIcon={<LockKeyhole size={17} color="#78819b" />}
              rightAccessory={
                <Pressable
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  onPress={() => setShowPassword((visible) => !visible)}
                  hitSlop={8}
                >
                  {showPassword ? <EyeOff size={18} color="#78819b" /> : <Eye size={18} color="#78819b" />}
                </Pressable>
              }
              onSubmitEditing={() => void submit()}
            />
          ) : null}
          {error ? <ErrorNotice message={error} /> : null}
          {notice ? (
            <View className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <Text className="text-sm leading-5 text-emerald-800">{notice}</Text>
            </View>
          ) : null}
          <ActionButton
            label={busy ? "Please wait…" : retrySeconds > 0 ? `Try again in ${formatWait(retrySeconds)}` : forgot ? "Send recovery email" : "Sign in"}
            icon={ArrowRight}
            disabled={busy || retrySeconds > 0}
            onPress={() => void submit()}
          />
          <Pressable
            onPress={() => {
              setForgot((current) => !current);
              setError("");
              setNotice("");
            }}
            className="mt-4 items-center py-2"
          >
            <Text className="text-sm font-semibold text-brand-navy dark:text-indigo-200">
              {forgot ? "Back to sign in" : "Forgot password?"}
            </Text>
          </Pressable>
        </View>
        <View className="mt-6 flex-row items-center justify-center gap-2">
          <ShieldCheck size={14} color="#78819b" />
          <Text className="text-xs text-brand-muted dark:text-slate-400">Secure, encrypted access</Text>
        </View>
        <Text className="mt-2 text-center text-[10px] text-brand-muted dark:text-slate-400">API target: {API_HOST}</Text>
        <View className="mt-8 rounded-2xl bg-brand-deep px-5 py-4">
          <Text className="text-[10px] font-bold tracking-[1.5px] text-orange-300">SUNVIKA MANAGEMENT</Text>
          <Text className="mt-2 text-lg font-bold text-white">Good work moves us forward.</Text>
          <Text className="mt-1 text-xs leading-5 text-indigo-100">
            Your team and every customer relationship, together in one place.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
