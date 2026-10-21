import { useState } from "react";
import { apiFetch } from "../api";
import { useFetch, Loading, Err, Empty, useMe, time_fmt } from "../ui";

const ROLES = ["press", "eb", "chair", "coordinator", "admin", "organizer"] as const;

export interface Account {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
  activeSessions: number;
  articleCount: number;
  committeeCount: number;
  lastSeenAt: string | null;
}

function randPassword(len = 14) {
  const set = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => set[b % set.length]).join("");
}

function CopyBox({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="panel" style={{ padding: 12, marginTop: 10 }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <code style={{ display: "block", fontFamily: "ui-monospace, monospace", fontSize: 13, wordBreak: "break-all", marginBottom: 8 }}>{value}</code>
      <button
        className="btn ghost sm"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(
            () => { setCopied(true); setTimeout(() => setCopied(false), 1600); },
            () => setCopied(false),
          );
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** Admin account management: create, edit, reset, delete, bulk import. */
export function AccountsPanel({ onChanged }: { onChanged: () => void }) {
  const { me } = useMe();
  const [q, setQ] = useState("");
  const accounts = useFetch<Account[]>(`/admin/accounts?q=${encodeURIComponent(q)}`);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [created, setCreated] = useState<Array<{ email: string; password: string }>>([]);

  const [form, setForm] = useState({ email: "", name: "", role: "press", password: "" });
  const [bulkText, setBulkText] = useState("");

  function reset() {
    setForm({ email: "", name: "", role: "press", password: "" });
    setMsg(""); setErr("");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    try {
      await apiFetch("/admin/accounts", { method: "POST", body: JSON.stringify(form) });
      setCreated((c) => [...c, { email: form.email, password: form.password }]);
      reset();
      setShowCreate(false);
      setMsg(`Created ${form.email}.`);
      accounts.retry();
      onChanged();
    } catch (ex) {
      setErr(String((ex as Error).message));
    } finally { setBusy(false); }
  }

  async function bulkCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    try {
      // Accepts "email, name, role, password" per line (name may be quoted).
      const rows = bulkText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
          if (parts.length < 4) throw new Error(`Bad row: ${line}`);
          return { email: parts[0], name: parts[1], role: parts[2], password: parts[3] };
        });
      const res = (await apiFetch("/admin/accounts/bulk", {
        method: "POST",
        body: JSON.stringify({ rows }),
      })) as { created: number; skipped: number };
      setMsg(`Created ${res.created} account(s)${res.skipped ? `, skipped ${res.skipped} existing` : ""}.`);
      setBulkText("");
      setShowBulk(false);
      accounts.retry();
      onChanged();
    } catch (ex) {
      setErr(String((ex as Error).message));
    } finally { setBusy(false); }
  }

  async function setRole(id: string, role: string) {
    try {
      await apiFetch(`/admin/accounts/${id}`, { method: "PATCH", body: JSON.stringify({ role }) });
      accounts.retry();
      onChanged();
    } catch (ex) { setErr(String((ex as Error).message)); }
  }

  async function resetPassword(u: Account) {
    const password = randPassword();
    if (!confirm(`Reset the password for ${u.email}? They will be signed out everywhere.`)) return;
    try {
      await apiFetch(`/admin/accounts/${u.id}`, { method: "PATCH", body: JSON.stringify({ password }) });
      setCreated((c) => [...c, { email: u.email, password }]);
      setMsg(`Password reset for ${u.email}.`);
      accounts.retry();
    } catch (ex) { setErr(String((ex as Error).message)); }
  }

  async function remove(u: Account) {
    if (!confirm(`Delete ${u.email}? This cannot be undone. Their articles are reassigned to you.`)) return;
    try {
      const res = (await apiFetch(`/admin/accounts/${u.id}`, { method: "DELETE" })) as { reassignedArticles: number };
      setMsg(`Deleted ${u.email}${res.reassignedArticles ? ` — ${res.reassignedArticles} article(s) reassigned to you` : ""}.`);
      accounts.retry();
      onChanged();
    } catch (ex) { setErr(String((ex as Error).message)); }
  }

  async function forceSignOut(u: Account) {
    try {
      await apiFetch(`/users/${u.id}/sessions`, { method: "DELETE" });
      setMsg(`Signed ${u.email} out of all devices.`);
      accounts.retry();
    } catch (ex) { setErr(String((ex as Error).message)); }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="panel">
        <div className="rowbetween" style={{ alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Accounts</h2>
          <div className="toolbar" style={{ margin: 0 }}>
            <input
              placeholder="Search name, email or role"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search accounts"
            />
            <button className="btn" onClick={() => { reset(); setShowCreate((s) => !s); }} aria-expanded={showCreate}>
              {showCreate ? "Close" : "New account"}
            </button>
            <button className="btn ghost" onClick={() => { reset(); setShowBulk((s) => !s); }} aria-expanded={showBulk}>
              {showBulk ? "Close" : "Bulk import"}
            </button>
          </div>
        </div>

        {showCreate && (
          <form onSubmit={create} style={{ marginBottom: 14 }}>
            <div className="toolbar">
              <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-label="New account email" required />
              <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="New account name" required />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} aria-label="New account role">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input
                placeholder="Password"
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                aria-label="New account password"
                required
                minLength={8}
              />
              <button className="btn ghost sm" type="button" onClick={() => setForm({ ...form, password: randPassword() })}>Generate</button>
              <button className="btn" type="submit" disabled={busy}>Create</button>
            </div>
            <p className="muted" style={{ fontSize: ".8rem", margin: "6px 0 0" }}>Minimum 8 characters. Share the credentials securely — they are never emailed.</p>
          </form>
        )}

        {showBulk && (
          <form onSubmit={bulkCreate} style={{ marginBottom: 14 }}>
            <label style={{ display: "block" }}>
              Paste accounts — one per line: <code>email, name, role, password</code>
              <textarea
                rows={6}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"press1@sciverse.local, Ada Press, press, Sciverse123!\npress2@sciverse.local, Ben Press, press, Sciverse123!"}
                aria-label="Bulk account list"
                style={{ width: "100%", marginTop: 6 }}
              />
            </label>
            <button className="btn" type="submit" disabled={busy} style={{ marginTop: 8 }}>Import accounts</button>
          </form>
        )}

        {msg && <p role="status" className="ok">{msg}</p>}
        {err && <p role="alert" className="bad">{err}</p>}
        {created.length > 0 && (
          <div>
            <div className="eyebrow" style={{ marginTop: 8 }}>New credentials — copy them now</div>
            {created.map((c) => (
              <CopyBox key={c.email + c.password} label={c.email} value={c.password} />
            ))}
            <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setCreated([])}>Dismiss</button>
          </div>
        )}

        {accounts.loading ? <Loading /> : accounts.error ? <Err msg={accounts.error} /> : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Activity</th><th></th></tr>
              </thead>
              <tbody>
                {accounts.data?.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <b>{u.name}</b>
                      {u.id === me?.id && <span className="chip" style={{ marginLeft: 6 }}>you</span>}
                    </td>
                    <td className="muted">{u.email}</td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => setRole(u.id, e.target.value)}
                        aria-label={`Role for ${u.name}`}
                        disabled={u.id === me?.id}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="muted" style={{ fontSize: 12.5 }}>
                      {u.articleCount} article{u.articleCount === 1 ? "" : "s"} · {u.committeeCount} committee{u.committeeCount === 1 ? "" : "s"}
                      <br />
                      {u.activeSessions > 0 ? `${u.activeSessions} active session${u.activeSessions === 1 ? "" : "s"}` : "no active session"}
                      {u.lastSeenAt ? ` · last seen ${time_fmt(u.lastSeenAt)}` : ""}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                        <button className="btn ghost sm" onClick={() => resetPassword(u)}>Reset pw</button>
                        {u.activeSessions > 0 && (
                          <button className="btn ghost sm" onClick={() => forceSignOut(u)}>Sign out</button>
                        )}
                        <button
                          className="btn danger sm"
                          onClick={() => remove(u)}
                          disabled={u.id === me?.id}
                          title={u.id === me?.id ? "You cannot delete your own account" : undefined}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!accounts.data?.length && <Empty msg="No accounts match your search." />}
          </div>
        )}
      </div>
    </div>
  );
}
