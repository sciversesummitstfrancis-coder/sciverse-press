import { useState } from "react";
import { apiFetch } from "../api";
import { useFetch, Loading, Err, Empty, useMe, time_fmt } from "../ui";
import { AccountsPanel } from "./AdminAccounts";
import { CommitteesPanel } from "./AdminCommittees";
import { UpdateCenter } from "../UpdateCenter";

function Guard({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { me } = useMe();
  if (!me) return <Empty msg="Sign in first." />;
  if (!roles.includes(me.role)) return <div className="panel bad">Admins only.</div>;
  return <>{children}</>;
}

export function Admin() {
  return <Guard roles={["admin"]}><AdminInner /></Guard>;
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "accounts", label: "Accounts" },
  { id: "committees", label: "Committees" },
  { id: "audit", label: "Audit log" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function AdminInner() {
  const [tab, setTab] = useState<TabId>("overview");
  const health = useFetch<{ counts: Record<string, number>; errors: Array<{ action: string; n: number }>; time: string }>("/admin/health");
  const [com, setCom] = useState({ name: "", abbreviation: "", venue: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function createCommittee(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setMsg("");
    try {
      await apiFetch("/committees", { method: "POST", body: JSON.stringify(com) });
      setMsg("Committee created."); setCom({ name: "", abbreviation: "", venue: "" });
      health.retry();
    } catch (ex) { setErr(String((ex as Error).message)); }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="pagehead" style={{ marginBottom: 2 }}>
        <div>
          <div className="eyebrow">Operations</div>
          <h1>Control <em>center</em></h1>
          <p className="sub">Accounts, committees, scoring and audit — destructive actions ask first.</p>
        </div>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }} role="tablist" aria-label="Admin sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={"btn " + (tab === t.id ? "" : "ghost") + " sm"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="panel">
            <h2>Platform health <span className="rule" /></h2>
            <div className="kpis" style={{ marginBottom: 0 }}>{health.data && Object.entries(health.data.counts).map(([k, v]) => (
              <div key={k} className="panel kpi"><div className="v">{v}</div><div className="l">{k.replace(/_/g, " ")}</div></div>))}</div>
          </div>
          <div className="panel">
            <h2>New committee <span className="rule" /></h2>
            <form className="toolbar" onSubmit={createCommittee}>
              <input placeholder="Name" value={com.name} onChange={(e) => setCom({ ...com, name: e.target.value })} aria-label="Committee name" required />
              <input placeholder="Abbr" value={com.abbreviation} onChange={(e) => setCom({ ...com, abbreviation: e.target.value })} aria-label="Abbreviation" required />
              <input placeholder="Venue" value={com.venue} onChange={(e) => setCom({ ...com, venue: e.target.value })} aria-label="Venue" />
              <button className="btn" type="submit">Create</button>
            </form>
            {msg && <p role="status" className="ok">{msg}</p>}
            {err && <p role="alert" className="bad">{err}</p>}
          </div>
        </>
      )}

      {tab === "accounts" && <AccountsPanel onChanged={() => health.retry()} />}

      {tab === "committees" && <CommitteesPanel />}

      {tab === "audit" && <AuditLog />}
    </div>
  );
}

function AuditLog() {
  const logs = useFetch<Array<{ id: string; action: string; entity: string; entity_id: string; detail: string; created_at: string }>>("/audit-logs?limit=200");
  const [filter, setFilter] = useState("");
  if (logs.loading) return <Loading />;
  if (logs.error) return <Err msg={logs.error} />;
  const rows = (logs.data ?? []).filter((l) =>
    !filter ||
    l.action.toLowerCase().includes(filter.toLowerCase()) ||
    l.entity.toLowerCase().includes(filter.toLowerCase()) ||
    l.detail.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <div className="panel">
      <div className="rowbetween" style={{ alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Audit log</h2>
        <input placeholder="Filter actions…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter audit log" />
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>When</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>{time_fmt(l.created_at)}</td>
                <td><span className="chip">{l.action}</span></td>
                <td className="muted">{l.entity}/{l.entity_id}</td>
                <td>{l.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <Empty msg="No audit entries match." />}
    </div>
  );
}

export function Notifications() {
  const [tick, setTick] = useState(0);
  const n = useFetch<{ items: Array<{ id: string; kind: string; title: string; body: string; read: number; created_at: string }>; unread: number }>(
    `/notifications?limit=50`, [tick]);
  async function markAll() {
    await apiFetch("/notifications/read-all", { method: "POST" });
    setTick((t) => t + 1);
  }
  if (n.loading) return <Loading />;
  if (n.error) return <Err msg={n.error} />;
  return (
    <div className="panel">
      <h1>Notifications ({n.data?.unread} unread)</h1>
      <button className="btn ghost" onClick={markAll}>Mark all read</button>
      {n.data?.items.map((x) => (
        <div key={x.id} style={{ opacity: x.read ? 0.6 : 1, marginTop: ".6rem" }}>
          <span className="badge">{x.kind}</span> <b>{x.title}</b>
          <div className="muted">{x.body} · {time_fmt(x.created_at)}</div>
        </div>
      ))}
      {!n.data?.items.length && <Empty msg="No notifications." />}
    </div>
  );
}

export function Profile() {
  const { me, reload } = useMe();
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || "dark");
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("sp_theme", next); setTheme(next);
  }
  async function logout() {
    try { await apiFetch("/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    localStorage.removeItem("sp_token"); reload(); location.href = "/login";
  }
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="panel">
        <h1>Profile & settings</h1>
        <p>{me?.name} · {me?.email} · <span className="badge">{me?.role}</span></p>
        <div className="toolbar">
          <button className="btn ghost" onClick={toggleTheme}>Theme: {theme}</button>
          <button className="btn ghost" onClick={() => document.body.classList.toggle("low-power")}>Toggle low-power mode (reduces blur)</button>
          <button className="btn danger" onClick={logout}>Sign out</button>
        </div>
      </div>
      <UpdateCenter />
    </div>
  );
}
