import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getToken, restoreSession, setCurrentUser } from './src/api';
import { theme } from './src/ui';
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
    <View style={st.tabbar}>
      {TABS.map((t) => (
        <Pressable
          key={t.key}
          onPress={() => nav.navigate(t.key)}
          accessibilityRole="button"
          accessibilityLabel={t.label}
          style={st.tabBtn}
        >
          <Text style={[st.tabText, routeName === t.key && st.tabActive]}>{t.label}</Text>
        </Pressable>
      ))}
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
      <View style={st.splash}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={st.splashText}>Sciverse Press</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerStyle: { backgroundColor: theme.bg }, headerTintColor: theme.ink }}
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
  );
}

const st = StyleSheet.create({
  splash: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  splashText: { color: theme.ink, fontSize: 24, fontFamily: 'serif', fontWeight: '700' },
  tabbar: { flexDirection: 'row', backgroundColor: '#101016', borderTopColor: theme.line, borderTopWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 16, alignItems: 'center', minHeight: 56 },
  tabText: { color: theme.muted, fontSize: 12, fontWeight: '700' },
  tabActive: { color: theme.accent },
  compose: { backgroundColor: theme.accent, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  composeText: { color: '#111', fontWeight: '800' },
});
