import { useState } from 'react';
import { FlatList, Pressable, Text } from 'react-native';
import { api, loadDrafts, type Draft } from '../api';
import { Card, Empty, ErrorBox, Loading, s, useFetch } from '../ui';
import { useEffect } from 'react';

export default function ArticlesScreen({ nav }: { nav: any }) {
  const q = useFetch(() => api.articles());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  useEffect(() => { loadDrafts().then(setDrafts).catch(() => {}); }, []);

  const dirty = drafts.filter((d) => d.dirty);
  return (
    <FlatList
      style={{ backgroundColor: '#0c0c10' }}
      contentContainerStyle={{ padding: 16 }}
      data={q.data ?? []}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={
        <>
          <Pressable style={s.btn} onPress={() => nav.navigate('Editor')}>
            <Text style={s.btnText}>+ New article</Text>
          </Pressable>
          {dirty.length > 0 ? (
            <Card>
              <Text style={s.badge}>{dirty.length} unsynced draft{dirty.length > 1 ? 's' : ''}</Text>
              {dirty.map((d) => (
                <Text key={d.localId} style={s.muted} numberOfLines={1}>• {d.title || '(untitled)'}</Text>
              ))}
            </Card>
          ) : null}
          {q.loading ? <Loading /> : null}
          {q.error ? <ErrorBox message={q.error} onRetry={q.refresh} /> : null}
          {!q.loading && !q.error && !(q.data ?? []).length ? (
            <Empty label="No articles yet." />
          ) : null}
        </>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => nav.navigate('Editor', { serverId: item.id })}>
          <Card>
            <Text style={s.h}>{item.title}</Text>
            <Text style={s.muted} numberOfLines={2}>{item.body}</Text>
            <Text style={s.muted}>Updated {new Date(item.updatedAt).toLocaleString()}</Text>
          </Card>
        </Pressable>
      )}
    />
  );
}
