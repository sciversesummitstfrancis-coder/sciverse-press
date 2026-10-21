import React from "react";
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { api } from "./api";

// ---------- Theme ----------
export const palette = {
  bg: "#06070c", bg2: "#0a0d15", ink: "#f2f5fa", muted: "#8b93a5",
  accent: "#38e1ff", accentSoft: "rgba(56,225,255,0.14)",
  violet: "#a78bfa", green: "#3ddc97", red: "#ff7a7a", amber: "#ffb454", blue: "#6aa8ff",
  card: "rgba(255,255,255,0.06)", line: "rgba(255,255,255,0.10)",
};
export const theme = palette;

// ---------- Layout ----------
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg, padding: 16 },
  card: { backgroundColor: palette.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: palette.line, marginBottom: 12 },
  h1: { color: palette.ink, fontSize: 27, fontWeight: "800", marginBottom: 4, letterSpacing: -0.5 },
  h: { color: palette.ink, fontSize: 19, fontWeight: "700", marginBottom: 8, marginTop: 4 },
  sub: { color: palette.muted, fontSize: 13.5, marginBottom: 10 },
  muted: { color: palette.muted, fontSize: 12.5 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  btn: { backgroundColor: palette.accent, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 20, alignItems: "center" },
  btnText: { color: "#04121a", fontWeight: "800", fontSize: 15 },
  btnGhost: { borderWidth: 1, borderColor: palette.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", backgroundColor: "transparent" },
  btnGhostText: { color: palette.accent, fontWeight: "700", fontSize: 14 },
  input: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, color: palette.ink, borderWidth: 1, borderColor: palette.line, marginBottom: 10 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, fontSize: 10.5, fontWeight: "800", backgroundColor: palette.accentSoft, color: palette.accent },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: "rgba(127,140,160,0.22)", overflow: "hidden", marginTop: 8 },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: palette.accent },
  empty: { padding: 26, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderStyle: "dashed", borderColor: palette.line, borderRadius: 14, marginTop: 12 },
  masthead: { color: palette.ink, fontSize: 32, fontWeight: "800", fontFamily: "serif", marginBottom: 2 },
  title: { color: palette.ink, fontSize: 24, fontWeight: "800", marginBottom: 4, letterSpacing: -0.5 },
  body: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  badge: { color: palette.accent, fontWeight: "800", fontSize: 11 },
  err: { color: palette.red, fontSize: 13, marginBottom: 10 },
});

export const s = styles;

// ---------- Fetch hook (shared) ----------
import { useEffect, useState } from "react";
export function useFetch<T>(fn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      try { setData(await fn()); } catch (e) { if (alive) setError(e instanceof Error ? e.message : String(e)); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, deps);
  return { data, error, loading, refresh: () => setLoading(true) };
}

// ---------- Primitives ----------
export const Card = ({ children }: { children: React.ReactNode }) => <View style={styles.card}>{children}</View>;
export const Empty = ({ label }: { label: string }) => (
  <View style={styles.empty}><Text style={{ color: palette.ink, fontWeight: "800" }}>{label}</Text></View>
);
export const ErrorBox = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <View style={styles.card}><Text style={{ color: palette.red, fontWeight: "800" }}>Something went wrong</Text><Text style={styles.muted}>{message}</Text>{onRetry ? <Pressable style={styles.btnGhost} onPress={onRetry}><Text style={styles.btnGhostText}>Try again</Text></Pressable> : null}</View>
);
export const Loading = () => (
  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 }}>
    <ActivityIndicator size="large" color={palette.accent} />
    <Text style={[styles.muted, { marginTop: 10 }]}>Loading…</Text>
  </View>
);

// ---------- Motion (Reanimated / Animated) ----------
export { FadeIn, ScaleIn, Pulse, ShimmerBar } from "./anim";
