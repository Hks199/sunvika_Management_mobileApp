import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { ApiEnvelope } from "./types";

const API_BASE = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:5000/api/v1" : "http://localhost:5000/api/v1")
).replace(/\/$/, "");
export const API_HOST = new URL(API_BASE).host;
const ACCESS_TOKEN_KEY = "sunvika.access-token";

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: async (token: string | null) => {
    // SecureStore is native-only. Browser sessions refresh using the HTTP-only cookie.
    if (Platform.OS === "web") {
      accessToken = token;
      return;
    }
    if (token) {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
      accessToken = token;
    } else {
      accessToken = null;
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    }
  },
  restore: async () => {
    if (Platform.OS === "web") return accessToken;
    accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    return accessToken;
  },
};

function messageFrom(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object" || !("message" in body)) return fallback;
  const message = typeof body.message === "string" ? body.message : fallback;
  const errors = "errors" in body && Array.isArray(body.errors)
    ? body.errors.map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "message" in item && typeof item.message === "string") {
          const field = "field" in item && typeof item.field === "string" ? `${item.field}: ` : "";
          return `${field}${item.message}`;
        }
        return "";
      }).filter(Boolean)
    : [];
  return errors.length ? `${message}: ${errors.join("; ")}` : message;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const body: unknown = await response.json().catch(() => null);

  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refreshAccessToken()) return request<T>(path, init, false);
    await tokenStore.set(null);
  }
  if (!response.ok) {
    const error = new Error(messageFrom(body, `Request failed (${response.status})`)) as Error & {
      status?: number;
      retryAfterSeconds?: number;
    };
    error.status = response.status;
    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      const retryDate = Date.parse(retryAfter);
      if (Number.isFinite(seconds) && seconds >= 0) error.retryAfterSeconds = seconds;
      else if (Number.isFinite(retryDate)) error.retryAfterSeconds = Math.max(0, Math.ceil((retryDate - Date.now()) / 1000));
    }
    if (error.retryAfterSeconds === undefined) {
      const rateLimit = response.headers.get("RateLimit");
      const reset = rateLimit?.match(/(?:^|[,;]\s*)reset=(\d+(?:\.\d+)?)/i)?.[1];
      if (reset) error.retryAfterSeconds = Math.ceil(Number(reset));
    }
    throw error;
  }
  return body as ApiEnvelope<T>;
}

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const result = await request<{ accessToken?: string }>(
        "/auth/refresh-token",
        { method: "POST" },
        false,
      );
      const token = result.data?.accessToken;
      if (!token) return false;
      await tokenStore.set(token);
      return true;
    } catch {
      await tokenStore.set(null);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function requestPdf(path: string, retry = true): Promise<ArrayBuffer> {
  const headers = new Headers({ Accept: "application/pdf" });
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_BASE}${path}`, { headers, credentials: "include", cache: "no-store", redirect: "error" });
  if (response.status === 401 && retry) {
    if (await refreshAccessToken()) return requestPdf(path, false);
    await tokenStore.set(null);
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(messageFrom(body, `PDF request failed (${response.status})`));
  }
  if (!response.headers.get("Content-Type")?.toLowerCase().includes("application/pdf")) throw new Error("The API did not return a PDF file.");
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength) throw new Error("The quotation PDF is empty.");
  return bytes;
}

export const api = {
  getPdf: (path: string) => requestPdf(path),
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) }),
  patch: <T,>(path: string, data: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  putBinary: <T,>(path: string, body: ArrayBuffer, contentType: string) =>
    request<T>(path, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body,
    }),
  delete: <T,>(path: string) => request<T>(path, { method: "DELETE" }),
};
