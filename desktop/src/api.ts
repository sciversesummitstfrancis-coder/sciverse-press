import { createApiClient } from "@sciverse/shared";

/**
 * API base URL resolution.
 *
 * - `VITE_API_URL` (baked at build time) always wins.
 * - In dev the Vite server proxies `/api` to the backend, so the relative
 *   base works without CORS.
 * - In a packaged Tauri build there is no proxy, so we talk to the backend
 *   directly. The default is the local machine; it can be changed at runtime
 *   from the login screen and is persisted in localStorage.
 */
const STORAGE_KEY = "sp_api_base";

export const IS_TAURI =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

function detectDefaultBase(): string {
  if (import.meta.env.VITE_API_URL) return String(import.meta.env.VITE_API_URL);
  if (import.meta.env.DEV) return "/api";
  // Packaged app: talk to the local backend directly.
  const host = window.location.hostname || "localhost";
  return `http://${host}:4000`;
}

export function getApiBase(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
  } catch {
    /* storage unavailable (private mode) — fall through */
  }
  return detectDefaultBase();
}

export function setApiBase(url: string): void {
  const clean = url.trim().replace(/\/+$/, "");
  try {
    if (clean) localStorage.setItem(STORAGE_KEY, clean);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export const api = createApiClient({
  baseUrl: getApiBase(),
  getToken: () => localStorage.getItem("sp_token"),
});

export function setToken(t: string | null) {
  if (t) localStorage.setItem("sp_token", t);
  else localStorage.removeItem("sp_token");
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const t = localStorage.getItem("sp_token");
  const res = await fetch(getApiBase() + path, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (res.status === 401) {
    setToken(null);
    if (location.pathname !== "/login") location.href = "/login";
    throw new Error("session expired");
  }
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  const ct = res.headers.get("content-type") || "";
  return ct.includes("json") ? res.json() : res.text();
}
