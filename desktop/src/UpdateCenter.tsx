import { useCallback, useEffect, useState } from "react";
import { motion } from "./motionBridge";

/**
 * Update centre.
 *
 * Uses the Tauri updater plugin: it fetches the release manifest
 * (`latest.json`) from the configured endpoint, compares versions, downloads
 * the matching artifact for this platform, verifies its minisign signature
 * against the public key baked into `tauri.conf.json`, and installs it in
 * place. The user never has to uninstall or re-download the app.
 *
 * When the app is not running inside Tauri (e.g. the browser preview) the
 * controls are disabled with a clear explanation instead of throwing.
 */

type Phase = "idle" | "checking" | "available" | "downloading" | "installing" | "up-to-date" | "error";

interface UpdateInfo {
  version: string;
  currentVersion: string;
  date?: string;
  body?: string;
}

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function useUpdater() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async (): Promise<UpdateInfo | null> => {
    if (!isTauri) {
      setError("Updates are only available in the installed desktop app.");
      setPhase("error");
      return null;
    }
    setPhase("checking");
    setError(null);
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (!update) {
        setPhase("up-to-date");
        setInfo(null);
        return null;
      }
      setInfo({
        version: update.version,
        currentVersion: update.currentVersion,
        date: update.date,
        body: update.body,
      });
      setPhase("available");
      return update;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
      return null;
    }
  }, []);

  const install = useCallback(async () => {
    if (!isTauri) return;
    try {
      setPhase("downloading");
      setProgress(0);
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (!update) {
        setPhase("up-to-date");
        return;
      }
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setProgress(total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0);
        }
      });
      setProgress(100);
      setPhase("installing");
      // Relaunch so the new binary is the one running.
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, []);

  return { phase, info, progress, error, check, install, isTauri };
}

export function UpdateCenter() {
  const { phase, info, progress, error, check, install, isTauri } = useUpdater();

  // Check silently on mount so the user learns about a new version without
  // having to ask for it.
  useEffect(() => {
    const t = setTimeout(() => { void check(); }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="panel">
      <div className="rowbetween" style={{ alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>
          Updates <span className="rule" />
        </h2>
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn ghost sm"
            onClick={() => void check()}
            disabled={phase === "checking" || phase === "downloading" || phase === "installing"}
          >
            {phase === "checking" ? "Checking…" : "Check for updates"}
          </button>
          {phase === "available" && (
            <button className="btn sm" onClick={() => void install()}>
              Install v{info?.version}
            </button>
          )}
        </div>
      </div>

      {!isTauri && (
        <p className="muted" style={{ fontSize: ".82rem" }}>
          You are running the web preview. Updates are only offered in the installed desktop app.
        </p>
      )}

      {phase === "up-to-date" && (
        <p className="ok" role="status">
          You are on the latest version{info?.currentVersion ? ` (v${info.currentVersion})` : ""}.
        </p>
      )}

      {phase === "available" && info && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <p role="status">
            <b>Version {info.version}</b> is available — you are on v{info.currentVersion}.
            {info.date ? ` Released ${new Date(info.date).toLocaleDateString()}.` : ""}
          </p>
          {info.body && <p className="muted" style={{ fontSize: ".85rem" }}>{info.body}</p>}
          <p className="muted" style={{ fontSize: ".82rem" }}>
            The update is downloaded, signature-checked and installed in place. Your account and data are
            untouched — you do not need to uninstall anything.
          </p>
        </motion.div>
      )}

      {(phase === "downloading" || phase === "installing") && (
        <div>
          <div className="rowbetween" style={{ fontSize: ".85rem", marginBottom: 6 }}>
            <span>{phase === "downloading" ? "Downloading update…" : "Installing update…"}</span>
            <span className="muted">{phase === "downloading" ? `${progress}%` : "starting"}</span>
          </div>
          <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <motion.div
              style={{ width: `${phase === "downloading" ? progress : 100}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, var(--accent), var(--violet))" }}
              animate={{ width: `${phase === "downloading" ? progress : 100}%` }}
              transition={{ duration: 0.25 }}
            />
          </div>
          {phase === "installing" && <p className="muted" style={{ fontSize: ".82rem", marginTop: 8 }}>Restarting the app…</p>}
        </div>
      )}

      {phase === "error" && error && (
        <p className="bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
