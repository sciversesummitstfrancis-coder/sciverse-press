import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, setToken } from '../api';
import { s, theme } from '../ui';

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
    <View style={s.screen}>
      <Text style={st.masthead}>Sciverse Press</Text>
      <Text style={s.muted}>Field reporting for delegates.</Text>
      <View style={{ height: 24 }} />
      <TextInput style={s.input} placeholder="Email" placeholderTextColor={theme.muted}
        value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={s.input} placeholder="Password" placeholderTextColor={theme.muted}
        value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={s.err}>{error}</Text> : null}
      <Pressable style={s.btn} onPress={submit} disabled={busy} accessibilityRole="button" accessibilityLabel="Log in">
        <Text style={s.btnText}>{busy ? 'Signing in…' : 'Log in'}</Text>
      </Pressable>

      <View style={{ height: 22 }} />
      <Text style={s.muted}>Demo accounts (tap to fill) — password Sciverse123!</Text>
      <View style={{ height: 8 }} />
      {DEMO_ACCOUNTS.map((a) => (
        <Pressable
          key={a}
          onPress={() => useAccount(a)}
          accessibilityRole="button"
          accessibilityLabel={`Use ${a}`}
          style={st.account}
        >
          <Text style={st.accountText}>{a}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  masthead: { color: theme.ink, fontSize: 32, fontWeight: '800', fontFamily: 'serif' },
  account: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 10,
    marginBottom: 6,
  },
  accountText: { color: theme.accent, fontSize: 13, fontWeight: '700' },
});
