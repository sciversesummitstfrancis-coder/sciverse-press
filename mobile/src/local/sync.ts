/**
 * Optional network layer.
 *
 * Everything here is best-effort: every call has a hard timeout and failures
 * are swallowed, so the app never hangs waiting for a server that isn't
 * there. The local SQLite database is the source of truth; this module only
 * pushes local changes up and pulls fresh copies down when a server happens
 * to be reachable.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const API_URL_KEY = 'sciverse_api_url';
export const TOKEN_KEY = 'sciverse_token';

/**
 * The app is local-first: there is NO default server. The backend is purely
 * optional and is only ever contacted when a server URL has been explicitly
 * configured, so the app never blocks on (or points at) localhost.
 */
export const DEFAULT_API_URL = '';

/** Kept for display/back-compat; the live value is resolved by getApiBase(). */
export const API_URL = DEFAULT_API_URL;

let cachedBase: string | null = null;
let cachedExplicit = false;

/** Normalise a user-entered URL: trim, drop trailing slashes, add scheme. */
function normalizeBase(url: string): string {
  let u = url.trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = `http://${u}`;
  return u;
}

/** Resolve the current backend base URL (stored override, else build default). */
export async function getApiBase(): Promise<string> {
  if (cachedBase) return cachedBase;
  const stored = await AsyncStorage.getItem(API_URL_KEY);
  cachedBase = (stored && normalizeBase(stored)) || DEFAULT_API_URL;
  cachedExplicit = !!stored;
  return cachedBase;
}

/** True when the user explicitly pointed the app at a server. */
export async function hasExplicitServer(): Promise<boolean> {
  if (cachedBase) return cachedExplicit;
  await getApiBase();
  return cachedExplicit;
}

/** Persist a user-supplied backend URL (empty string resets to the default). */
export async function setApiBase(url: string): Promise<void> {
  const clean = normalizeBase(url);
  cachedBase = clean || DEFAULT_API_URL;
  cachedExplicit = !!clean;
  if (clean) await AsyncStorage.setItem(API_URL_KEY, clean);
  else await AsyncStorage.removeItem(API_URL_KEY);
}

export async function getToken(): Promise<string | null> {
  try {
    const t = await SecureStore.getItemAsync(TOKEN_KEY);
    if (t) return t;
  } catch {
    // SecureStore unavailable (e.g. web) — fall back
  }
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string | null): Promise<void> {
  if (token === null) {
    try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch { /* noop */ }
    await AsyncStorage.removeItem(TOKEN_KEY);
    return;
  }
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Fetch with a hard timeout. React Native's fetch has no default timeout, so
 * an unreachable host would otherwise hang the UI for ~75 seconds.
 */
export async function request<T>(
  path: string,
  base: string,
  init: RequestInit = {},
  auth = true,
  timeoutMs = 8000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((init.headers as Record<string, string>) ?? {}),
    };
    if (auth) {
      const token = await getToken();
      if (token && !token.startsWith('local:')) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new HttpError(res.status, `${init.method ?? 'GET'} ${path} → ${res.status} ${text.slice(0, 200)}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Quick reachability probe. Never throws. */
export async function ping(base: string, timeoutMs = 1500): Promise<boolean> {
  try {
    await request<{ ok: boolean }>('/health', base, {}, false, timeoutMs);
    return true;
  } catch {
    return false;
  }
}
