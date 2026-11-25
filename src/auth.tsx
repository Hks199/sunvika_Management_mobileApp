import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { unregisterCpPush } from "./cp-push";
import { api, refreshAccessToken, tokenStore } from "./api";
import type { User } from "./types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function userFrom(data: unknown): User | null {
  if (!data || typeof data !== "object") return null;
  const value = data as Record<string, unknown>;
  const candidate = (value.employee ?? value.user ?? value) as User;
  return candidate && (candidate.email || candidate._id || candidate.id) ? candidate : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const response = await api.get<unknown>("/auth/me");
    setUser(userFrom(response.data));
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await tokenStore.restore();
        if (await refreshAccessToken()) await reload();
      } catch {
        await tokenStore.set(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [reload]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.post<{ accessToken?: string; employee?: User; user?: User }>(
      "/auth/login",
      { identifier: email.trim(), password },
    );
    if (!result.data?.accessToken) throw new Error("The API did not return an access token.");
    await tokenStore.set(result.data.accessToken);
    try {
      await reload();
    } catch {
      const fallbackUser = userFrom(result.data);
      if (!fallbackUser) throw new Error("Signed in, but the account profile could not be loaded.");
      setUser(fallbackUser);
    }
  }, [reload]);

  const signOut = useCallback(async () => {
    try {
      await unregisterCpPush();
      await api.post("/auth/logout");
    } finally {
      await tokenStore.set(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, signIn, signOut, reload }), [user, loading, signIn, signOut, reload]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
