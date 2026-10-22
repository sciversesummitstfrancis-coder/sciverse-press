import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api, setToken } from '../api';
import { Eyebrow, GlassBackground, GlassPanel, GradientButton, s, theme } from '../ui';

const DEMO_ACCOUNTS = [
  'admin@sciverse.local',
  'coord@sciverse.local',
  'eb@sciverse.local',
  'chair@sciverse.local',
  'press@sciverse.local',
  'org@sciverse.local',
];

export default function LoginScreen({ onLoggedIn }: { onLoggedIn: (token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) { setError('Enter email and password.'); return; }
    setBusy(true); setError(null);
    try {
      // Verified against the database on this device. No server, no network.
      const res = await api.login(email.trim(), password);
      await setToken(res.token);
      onLoggedIn(res.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  function useAccount(account: string) {
    setEmail(account);
    setPassword('Sciverse123!');
    setError(null);
  }

  return (
    <GlassBackground>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={st.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={st.brandRow}>
          <LinearGradient
            colors={[theme.accent, theme.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={st.brandMark}
          >
            <Text style={st.brandMarkText}>SP</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={st.masthead}>Sciverse Press</Text>
            <Text style={s.muted}>Field reporting for delegates</Text>
          </View>
        </View>

        <GlassPanel style={{ marginTop: 22 }}>
          <Eyebrow label="Sign in" />
          <Text style={[s.h, { marginTop: 6, marginBottom: 14 }]}>Welcome back</Text>

          <TextInput
            style={s.input}
            placeholder="Email"
            placeholderTextColor={theme.faint}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            accessibilityLabel="Email"
          />
          <TextInput
            style={s.input}
            placeholder="Password"
            placeholderTextColor={theme.faint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            accessibilityLabel="Password"
          />

          {error ? (
            <View style={st.errorBox}>
              <Text style={{ color: theme.red, fontSize: 13, fontWeight: '700' }}>{error}</Text>
            </View>
          ) : null}

          <GradientButton
            label={busy ? 'Signing in…' : 'Sign in'}
            onPress={submit}
            disabled={busy}
            style={{ marginTop: 6 }}
          />

          <Text style={[s.muted, { marginTop: 16, marginBottom: 8 }]}>
            Demo accounts — tap to fill (password <Text style={{ color: theme.ink2, fontWeight: '800' }}>Sciverse123!</Text>)
          </Text>
          <View style={st.chipWrap}>
            {DEMO_ACCOUNTS.map((a) => (
              <Pressable
                key={a}
                onPress={() => useAccount(a)}
                accessibilityRole="button"
                accessibilityLabel={`Use ${a}`}
                style={({ pressed }) => [st.chip, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={st.chipText}>{a.split('@')[0]}</Text>
              </Pressable>
            ))}
          </View>
        </GlassPanel>

        <Text style={[s.tiny, { textAlign: 'center', marginTop: 18 }]}>
          Works fully offline · data stays on this device
        </Text>
      </ScrollView>
    </GlassBackground>
  );
}

const st = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 54, paddingBottom: 40, flexGrow: 1, justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.accent,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  brandMarkText: { color: '#04121a', fontWeight: '900', fontSize: 21, letterSpacing: -0.5 },
  masthead: { color: theme.ink, fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  errorBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,122,122,0.35)',
    backgroundColor: 'rgba(255,122,122,0.10)',
    padding: 12,
    marginBottom: 10,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(56,225,255,0.28)',
    backgroundColor: 'rgba(56,225,255,0.08)',
  },
  chipText: { color: theme.accent, fontSize: 12.5, fontWeight: '800' },
});
