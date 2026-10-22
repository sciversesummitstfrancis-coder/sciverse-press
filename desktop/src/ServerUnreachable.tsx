import { useState } from "react";
import { getApiBase, setApiBase } from "./api";

/**
 * Shown when the backend cannot be reached.
 *
 * The desktop app is a client for the Sciverse Press server. If that server
 * is not running, every screen used to fill up with raw "Failed to fetch"
 * errors, which looked like the app was broken. This screen says exactly
 * what is wrong and gives a way out.
 */
export function ServerUnreachable({ onRetry }: { onRetry: () => void }) {
  const base = getApiBase();
  const [editing, setEditing] = useState(false);
  const [addr, setAddr] = useState(base);

  return (
    <div className="serverdown">
      <div className="serverdown-card">
        <div className="serverdown-ico" aria-hidden>!</div>
        <h1>The Sciverse Press server isn’t running</h1>
        <p className="muted">
          The app is fine — the backend it talks to isn’t up. It normally runs on
          this computer at <code>{base}</code>.
        </p>

        <div className="serverdown-how">
          <div className="serverdown-step">
            <span className="setup-n">1</span>
            <div>
              <b>Start the server</b>
              <pre>cd sciverse-press-platform{'\n'}npm run start --prefix backend</pre>
            </div>
          </div>
          <div className="serverdown-step">
            <span className="setup-n">2</span>
            <div>
              <b>Then come back here</b>
              <span className="muted">The app reconnects on its own — press the button below.</span>
            </div>
          </div>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={onRetry}>Try again</button>
          <button className="btn ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? "Hide" : "Use a different server"}
          </button>
        </div>

        {editing && (
          <div className="serverdown-how" style={{ marginTop: 14 }}>
            <label style={{ marginBottom: 8 }}>
              Server address
              <input
                value={addr}
                onChange={(e) => setAddr(e.target.value)}
                onBlur={() => { setApiBase(addr); onRetry(); }}
                placeholder="http://192.168.1.8:4000"
                aria-label="Server address"
              />
            </label>
            <span className="muted" style={{ fontSize: ".82rem" }}>
              The address is saved on this machine. Press Enter or click away to
              apply it.
            </span>
          </div>
        )}

        <p className="muted" style={{ fontSize: ".8rem", marginTop: 18 }}>
          On a phone the app keeps working offline — it stores everything
          locally and syncs when the server comes back.
        </p>
      </div>
    </div>
  );
}
