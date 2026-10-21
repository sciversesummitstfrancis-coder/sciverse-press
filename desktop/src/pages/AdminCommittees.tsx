import { useState } from "react";
import { apiFetch } from "../api";
import { useFetch, Loading, Err, Empty, time_fmt } from "../ui";

const STATUSES = ["upcoming", "in_session", "on_break", "completed", "delayed"] as const;

export interface AdminCommittee {
  id: string;
  name: string;
  abbreviation: string;
  venue: string;
  agenda: string;
  status: string;
  progressPercent: number;
  currentAgendaItem: string;
  archived: boolean;
  updatedAt: string;
  memberCount: number;
  sessionCount: number;
  agendaCount: number;
  articleCount: number;
  delegateCount: number;
  lastUpdateAt: string | null;
}

interface Member { id: string; name: string; email: string; role: string }

/** Admin oversight of every committee: edit, force status, archive, delete. */
export function CommitteesPanel() {
  const committees = useFetch<AdminCommittee[]>("/admin/committees");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<AdminCommittee | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  async function patch(id: string, body: Record<string, unknown>, ok: string) {
    setErr(""); setMsg("");
    try {
      await apiFetch(`/admin/committees/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      setMsg(ok);
      committees.retry();
      setEditing(null);
    } catch (ex) { setErr(String((ex as Error).message)); }
  }

  async function remove(c: AdminCommittee) {
    const extra = [
      c.articleCount ? `${c.articleCount} article(s) will be detached` : "",
      c.delegateCount ? `${c.delegateCount} delegate(s) will be removed` : "",
    ].filter(Boolean).join(", ");
    if (!confirm(`Delete ${c.name}?${extra ? " " + extra + "." : ""} This cannot be undone.`)) return;
    setErr(""); setMsg("");
    try {
      await apiFetch(`/admin/committees/${c.id}`, { method: "DELETE" });
      setMsg(`Deleted ${c.name}.`);
      committees.retry();
    } catch (ex) { setErr(String((ex as Error).message)); }
  }

  if (committees.loading) return <Loading />;
  if (committees.error) return <Err msg={committees.error} />;

  const rows = (committees.data ?? []).filter((c) => showArchived || !c.archived);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="panel">
        <div className="rowbetween" style={{ alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Committee oversight</h2>
          <label className="muted" style={{ fontSize: ".82rem", display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
        </div>
        {msg && <p role="status" className="ok">{msg}</p>}
        {err && <p role="alert" className="bad">{err}</p>}
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>Committee</th><th>Status</th><th>Progress</th><th>Contents</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.name}</b> <span className="chip">{c.abbreviation}</span>
                    {c.archived && <span className="chip" style={{ marginLeft: 6 }}>archived</span>}
                    <div className="muted" style={{ fontSize: 12.5 }}>
                      {c.venue || "No venue"}
                      {c.lastUpdateAt ? ` · updated ${time_fmt(c.lastUpdateAt)}` : " · never updated"}
                    </div>
                  </td>
                  <td>
                    <select
                      value={c.status}
                      onChange={(e) => patch(c.id, { status: e.target.value }, `${c.name} is now ${e.target.value}.`)}
                      aria-label={`Status for ${c.name}`}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ minWidth: 160 }}>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={c.progressPercent}
                      onChange={(e) => setEditing({ ...c, progressPercent: Number(e.target.value) })}
                      onMouseUp={() => editing && patch(c.id, { progressPercent: editing.progressPercent }, `${c.name} progress set to ${editing.progressPercent}%.`)}
                      onKeyUp={() => editing && patch(c.id, { progressPercent: editing.progressPercent }, `${c.name} progress set to ${editing.progressPercent}%.`)}
                      aria-label={`Progress for ${c.name}`}
                      style={{ width: "100%" }}
                    />
                    <div className="muted" style={{ fontSize: 12 }}>{c.progressPercent}%</div>
                  </td>
                  <td className="muted" style={{ fontSize: 12.5 }}>
                    {c.memberCount} member{c.memberCount === 1 ? "" : "s"} · {c.delegateCount} delegate{c.delegateCount === 1 ? "" : "s"}
                    <br />
                    {c.articleCount} article{c.articleCount === 1 ? "" : "s"} · {c.sessionCount} session{c.sessionCount === 1 ? "" : "s"} · {c.agendaCount} agenda item{c.agendaCount === 1 ? "" : "s"}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn ghost sm" onClick={() => setEditing(editing?.id === c.id ? null : c)}>Edit</button>
                      <button
                        className="btn ghost sm"
                        onClick={() => patch(c.id, { archived: !c.archived }, `${c.name} ${c.archived ? "restored" : "archived"}.`)}
                      >
                        {c.archived ? "Restore" : "Archive"}
                      </button>
                      <button className="btn danger sm" onClick={() => remove(c)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty msg="No committees yet. Create one from the “New committee” panel." />}
        </div>
      </div>

      {editing && (
        <CommitteeEditor
          committee={editing}
          onClose={() => setEditing(null)}
          onSave={(body, ok) => patch(editing.id, body, ok)}
          onError={setErr}
        />
      )}
    </div>
  );
}

function CommitteeEditor({
  committee, onClose, onSave, onError,
}: {
  committee: AdminCommittee;
  onClose: () => void;
  onSave: (body: Record<string, unknown>, ok: string) => void;
  onError: (m: string) => void;
}) {
  const [form, setForm] = useState({
    name: committee.name,
    abbreviation: committee.abbreviation,
    venue: committee.venue,
    agenda: committee.agenda,
    currentAgendaItem: committee.currentAgendaItem,
  });
  const detail = useFetch<{ members: Member[]; sessions: Array<{ id: string; title: string; starts_at: string; venue: string }>; agendaItems: Array<{ id: string; title: string; position: number; done: number }> }>(
    `/committees/${committee.id}`,
  );

  async function removeMember(userId: string, name: string) {
    if (!confirm(`Remove ${name} from the committee roster?`)) return;
    try {
      await apiFetch(`/admin/committees/${committee.id}/members/${userId}`, { method: "DELETE" });
      detail.retry();
    } catch (ex) { onError(String((ex as Error).message)); }
  }
  async function removeSession(id: string, title: string) {
    if (!confirm(`Delete the session “${title}”?`)) return;
    try {
      await apiFetch(`/admin/committees/${committee.id}/sessions/${id}`, { method: "DELETE" });
      detail.retry();
    } catch (ex) { onError(String((ex as Error).message)); }
  }
  async function removeAgenda(id: string, title: string) {
    if (!confirm(`Delete agenda item “${title}”?`)) return;
    try {
      await apiFetch(`/admin/committees/${committee.id}/agenda/${id}`, { method: "DELETE" });
      detail.retry();
    } catch (ex) { onError(String((ex as Error).message)); }
  }

  return (
    <div className="panel">
      <div className="rowbetween" style={{ alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Edit {committee.abbreviation}</h2>
        <button className="btn ghost sm" onClick={onClose}>Close</button>
      </div>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Committee name" />
        <input value={form.abbreviation} onChange={(e) => setForm({ ...form, abbreviation: e.target.value })} aria-label="Abbreviation" />
        <input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} aria-label="Venue" />
        <input value={form.currentAgendaItem} onChange={(e) => setForm({ ...form, currentAgendaItem: e.target.value })} placeholder="Current agenda item" aria-label="Current agenda item" />
        <button className="btn" onClick={() => onSave(form, `${committee.name} updated.`)}>Save changes</button>
      </div>
      <label style={{ display: "block", marginBottom: 14 }}>
        Agenda / topic
        <textarea rows={3} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} aria-label="Committee agenda" style={{ width: "100%", marginTop: 6 }} />
      </label>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <div>
          <div className="eyebrow">Roster</div>
          {detail.data?.members.length ? detail.data.members.map((m) => (
            <div key={m.id} className="rowbetween" style={{ padding: "6px 0", borderBottom: "1px solid var(--line-soft)", fontSize: 13 }}>
              <span>{m.name} <span className="muted">· {m.role}</span></span>
              <button className="btn danger sm" onClick={() => removeMember(m.id, m.name)}>Remove</button>
            </div>
          )) : <div className="muted" style={{ fontSize: 13 }}>No members assigned.</div>}
        </div>

        <div>
          <div className="eyebrow">Sessions</div>
          {detail.data?.sessions.length ? detail.data.sessions.map((s) => (
            <div key={s.id} className="rowbetween" style={{ padding: "6px 0", borderBottom: "1px solid var(--line-soft)", fontSize: 13 }}>
              <span>{s.title} <span className="muted">· {time_fmt(s.starts_at)}</span></span>
              <button className="btn danger sm" onClick={() => removeSession(s.id, s.title)}>Delete</button>
            </div>
          )) : <div className="muted" style={{ fontSize: 13 }}>No sessions scheduled.</div>}
        </div>

        <div>
          <div className="eyebrow">Agenda items</div>
          {detail.data?.agendaItems.length ? detail.data.agendaItems.map((a) => (
            <div key={a.id} className="rowbetween" style={{ padding: "6px 0", borderBottom: "1px solid var(--line-soft)", fontSize: 13 }}>
              <span>{a.position + 1}. {a.title}{a.done ? " ✓" : ""}</span>
              <button className="btn danger sm" onClick={() => removeAgenda(a.id, a.title)}>Delete</button>
            </div>
          )) : <div className="muted" style={{ fontSize: 13 }}>No agenda items.</div>}
        </div>
      </div>
    </div>
  );
}
