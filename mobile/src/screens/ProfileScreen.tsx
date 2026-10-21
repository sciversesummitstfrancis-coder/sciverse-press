import { Pressable, Text, View } from 'react-native';
import { currentUserInfo, setToken } from '../api';
import { UpdateRow } from '../updates';
import { s, theme } from '../ui';

export default function ProfileScreen({ onLogout, nav }: { onLogout: () => void; nav?: any }) {
  const user = currentUserInfo();
  const isAdmin = user?.role === 'admin';

  async function logout() {
    await setToken(null);
    onLogout();
  }

  return (
    <View style={s.screen}>
      <Text style={s.title}>Profile</Text>
      <Text style={s.muted}>
        {user ? `${user.name} · ${user.role}` : 'Signed in'}
      </Text>
      <Text style={[s.muted, { marginTop: 6 }]}>
        Your data is stored on this device. The app works with no server and no
        internet connection.
      </Text>

      <View style={{ height: 18 }} />
      {isAdmin ? (
        <Pressable
          style={s.btn}
          onPress={() => nav?.navigate?.('Admin')}
          accessibilityRole="button"
          accessibilityLabel="Admin centre"
        >
          <Text style={s.btnText}>Admin centre</Text>
        </Pressable>
      ) : null}
      <View style={{ height: 10 }} />
      <Pressable
        style={s.btnGhost}
        onPress={() => nav?.navigate?.('Activity')}
        accessibilityRole="button"
        accessibilityLabel="Live newsroom"
      >
        <Text style={s.btnGhostText}>Live newsroom</Text>
      </Pressable>

      <View style={{ height: 10 }} />
      <Pressable style={s.btnGhost} onPress={logout} accessibilityRole="button" accessibilityLabel="Log out">
        <Text style={s.btnGhostText}>Log out</Text>
      </Pressable>

      <UpdateRow />

      <View style={{ height: 12 }} />
      <Text style={[s.muted, { color: theme.muted }]}>
        Sign in with admin@sciverse.local / Sciverse123!
      </Text>
    </View>
  );
}
