import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { getToken, restoreSession, setCurrentUser } from './src/api';
import { GlassBackground, palette, theme } from './src/ui';
import ArticlesScreen from './src/screens/ArticlesScreen';
import ActivityScreen from './src/screens/ActivityScreen';
import AdminScreen from './src/screens/AdminScreen';
import CommitteesScreen from './src/screens/CommitteesScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import EditorScreen from './src/screens/EditorScreen';
import LoginScreen from './src/screens/LoginScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import RankingsScreen from './src/screens/RankingsScreen';

export type RootStackParamList = {
  Login: undefined;
  Tabs: undefined;
  Dashboard: undefined;
  Committees: undefined;
  Rankings: undefined;
  Articles: undefined;
  Editor: { localId?: string; serverId?: string } | undefined;
  Notifications: undefined;
  Profile: undefined;
  Admin: undefined;
  Activity: undefined;
};

const Stack = createNativeStackPager();

function createNativeStackPager() {
  return createNativeStackNavigator<RootStackParamList>();
}

const TABS: { key: keyof RootStackParamList; label: string }[] = [
  { key: 'Dashboard', label: 'Home' },
  { key: 'Committees', label: 'Committees' },
  { key: 'Rankings', label: 'Rankings' },
  { key: 'Articles', label: 'Articles' },
  { key: 'Notifications', label: 'Alerts' },
  { key: 'Profile', label: 'Profile' },
];

function TabBar({ nav, routeName }: { nav: any; routeName: string }) {
  return (
    <View style={st.tabbarWrap}>
      <BlurView
        intensity={44}
        tint="dark"
        style={StyleSheet.absoluteFill}
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
      />
      <View style={st.tabbarInner}>
        <View style={st.tabSheen} />
        {TABS.map((t) => {
          const active = routeName === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => nav.navigate(t.key)}
              accessibilityRole="button"
              accessibilityLabel={t.label}
              accessibilityState={{ selected: active }}
              style={st.tabBtn}
            >
              <View style={[st.tabDot, active && st.tabDotActive]} />
              <Text style={[st.tabText, active && st.tabActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  const [token, setTok] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        // Restores the session from the local database (works offline).
        const user = await restoreSession();
        const token = await getToken();
        setTok(user && token ? token : null);
      } catch {
        setTok(null);
      }
    })();
  }, []);

  if (token === undefined) {
    return (
      <GlassBackground>
        <View style={st.splash}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={st.splashText}>Sciverse Press</Text>
        </View>
      </GlassBackground>
    );
  }

  return (
    <GlassBackground>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: 'rgba(8,10,18,0.78)' },
            headerTintColor: theme.ink,
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: '800', fontSize: 17 },
            contentStyle: { backgroundColor: 'transparent' },
          }}
        >
        {token === null ? (
          <Stack.Screen name="Login" options={{ headerShown: false }}>
            {({ navigation }) => (
              <LoginScreen onLoggedIn={(t) => { setTok(t); navigation.navigate('Dashboard'); }} />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen
              name="Dashboard"
              options={({ navigation, route }) => ({
                title: 'Sciverse Press',
                headerRight: () => (
                  <Pressable
                    onPress={() => (navigation as any).navigate('Editor')}
                    style={st.compose}
                    accessibilityRole="button"
                    accessibilityLabel="New article"
                  >
                    <Text style={st.composeText}>+ New</Text>
                  </Pressable>
                ),
              })}
            >
              {({ navigation, route }) => (
                <View style={{ flex: 1 }}>
                  <View style={{ flex: 1 }}>
                    <DashboardScreen nav={navigation} />
                  </View>
                  <TabBar nav={navigation} routeName={route.name} />
                </View>
              )}
            </Stack.Screen>
            {(['Committees', 'Rankings', 'Articles', 'Notifications', 'Profile'] as const).map((n) => (
              <Stack.Screen key={n} name={n} options={{ title: n }}>
                {({ navigation, route }: any) => {
                  const Screens: Record<string, any> = {
                    Committees: CommitteesScreen,
                    Rankings: RankingsScreen,
                    Articles: ArticlesScreen,
                    Notifications: NotificationsScreen,
                    Profile: ProfileScreen,
                  };
                  const S = Screens[n];
                  const extra = n === 'Articles' || n === 'Notifications' ? { nav: navigation }
                    : n === 'Profile' ? {
                        onLogout: () => { setCurrentUser(null); setTok(null); },
                        nav: navigation,
                      } : {};
                  return (
                    <View style={{ flex: 1 }}>
                      <View style={{ flex: 1 }}><S {...extra} /></View>
                      <TabBar nav={navigation} routeName={route.name} />
                    </View>
                  );
                }}
              </Stack.Screen>
            ))}
            <Stack.Screen name="Admin" options={{ title: 'Admin' }} component={AdminScreen} />
            <Stack.Screen name="Activity" options={{ title: 'Live newsroom' }} component={ActivityScreen} />
            <Stack.Screen name="Editor" options={{ title: 'Editor' }} component={EditorScreen} />
          </>
        )}
        </Stack.Navigator>
      </NavigationContainer>
    </GlassBackground>
  );
}

const st = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  splashText: { color: theme.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  tabbarWrap: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    backgroundColor: 'rgba(8,10,18,0.55)',
  },
  tabbarInner: { flexDirection: 'row', alignItems: 'center' },
  tabSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', minHeight: 56, justifyContent: 'center', gap: 5 },
  tabDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  tabDotActive: { width: 18, backgroundColor: theme.accent },
  tabText: { color: theme.muted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  tabActive: { color: theme.accent },
  compose: {
    backgroundColor: 'rgba(56,225,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56,225,255,0.45)',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  composeText: { color: theme.accent, fontWeight: '800', fontSize: 13 },
});
