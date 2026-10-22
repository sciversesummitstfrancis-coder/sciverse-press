import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from './api';

/* ==========================================================================
   SCIVERSE PRESS — glass design system (mirrors desktop/src/styles.css)
   ========================================================================== */

export const palette = {
  bg: '#05060b',
  bg2: '#0a0d16',
  ink: '#f3f6fb',
  ink2: '#c6cdda',
  muted: '#8b93a5',
  faint: '#5d6577',
  accent: '#38e1ff',
  accentDeep: '#0ea5c9',
  violet: '#a78bfa',
  gold: '#f5c451',
  green: '#3ddc97',
  red: '#ff7a7a',
  amber: '#ffb454',
  blue: '#6aa8ff',
  panel: 'rgba(255,255,255,0.055)',
  panel2: 'rgba(255,255,255,0.085)',
  line: 'rgba(255,255,255,0.11)',
  lineSoft: 'rgba(255,255,255,0.06)',
  accentSoft: 'rgba(56,225,255,0.14)',
};
export const theme = palette;

export const radii = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 };

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 16, paddingTop: 8 },
  screenPad: { paddingBottom: 28 },

  h1: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.6,
  },
  h: {
    color: palette.ink,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  title: {
    color: palette.ink,
    fontSize: 25,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.6,
  },
  sub: { color: palette.muted, fontSize: 13.5, marginBottom: 10 },
  muted: { color: palette.muted, fontSize: 12.5, lineHeight: 18 },
  body: { color: palette.ink2, fontSize: 14, lineHeight: 21 },
  tiny: { color: palette.faint, fontSize: 11, letterSpacing: 0.4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  card: {
    borderRadius: radii.lg,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
  },
  cardInner: { padding: 16 },
  cardAccent: { height: 3, width: '100%' },

  badge: {
    color: palette.accent,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.3,
  },

  btn: {
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  btnText: { color: '#04121a', fontWeight: '900', fontSize: 15, letterSpacing: 0.2 },
  btnGhost: {
    borderRadius: radii.pill,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
  },
  btnGhostText: { color: palette.accent, fontWeight: '800', fontSize: 14 },

  input: {
    borderRadius: radii.md,
    padding: 14,
    color: palette.ink,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 10,
  },

  empty: {
    padding: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.line,
    borderRadius: radii.lg,
    marginTop: 12,
  },

  tabbar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: palette.lineSoft,
    backgroundColor: 'rgba(8,10,18,0.72)',
  },
  tabBtn: { flex: 1, paddingVertical: 13, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  tabText: { color: palette.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  tabActive: { color: palette.accent },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
  },
  chipText: { color: palette.accent, fontSize: 12.5, fontWeight: '800' },
});

export const s = styles;

/* ------------------------------------------------------------- background -- */

/**
 * Layered aurora background. BlurViews sample this, which is what produces
 * the frosted-glass look on every card.
 */
export function GlassBackground({ children }: { children?: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <LinearGradient
        colors={['#0b1626', '#05060b', '#080713']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(56,225,255,0.22)', 'rgba(56,225,255,0)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.35, y: 0.85 }}
        style={{ position: 'absolute', top: -140, right: -120, width: 460, height: 460, borderRadius: 230 }}
      />
      <LinearGradient
        colors={['rgba(167,139,250,0.20)', 'rgba(167,139,250,0)']}
        start={{ x: 0, y: 1 }}
        end={{ x: 0.8, y: 0.2 }}
        style={{ position: 'absolute', bottom: -170, left: -140, width: 520, height: 520, borderRadius: 260 }}
      />
      <LinearGradient
        colors={['rgba(245,196,81,0.10)', 'rgba(245,196,81,0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', top: 240, left: -80, width: 340, height: 340, borderRadius: 170 }}
      />
      {children}
    </View>
  );
}

/* ------------------------------------------------------------ glass panel -- */

