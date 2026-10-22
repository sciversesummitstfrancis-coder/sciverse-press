import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { currentUserInfo, setToken } from '../api';
import { Eyebrow, GlassBackground, GlassPanel, GradientButton, GhostButton, palette, s, theme } from '../ui';

export default function ProfileScreen({ onLogout, nav }: { onLogout: () => void; nav?: any }) {
  const user = currentUserInfo();
  const isAdmin = user?.role === 'admin';

  async function logout() {
    await setToken(null);
    onLogout();
  }

  return (
    <GlassBackground>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <Eyebrow label="Your account" />
        <Text style={s.title}>Profile</Text>

        <GlassPanel style={{ marginTop: 14 }}>
          <View style={s.rowTop}>
            <LinearGradient
              colors={[theme.accent, theme.violet]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#04121a', fontWeight: '900', fontSize: 17 }}>
                {(user?.name ?? 'SP').slice(0, 2).toUpperCase()}
              </Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[s.h, { marginTop: 0, marginBottom: 2 }]}>{user?.name ?? 'Signed in'}</Text>
              <Text style={s.muted}>{user?.email}</Text>
              {user?.role ? (
                <View style={{ alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(56,225,255,0.14)', borderWidth: 1, borderColor: 'rgba(56,225,255,0.35)' }}>
                  <Text style={{ color: palette.accent, fontWeight: '800', fontSize: 11 }}>{user.role}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </GlassPanel>

        <GlassPanel style={{ marginTop: 12 }}>
          <Text style={s.h}>Storage</Text>
          <Text style={s.body}>
            Your data is stored on this device. The app works with no server and no
            internet connection.
          </Text>
        </GlassPanel>

        {isAdmin ? (
          <GradientButton
            label="Admin centre"
            onPress={() => nav?.navigate?.('Admin')}
            style={{ marginTop: 14 }}
          />
        ) : null}
        <GhostButton
          label="Live newsroom"
          onPress={() => nav?.navigate?.('Activity')}
          style={{ marginTop: 10 }}
        />
        <GhostButton
          label="Log out"
          onPress={logout}
          textStyle={{ color: palette.red }}
          style={{ marginTop: 10 }}
        />

        <Text style={[s.tiny, { textAlign: 'center', marginTop: 18 }]}>
          Sciverse Press · v1.2.0 · offline first
        </Text>
      </ScrollView>
    </GlassBackground>
  );
}
