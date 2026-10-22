import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../api';
import {
  Card,
  Empty,
  ErrorBox,
  Eyebrow,
  GlassBackground,
  GradientButton,
  Loading,
  palette,
  s,
  useFetch,
  FadeIn,
  ScaleIn,
  Pulse,
} from '../ui';

export default function DashboardScreen({ nav }: { nav: any }) {
  const articles = useFetch(() => api.articles());
  const notifs = useFetch(() => api.notifications());
  const unread = (notifs.data ?? []).filter((n) => !n.read).length;

  return (
    <GlassBackground>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.screenPad} showsVerticalScrollIndicator={false}>
        <FadeIn delay={40}>
          <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
            <Eyebrow label="Today’s desk" />
            <Text style={s.title}>Sciverse Press</Text>
            <Text style={s.sub}>Latest filings, rankings and committee moves.</Text>
          </View>

          <View style={{ paddingHorizontal: 16 }}>
            <Card>
              <LinearGradient
                colors={['rgba(56,225,255,0.22)', 'rgba(167,139,250,0.12)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
              <View style={s.row}>
                <Pulse>
                  <View style={{ backgroundColor: 'rgba(56,225,255,0.18)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(56,225,255,0.4)' }}>
                    <Text style={{ color: palette.accent, fontWeight: '900', fontSize: 12 }}>
                      {unread} unread
                    </Text>
                  </View>
                </Pulse>
                <Pressable
                  style={s.btnGhost}
                  onPress={() => nav.navigate('Notifications')}
                  accessibilityRole="button"
                  accessibilityLabel="View notifications"
                >
                  <Text style={s.btnGhostText}>Alerts</Text>
                </Pressable>
              </View>
            </Card>

            <Text style={[s.h, { marginTop: 14 }]}>Latest articles</Text>
            {articles.loading ? <Loading /> : null}
            {articles.error ? <ErrorBox message={articles.error} onRetry={articles.refresh} /> : null}
            {!articles.loading && !articles.error && (articles.data ?? []).length === 0 ? (
              <Empty label="No articles yet. File the first dispatch." />
            ) : null}

            <ScaleIn delay={100}>
              {(articles.data ?? []).slice(0, 5).map((a) => (
                <Card key={a.id}>
                  <Text style={s.h}>{a.title}</Text>
                  <Text style={s.body} numberOfLines={3}>{a.body}</Text>
                  <View style={{ height: 8 }} />
                  <Text style={s.tiny}>
                    {a.authorName ? `${a.authorName} · ` : ''}
                    {new Date(a.updatedAt).toLocaleString()}
                  </Text>
                </Card>
              ))}
            </ScaleIn>

            <GradientButton label="+ New article" onPress={() => nav.navigate('Editor')} />
          </View>
        </FadeIn>
      </ScrollView>
    </GlassBackground>
  );
}