export function GlassPanel({
  children,
  style,
  intensity = 34,
  tint = 'dark',
  radius = radii.lg,
  padded = true,
}: {
  children: React.ReactNode;
  style?: any;
  intensity?: number;
  tint?: 'dark' | 'light' | 'default';
  radius?: number;
  padded?: boolean;
}) {
  return (
    <View
      style={[
        {
          borderRadius: radius,
          borderWidth: 1,
          borderColor: palette.line,
          overflow: 'hidden',
          backgroundColor: palette.panel,
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 6,
        },
        style,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint={tint}
        style={StyleSheet.absoluteFill}
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
      />
      {/* the sheen that sells the glass: light falls across the top edge */}
      <LinearGradient
        colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 140 }}
        pointerEvents="none"
      />
      <View
        style={[
          { backgroundColor: 'rgba(255,255,255,0.035)' },
          padded && { padding: 16 },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/** Card = glass panel, kept for API compatibility with the existing screens. */
export const Card = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <GlassPanel style={[{ marginBottom: 12 }, style]}>{children}</GlassPanel>
);

/* ----------------------------------------------------------- accent button -- */

export function GradientButton({
  label,
  onPress,
  style,
  colors = [palette.accent, palette.accentDeep],
  disabled,
}: {
  label: string;
  onPress?: () => void;
  style?: any;
  colors?: [string, string] | string[];
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        { opacity: disabled ? 0.55 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
        style,
      ]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Text style={s.btnText}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  style,
  textStyle,
}: {
  label: string;
  onPress?: () => void;
  style?: any;
  textStyle?: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.btnGhost, { opacity: pressed ? 0.7 : 1 }, style]}
    >
      <Text style={[s.btnGhostText, textStyle]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  onPress,
  active,
  tone = palette.accent,
}: {
  label: string;
  onPress?: () => void;
  active?: boolean;
  tone?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[
        s.chip,
        active && { borderColor: tone, backgroundColor: 'rgba(56,225,255,0.16)' },
      ]}
    >
      <Text style={[s.chipText, { color: tone }]}>{label}</Text>
    </Pressable>
  );
}

/** Small uppercase eyebrow used above section titles. */
export function Eyebrow({ label, tone = palette.accent }: { label: string; tone?: string }) {
  return (
    <Text style={[s.tiny, { color: tone, textTransform: 'uppercase', fontWeight: '800' }]}>
      {label}
    </Text>
  );
}

/* -------------------------------------------------------------- primitives -- */

/**
 * A useful empty state.
 *
 * `label` is the short headline (kept for backwards compatibility with the
 * old one-liner form). `title` + `msg` + `action` give the fuller version
 * that tells the user what belongs here and offers the button that creates it.
 */
export const Empty = ({
  label,
  title,
  msg,
  action,
}: {
  label?: string;
  title?: string;
  msg?: string;
  action?: { label: string; onPress: () => void };
}) => (
  <View style={s.empty}>
    <Text style={{ color: palette.ink, fontWeight: '800', textAlign: 'center', fontSize: 15 }}>
      {title ?? label ?? 'Nothing here yet'}
    </Text>
    {msg ? (
      <Text style={[s.body, { textAlign: 'center', marginTop: 6 }]}>{msg}</Text>
    ) : null}
    {action ? (
      <Pressable
        style={[s.btnGhost, { marginTop: 14 }]}
        onPress={action.onPress}
        accessibilityRole="button"
        accessibilityLabel={action.label}
      >
        <Text style={s.btnGhostText}>{action.label}</Text>
      </Pressable>
    ) : null}
  </View>
);

export const ErrorBox = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <GlassPanel style={{ marginBottom: 12, borderColor: 'rgba(255,122,122,0.35)' }}>
    <Text style={{ color: palette.red, fontWeight: '800' }}>Something went wrong</Text>
    <Text style={[s.muted, { marginTop: 4 }]}>{message}</Text>
    {onRetry ? (
      <GhostButton label="Try again" onPress={onRetry} style={{ marginTop: 12, alignSelf: 'flex-start' }} />
    ) : null}
  </GlassPanel>
);

export const Loading = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
    <ActivityIndicator size="large" color={palette.accent} />
    <Text style={[s.muted, { marginTop: 10 }]}>Loading…</Text>
  </View>
);

/** Section wrapper with a title and optional trailing action. */
export function Section({
  title,
  action,
  children,
  style,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View style={[{ marginBottom: 4 }, style]}>
      {title ? (
        <View style={[s.row, { marginBottom: 10, marginTop: 6 }]}>
          <Text style={[s.h, { marginTop: 0, marginBottom: 0 }]}>{title}</Text>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/* -------------------------------------------------------------- fetch hook -- */
import { useEffect, useState } from 'react';
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

/* ----------------------------------------------------------------- motion -- */
export { FadeIn, ScaleIn, Pulse, ShimmerBar } from './anim';

/** Convenience: a screen that already has the aurora background + safe area. */
export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  if (!scroll) return <GlassBackground>{children}</GlassBackground>;
  return (
    <GlassBackground>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.screenPad} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </GlassBackground>
  );
}
