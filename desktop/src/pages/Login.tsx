import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { apiFetch, setToken, getApiBase, setApiBase, IS_TAURI } from "../api";
import { useMe } from "../ui";

/** The demo accounts seeded by the backend. All use the same password. */
const DEMO_ACCOUNTS = [
  "admin@sciverse.local",
  "coord@sciverse.local",
  "eb@sciverse.local",
  "chair@sciverse.local",
  "press@sciverse.local",
  "org@sciverse.local",
];

export function Login() {
  const [email, setEmail] = useState("press@sciverse.local");
  const [password, setPassword] = useState("Sciverse123!");
  const [err, setErr] = useState("");
  const [showServer, setShowServer] = useState(false);
  const [server, setServer] = useState(getApiBase());
  const nav = useNavigate();
  const { me, reload, serverDown } = useMe();
  if (me) return <Navigate to="/" replace />;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    try {
      const r = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }) as { accessToken: string };
      setToken(r.accessToken); reload(); nav("/");
    } catch (ex) {
      const msg = String((ex as Error).message || "");
      setErr(
        msg.includes("Failed to fetch") || msg.includes("NetworkError")
          ? "Cannot reach the server. Check the server address below."
          : "Invalid credentials."
      );
    }
  }
  return (
    <div className="auth-wrap">
      <div className="panel auth-card">
        <div className="auth-brand">
          <div className="brand">
            <div className="brand-mark">S</div>
            <div><b>Sciverse Press</b><span>Summit MUN</span></div>
          </div>
          <h1>The summit's <em>front page</em>, written live.</h1>
          <p>Pressroom, committee pulse, delegate rankings and analytics — one newsroom for the whole conference.</p>
        </div>
        <div className="auth-form">
          <div className="eyebrow">Press credentials</div>
          <h1 style={{ fontSize: 26, marginBottom: 16 }}>Welcome back</h1>
          <form onSubmit={submit}>
            <label>Email<input aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Password<input aria-label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            {IS_TAURI && (
              <div style={{ marginTop: -4 }}>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => setShowServer((s) => !s)}
                  aria-expanded={showServer}
                  style={{ background: "none", border: 0, color: "var(--muted)", cursor: "pointer", fontSize: ".82rem", padding: 0 }}
                >
                  {showServer ? "Hide server settings" : "Server settings"}
                </button>
                {showServer && (
                  <label style={{ marginTop: 8 }}>
                    Server URL
                    <input
                      aria-label="Server URL"
                      value={server}
                      onChange={(e) => setServer(e.target.value)}
                      onBlur={() => setApiBase(server)}
                      placeholder="http://192.168.1.8:4000"
                    />
                  </label>
                )}
              </div>
            )}
            {serverDown && (
              <div className="panel" role="status" style={{ borderLeft: "3px solid var(--amber, #ffb454)", marginBottom: 14 }}>
                <b>Can’t reach the server at {getApiBase()}</b>
                <p className="muted" style={{ fontSize: ".85rem", margin: "6px 0 0" }}>
                  Start it with <code>npm run start --prefix backend</code>, or point the app at
                  another server below.
                </p>
              </div>
            )}
            {err && <p className="bad" role="alert">{err}</p>}
            <button className="btn" type="submit" style={{ width: "100%", justifyContent: "center" }}>Sign in</button>
          </form>
          <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 14 }}>
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                className="chip"
                style={{ cursor: "pointer", border: 0 }}
                onClick={() => { setEmail(a); setPassword("Sciverse123!"); }}
                aria-label={`Use ${a}`}
              >
                {a.split("@")[0]}
              </button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: ".82rem", marginTop: 10 }}>
            All demo accounts use the password <code>Sciverse123!</code>. The admin can create
            more from the Admin centre.{" "}
            <Link to="/register">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function Register() {
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "press" });
  const [msg, setMsg] = useState("");
  const nav = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    try {
      await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(form) });
      nav("/login");
    } catch (e) { setMsg(String((e as Error).message)); }
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="glass card" style={{ maxWidth: 440, margin: "6vh auto" }}>
      <h1>Create account</h1>
      <form onSubmit={submit}>
        <label>Name<input value={form.name} onChange={set("name")} /></label>
        <label>Email<input value={form.email} onChange={set("email")} /></label>
        <label>Password (8+ chars)<input type="password" value={form.password} onChange={set("password")} /></label>
        <label>Role<select value={form.role} onChange={set("role")}>
          {["press", "eb", "chair", "coordinator", "organizer"].map((r) => <option key={r} value={r}>{r}</option>)}
        </select></label>
        {msg && <p className="bad">{msg}</p>}
        <button className="btn" type="submit">Register</button>
      </form>
    </div>
  );
}
