import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Updates from "expo-updates";
import { s } from "./ui";

/**
 * Over-the-air update support for the Android app.
 *
 * Uses `expo-updates`. A published OTA update replaces the JavaScript bundle
 * on the device — the installed APK stays exactly as it is, so the user never
 * has to uninstall or reinstall. (Changes to native code still need a new
 * APK; that is an Android platform rule, not a limitation of this app.)
 *
 * The update server URL is baked into the APK at build time
 * (`expo.updates.url` in app.json) and mirrored in the Android manifest.
 * Expo SDK 51 cannot switch that URL at runtime, so the address shown here is
 * the one the build was configured with.
 */

export type UpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "up-to-date"
  | "applied"
  | "error"
  | "unsupported";

export interface UpdateState {
  phase: UpdatePhase;
  message: string;
}

export interface UpdateInfo {
  runtimeVersion: string | null;
  isEnabled: boolean;
  updateId: string | null;
}

export function getUpdateInfo(): UpdateInfo {
  try {
    return {
      runtimeVersion: Updates.runtimeVersion ?? null,
      isEnabled: Updates.isEnabled,
      updateId: Updates.updateId ?? null,
    };
  } catch {
    return { runtimeVersion: null, isEnabled: false, updateId: null };
  }
}

export function useUpdates() {
  const [state, setState] = useState<UpdateState>({ phase: "idle", message: "" });

  const check = useCallback(async (): Promise<boolean> => {
    setState({ phase: "checking", message: "Checking for updates…" });
    if (!Updates.isEnabled) {
      setState({
        phase: "unsupported",
        message: "Updates are disabled in this build.",
      });
      return false;
    }
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setState({ phase: "up-to-date", message: "You are on the latest version." });
        return false;
      }
      setState({ phase: "available", message: "A new version is available. Downloading…" });
      await Updates.fetchUpdateAsync();
      setState({ phase: "downloading", message: "Downloaded. Restarting…" });
      await Updates.reloadAsync();
      // reloadAsync tears down the JS runtime, so this line is usually not
      // reached — it is only a fallback if the reload is deferred.
      setState({ phase: "applied", message: "Update installed." });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("ERR_UPDATES_DISABLED")) {
        setState({ phase: "unsupported", message: "This is a development build — updates are disabled." });
      } else if (/update ?url/i.test(msg)) {
        setState({ phase: "unsupported", message: "No update server is configured for this build." });
      } else if (/network|fetch|timeout|ENOTFOUND|ECONNREFUSED/i.test(msg)) {
        setState({ phase: "error", message: "Could not reach the update server." });
      } else {
        setState({ phase: "error", message: msg });
      }
      return false;
    }
  }, []);

  return { ...state, check };
}

/** In-app update row for the Profile screen. */
export function UpdateRow() {
  const { phase, message, check } = useUpdates();
  const info = getUpdateInfo();

  useEffect(() => {
    // Check quietly once, shortly after launch.
    const t = setTimeout(() => { void check(); }, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = phase === "checking" || phase === "downloading" || phase === "available";

  return (
    <View style={{ marginTop: 18 }}>
      <Pressable
        style={[s.btnGhost, { opacity: busy ? 0.6 : 1 }]}
        onPress={() => { void check(); }}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Check for app updates"
      >
        <Text style={s.btnGhostText}>{busy ? "Working…" : "Check for app updates"}</Text>
      </Pressable>
      {message ? (
        <Text style={[s.muted, { marginTop: 8 }]} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
      {info.runtimeVersion ? (
        <Text style={[s.muted, { marginTop: 4, fontSize: 11.5 }]}>
          Runtime v{info.runtimeVersion}
          {info.updateId ? " · running a downloaded update" : " · running the bundled build"}
        </Text>
      ) : null}
    </View>
  );
}
