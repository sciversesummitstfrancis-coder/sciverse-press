import { useState } from "react";
import { motion } from "./motionBridge";
import { Link } from "react-router-dom";
import { apiFetch } from "./api";
import { useMe } from "./ui";
import { icons } from "./icons";

/**
 * First-run setup.
 *
 * A brand-new install has no committees, no delegates and no stories, which
 * left the dashboard as a row of zeros and three empty boxes — it looked
 * broken rather than new. This panel turns that into an obvious path:
 * create the first committee, add the people, publish the first story.
 *
 * Only the admin sees it; everyone else gets a short "waiting for the
 * newsroom to be set up" note instead.
 */
export function SetupPanel({ hasCommittees }: { hasCommittees: boolean }) {
  const { me } = useMe();
  const isAdmin = me?.role === "admin";
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", abbreviation: "", venue: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (hasCommittees) return null;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    try {
      await apiFetch("/committees", { method: "POST", body: JSON.stringify(form) });
      setMsg(`${form.name} created. Add your team from the Admin centre, then file the first story.`);
      setForm({ name: "", abbreviation: "", venue: "" });
      setShowForm(false);
      // The dashboard reloads so the new committee appears everywhere.
      setTimeout(() => location.reload(), 900);
    } catch (ex) {
      setErr(String((ex as Error).message));
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="panel setup" role="status">
        <div className="setup-ico">{icons.bank}</div>
        <div>
          <h2 style={{ margin: "0 0 4px" }}>The newsroom is being set up</h2>
          <p className="muted" style={{ margin: 0 }}>
            No committees exist yet. An admin creates them from the Admin centre —
            once there is a committee, its live status and progress appear here.
          </p>
        </div>
      </div>
    );
  }

  const steps = [
    { n: 1, t: "Create a committee", d: "Committees are the working groups of the summit.", done: false },
    { n: 2, t: "Add your team", d: "Create press, EB, chair and coordinator accounts.", done: false },
    { n: 3, t: "File the first story", d: "Publish a dispatch to open the pressroom.", done: false },
  ];

  return (
    <motion.div
      className="panel setup"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="setup-head">
        <div className="setup-ico">{icons.bolt}</div>
        <div>
          <h2 style={{ margin: "0 0 2px" }}>Set up your newsroom</h2>
          <p className="muted" style={{ margin: 0 }}>
            Three steps and this dashboard comes alive. Nothing is pre-filled — you decide
            the committees, the people and the stories.
          </p>
        </div>
      </div>

      <ol className="setup-steps">
        {steps.map((s) => (
          <li key={s.n} className="setup-step">
            <span className="setup-n">{s.n}</span>
            <span className="setup-t">
              <b>{s.t}</b>
              <span className="muted">{s.d}</span>
            </span>
            {s.n === 1 && (
              <button className="btn sm" onClick={() => setShowForm((v) => !v)}>
                {showForm ? "Cancel" : "Start"}
              </button>
            )}
            {s.n === 2 && (
              <Link className="btn ghost sm" to="/admin">Admin centre</Link>
            )}
            {s.n === 3 && (
              <Link className="btn ghost sm" to="/articles/new">New story</Link>
            )}
          </li>
        ))}
      </ol>

      {showForm && (
        <form className="setup-form" onSubmit={create}>
          <div className="toolbar" style={{ marginBottom: 8 }}>
            <input
              placeholder="Committee name, e.g. United Nations Security Council"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              aria-label="Committee name"
              required
            />
            <input
              placeholder="Abbreviation, e.g. UNSC"
              value={form.abbreviation}
              onChange={(e) => setForm({ ...form, abbreviation: e.target.value })}
              aria-label="Abbreviation"
              required
            />
            <input
              placeholder="Venue, e.g. Hall A"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
              aria-label="Venue"
            />
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create committee"}
            </button>
          </div>
          {err && <p className="bad" role="alert">{err}</p>}
        </form>
      )}

      {msg && <p className="ok" role="status">{msg}</p>}
    </motion.div>
  );
}
