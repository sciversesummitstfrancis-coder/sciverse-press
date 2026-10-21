import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "./api";

export interface Me { id: string; email: string; name: string; role: string }
const Ctx = createContext<{ me: Me | null; loading: boolean; reload: () => void }>({ me: null, loading: true, reload: () => {} });
export const useMe = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = () => {
    if (!localStorage.getItem("sp_token")) { setMe(null); setLoading(false); return; }
    setLoading(true);
    apiFetch("/me").then((m) => { setMe(m as Me); setLoading(false); }).catch(() => { setMe(null); setLoading(false); });
  };
  useEffect(reload, []);
  return <Ctx.Provider value={{ me, loading, reload }}>{children}</Ctx.Provider>;
}

export function useFetch<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    setLoading(true); setError(null);
    apiFetch(path).then((d: unknown) => { setData(d as T); setLoading(false); })
      .catch((e: unknown) => { setError(String((e as Error).message || e)); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);
  return { data, error, loading, retry: () => setTick((t) => t + 1) };
}

export function Loading() {
  return <div className="panel" aria-busy="true"><div className="skel" /><div className="skel" style={{ marginTop: 8, width: "60%" }} /></div>;
}
export function Err({ msg }: { msg: string }) {
  return <div className="panel" role="alert"><span className="bad">Something went wrong —</span> {msg} <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => location.reload()}>Retry</button></div>;
}
export function Empty({ msg }: { msg: string }) {
  return <div className="empty" role="status"><b>Nothing here yet</b>{msg || ""}</div>;
}
export function time_fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch { return iso; }
}
