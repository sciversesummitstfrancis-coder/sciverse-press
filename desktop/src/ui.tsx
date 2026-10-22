import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { apiFetch } from "./api";

export interface Me { id: string; email: string; name: string; role: string }
const Ctx = createContext<{ me: Me | null; loading: boolean; reload: () => void }>({ me: null, loading: true, reload: () => {} });
export const useMe = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    if (!localStorage.getItem("sp_token")) { setMe(null); setLoading(false); return; }
    setLoading(true);
    apiFetch("/me")
      .then((m) => { setMe(m as Me); })
      .catch(() => { setMe(null); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(reload, [reload]);
  return <Ctx.Provider value={{ me, loading, reload }}>{children}</Ctx.Provider>;
}

/**
 * Data fetching with two guarantees the naive version did not have:
 *
 *  1. **No out-of-order responses.** Every request carries a sequence number;
 *     a response that is not the newest is discarded. Without this, typing
 *     quickly in a search box could let an older, slower response overwrite
 *     a newer one and show stale rows.
 *  2. **Never hangs.** Requests are aborted after `timeout` ms so a stalled
 *     connection produces a visible error instead of a permanent spinner.
 */
export function useFetch<T>(path: string | null, deps: unknown[] = [], timeout = 15000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [tick, setTick] = useState(0);
  const seq = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!path) { setLoading(false); return; }
    const mine = ++seq.current;
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    apiFetch(path, { signal: controller.signal })
      .then((d: unknown) => {
        // Drop responses from superseded requests.
        if (!alive.current || mine !== seq.current) return;
        setData(d as T);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive.current || mine !== seq.current) return;
        const err = e as Error & { name?: string };
        if (err?.name === "AbortError") {
          setError("The request timed out. Check that the server is reachable.");
        } else {
          setError(String(err?.message || err));
        }
      })
      .finally(() => {
        clearTimeout(timer);
        if (alive.current && mine === seq.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  return { data, error, loading, retry: () => setTick((t) => t + 1) };
}

export function Loading({ label }: { label?: string }) {
  return (
    <div className="panel" aria-busy="true" aria-live="polite">
      <div className="skel" />
      <div className="skel" style={{ marginTop: 10, width: "60%" }} />
      {label && <div className="muted" style={{ marginTop: 12, fontSize: ".82rem" }}>{label}</div>}
    </div>
  );
}

export function Err({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return (
    <div className="panel" role="alert">
      <span className="bad">Something went wrong —</span> {msg}
      {onRetry && (
        <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={onRetry}>Try again</button>
      )}
    </div>
  );
}

/**
 * A useful empty state.
 *
 * The old one was a big dashed box that just said "Nothing here yet" — it
 * looked broken. This one says what belongs here and, when the current user
 * can create it, offers the button that does it.
 */
export function Empty({
  title = "Nothing here yet",
  msg,
  action,
  icon,
}: {
  title?: string;
  msg?: string;
  action?: { label: string; onClick?: () => void; to?: string };
  icon?: ReactNode;
}) {
  return (
    <div className="empty" role="status">
      {icon && <div className="empty-ico">{icon}</div>}
      <b>{title}</b>
      {msg && <div className="empty-msg">{msg}</div>}
      {action && (
        action.to ? (
          <a className="btn sm" href={action.to} style={{ marginTop: 14 }}>{action.label}</a>
        ) : (
          <button className="btn sm" onClick={action.onClick} style={{ marginTop: 14 }}>{action.label}</button>
        )
      )}
    </div>
  );
}

export function time_fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch { return iso; }
}
