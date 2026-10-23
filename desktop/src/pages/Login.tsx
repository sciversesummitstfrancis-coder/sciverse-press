import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { apiFetch, setToken, getApiBase, setApiBase, IS_TAURI } from "../api";
import { useMe } from "../ui";
import { InteractiveAuth } from "../InteractiveAuth";

/** The demo accounts seeded by the backend. All use the same password. */
const DEMO_ACCOUNTS = [
  { email: "admin@sciverse.local", what: "does everything" },
  { email: "coord@sciverse.local", what: "reviews & publishes" },
  { email: "eb@sciverse.local", what: "oversees debate" },
  { email: "chair@sciverse.local", what: "awards points" },
  { email: "press@sciverse.local", what: "writes stories" },
  { email: "org@sciverse.local", what: "runs logistics" },
];

export function Login() {
  const [email, setEmail] = useState("press@sciverse.local");
  const [password, setPassword] = useState("Sciverse123!");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showServer, setShowServer] = useState(false);
  const [server, setServer] = useState(getApiBase());
  const nav = useNavigate();
  const { me, reload, serverDown } = useMe();
  if (me) return <Navigate to="/" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const r = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }) as { accessToken: string };
      setToken(r.accessToken); reload(); nav("/");
    } catch (ex) {
      const msg = String((ex as Error).message || "");
      setErr(
        msg.includes("Failed to fetch") || msg.includes("NetworkError")
          ? "Cannot reach the server. Check the server address below."
          : "That email and password don't match an account."
      );
      setBusy(false);
    }
  }

  return (
    <InteractiveAuth>
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
            <label>Email
              <input
                aria-label="Email"
                type="email"
                autoComplete="current-username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>Password
              <div className="passwrap">
                <input
                  aria-label="Password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="pass-toggle"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  aria-pressed={showPass}
                >
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            {IS_TAURI && (
              <div style={{ marginBottom: 4 }}>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => setShowServer((s) => !s)}
                  aria-expanded={showServer}
                  style={{ background: "none", border: 0, color: "var(--muted)", cursor: "pointer", padding: 0, font: "inherit", fontSize: ".82rem" }}
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
              <div className="panel" role="status" style={{ borderLeft: "3px solid var(--amber, #ffb454)", marginBottom: 14, padding: "12px 16px" }}>
                <b>Can't reach the server at {getApiBase()}</b>
                <p className="muted" style={{ fontSize: ".85rem", margin: "6px 0 0" }}>
                  Start the backend, then try again — or point the app at another server above.
                </p>
              </div>
            )}
            {err && <p className="bad" role="alert" style={{ marginTop: 2 }}>{err}</p>}
            <button className="btn" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center", marginTop: 2 }}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="auth-divider"><span>New to the summit?</span></div>
          <Link
            to="/register"
            className="btn ghost"
            style={{ width: "100%", justifyContent: "center", textDecoration: "none" }}
          >
            Create an account
          </Link>

          <div style={{ marginTop: 18 }}>
            <div className="eyebrow" style={{ fontSize: 11 }}>Try a demo role</div>
            <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  className="chip"
                  title={`${a.email} — ${a.what}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => { setEmail(a.email); setPassword("Sciverse123!"); }}
                  aria-label={`Use ${a.email}`}
                >
                  {a.email.split("@")[0]}
                </button>
              ))}
            </div>
            <p className="muted" style={{ fontSize: ".8rem", marginTop: 8 }}>
              Demo accounts use the password <code>Sciverse123!</code>. Tap a chip to fill the form.
            </p>
          </div>
        </div>
      </div>
    </InteractiveAuth>
  );
}

const ROLES = [
  { id: "press", name: "Press", desc: "Write and file stories for review." },
  { id: "coordinator", name: "Coordinator", desc: "Review, approve and publish articles." },
  { id: "eb", name: "Executive Board", desc: "Oversee committees and debate." },
  { id: "chair", name: "Chair", desc: "Chairs a committee, awards points." },
  { id: "organizer", name: "Organizer", desc: "Runs the overall event logistics." },
];

export function Register() {
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "press" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const nav = useNavigate();

  const passOk = form.password.length >= 8;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const nameOk = form.name.trim().length >= 2;
  const valid = emailOk && nameOk && passOk;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(""); setBusy(true);
    try {
      await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(form) });
      setDone(true);
      // Let the user read the confirmation before dropping them on sign-in.
      setTimeout(() => nav("/login"), 1600);
    } catch (ex) {
      setMsg(String((ex as Error).message));
      setBusy(false);
    }
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <InteractiveAuth>
      <div className="panel auth-card">
        <div className="auth-brand">
          <div className="brand">
            <div className="brand-mark">S</div>
            <div><b>Sciverse Press</b><span>Summit MUN</span></div>
          </div>
          <h1>Join the <em>newsroom</em>.</h1>
          <p>Pick the role you hold at the summit — it decides what you can do in the app. An admin can change it later.</p>
        </div>
        <div className="auth-form">
          <div className="eyebrow">New member</div>
          <h1 style={{ fontSize: 26, marginBottom: 16 }}>Create your account</h1>
          {done ? (
            <div className="panel" role="status" style={{ borderLeft: "3px solid var(--green)", padding: "16px 18px" }}>
              <b>Account created ✔</b>
              <p className="muted" style={{ margin: "6px 0 0", fontSize: ".9rem" }}>
                Taking you to sign in…
              </p>
            </div>
          ) : (
            <form onSubmit={submit} aria-busy={busy}>
              <label>Your name
                <input
                  aria-label="Name"
                  autoComplete="name"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="e.g. Aditi Sharma"
                  required
                />
              </label>
              <label>Email
                <input
                  aria-label="Email"
                  type="email"
                  autoComplete="username"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="you@example.com"
                  required
                />
              </label>
              <label>
                <span>Password <span className={passOk ? "ok" : "muted"} style={{ fontWeight: 400 }}>{passOk ? "— good" : "(8+ characters)"}</span></span>
                <div className="passwrap">
                  <input
                    aria-label="Password"
                    type={showPass ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={set("password")}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="pass-toggle"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                    aria-pressed={showPass}
                  >
                    {showPass ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              <span className="eyebrow" style={{ fontSize: 11, margin: "6px 0 4px" }}>Your role @ the summit</span>
              <div className="rolegrid" role="radiogroup" aria-label="Role">
                {ROLES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={form.role === r.id}
                    className={"roleopt" + (form.role === r.id ? " sel" : "")}
                    onClick={() => setForm({ ...form, role: r.id })}
                  >
                    <b>{r.name}</b>
                    <span className="muted">{r.desc}</span>
                  </button>
                ))}
              </div>

              {msg && <p className="bad" role="alert">{msg}</p>}
              <button className="btn" type="submit" disabled={busy || !valid} style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>
                {busy ? "Creating…" : "Create account →"}
              </button>
              {!valid && (
                <p className="muted" style={{ fontSize: ".8rem", marginTop: 6 }}>
                  You'll need {[!nameOk && "your name", !emailOk && "a valid email", !passOk && "a password of 8+ characters"].filter(Boolean).join(", ")}.
                </p>
              )}
            </form>
          )}
          <p className="muted" style={{ fontSize: ".85rem", marginTop: 14, marginBottom: 0 }}>
            Already a member?{" "}
            <Link to="/login" style={{ fontWeight: 600 }}>Sign in instead</Link>
          </p>
        </div>
      </div>
    </InteractiveAuth>
  );
}
