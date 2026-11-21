import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform, Pressable, Text } from "react-native";
import { useColorScheme } from "nativewind";
import * as SecureStore from "expo-secure-store";
import { Moon, Sun } from "lucide-react-native";
import { StatusBar } from "expo-status-bar";

type Theme = "light" | "dark";
const storageKey = "sunvika-appearance";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const saved = Platform.OS === "web" ? globalThis.localStorage?.getItem(storageKey) : await SecureStore.getItemAsync(storageKey);
        if (active && (saved === "light" || saved === "dark")) setColorScheme(saved);
      } catch { /* Keep the device appearance if storage is unavailable. */ }
      finally { if (active) setReady(true); }
    }
    void load();
    return () => { active = false; };
  }, []);
  const theme: Theme = colorScheme === "dark" ? "dark" : "light";
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setColorScheme(next);
    try {
      if (Platform.OS === "web") globalThis.localStorage?.setItem(storageKey, next);
      else void SecureStore.setItemAsync(storageKey, next).catch(() => {});
    } catch { /* The selection still applies for this session. */ }
  }
  return <ThemeContext.Provider value={{ theme, toggle }}>{ready ? <><StatusBar style={theme === "dark" ? "light" : "dark"} />{children}</> : null}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={toggle} hitSlop={6} className="h-10 w-10 items-center justify-center rounded-xl border border-brand-line bg-white dark:border-slate-600 dark:bg-slate-800">
    {theme === "dark" ? <Sun size={19} color="#ffc07e" /> : <Moon size={19} color="#080875" />}
  </Pressable>;
}

export function AppearanceSetting() {
  const { theme, toggle } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`Appearance: ${theme} mode. Switch to ${theme === "dark" ? "light" : "dark"} mode`} onPress={toggle} className="mb-5 flex-row items-center justify-between rounded-2xl border border-brand-line bg-white p-4 dark:border-slate-600 dark:bg-slate-800">
    <Text className="text-sm font-semibold text-brand-ink dark:text-slate-100">Appearance · {theme === "dark" ? "Dark" : "Light"}</Text>
    {theme === "dark" ? <Sun size={19} color="#ffc07e" /> : <Moon size={19} color="#080875" />}
  </Pressable>;
}
