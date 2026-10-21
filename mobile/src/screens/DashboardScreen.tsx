import { Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../api';
import { Card, Empty, ErrorBox, Loading, s, useFetch, FadeIn, ScaleIn, Pulse, palette } from '../ui';

export default function DashboardScreen({ nav }: { nav: any }) {
  const articles = useFetch(() => api.articles());
  const notifs = useFetch(() => api.notifications());
  const unread = (notifs.data ?? []).filter((n) => !n.read).length;

  return (
    <FadeIn delay={60}>
      <ScrollView style={s.screen}>
        <Text style={s.title}>Today’s desk</Text>
        <Card>
          <View style={s.row}>
            <Pulse>
              <Text style={[s.badge, { backgroundColor: palette.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginRight: 10, color: "#04121a", fontWeight: "800" }]}>{unread} unread</Text>
            </Pulse>
            <Text style={s.body}>Latest filings, rankings and committee moves.</Text>
          </View>
          <Pressable style={s.btnGhost} onPress={() => nav.navigate('Notifications')}>
            <Text style={s.btnGhostText}>View notifications</Text>
          </Pressable>
          <View style={{ height: 10 }} />
          <Pressable style={s.btnGhost} onPress={() => nav.navigate('Activity')}>
            <Text style={s.btnGhostText}>Live newsroom feed</Text>
          </Pressable>
        </Card>
        <Text style={s.h}>Latest articles</Text>
        {articles.loading ? <Loading /> : null}
        {articles.error ? <ErrorBox message={articles.error} onRetry={articles.refresh} /> : null}
        {!articles.loading && !articles.error && (articles.data ?? []).length === 0 ? (
          <Empty label="No articles yet. File the first dispatch." />
        ) : null}
        <ScaleIn delay={120}>
          {(articles.data ?? []).slice(0, 5).map((a) => (
            <Card key={a.id}>
              <Text style={s.h}>{a.title}</Text>
              <Text style={s.muted} numberOfLines={2}>{a.body}</Text>
            </Card>
          ))}
        </ScaleIn>
        <Pressable style={s.btn} onPress={() => nav.navigate('Editor')}>
          <Text style={s.btnText}>+ New article</Text>
        </Pressable>
      </ScrollView>
    </FadeIn>
  );
}
