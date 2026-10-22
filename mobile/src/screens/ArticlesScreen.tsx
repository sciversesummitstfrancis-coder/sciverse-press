import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { api, loadDrafts, type Draft } from '../api';
import { Card, Empty, ErrorBox, Eyebrow, GlassBackground, GradientButton, Loading, s, useFetch } from '../ui';

export default function ArticlesScreen({ nav }: { nav: any }) {
  const q = useFetch(() => api.articles());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  useEffect(() => { loadDrafts().then(setDrafts).catch(() => {}); }, []);

  const dirty = drafts.filter((d) => d.dirty);
  return (
    <GlassBackground>
      <FlatList
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        data={q.data ?? []}
        keyExtractor={(a) => a.id}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <Eyebrow label="Wire copy" />
            <Text style={s.title}>Articles</Text>
            <View style={{ height: 14 }} />
            <GradientButton label="+ New article" onPress={() => nav.navigate('Editor')} />
            {dirty.length > 0 ? (
              <View style={{ marginTop: 12 }}>
                <Card>
                  <Text style={s.badge}>{dirty.length} unsynced draft{dirty.length > 1 ? 's' : ''}</Text>
                  {dirty.map((d) => (
                    <Text key={d.localId} style={s.muted} numberOfLines={1}>• {d.title || '(untitled)'}</Text>
                  ))}
                </Card>
              </View>
            ) : null}
            {q.loading ? <Loading /> : null}
            {q.error ? <ErrorBox message={q.error} onRetry={q.refresh} /> : null}
            {!q.loading && !q.error && !(q.data ?? []).length ? <Empty
              title="No articles yet"
              msg="File the first dispatch — it saves as you type, then goes to a coordinator for review."
            /> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => nav.navigate('Editor', { serverId: item.id })}>
            <Card>
              <Text style={s.h}>{item.title}</Text>
              <Text style={s.body} numberOfLines={3}>{item.body}</Text>
              <View style={{ height: 8 }} />
              <Text style={s.tiny}>Updated {new Date(item.updatedAt).toLocaleString()}</Text>
            </Card>
          </Pressable>
        )}
      />
    </GlassBackground>
  );
}
