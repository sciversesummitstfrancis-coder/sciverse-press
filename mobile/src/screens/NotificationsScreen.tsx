import { FlatList, Pressable, Text, View } from 'react-native';
import { api } from '../api';
import { Card, Empty, ErrorBox, Eyebrow, GlassBackground, GhostButton, Loading, palette, s, useFetch } from '../ui';

export default function NotificationsScreen({ nav }: { nav?: any }) {
  const q = useFetch(() => api.notifications());

  async function markRead(id: string) {
    try { await api.markRead(id); } catch { /* keep optimistic */ }
    q.refresh();
  }

  return (
    <GlassBackground>
      <FlatList
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <Eyebrow label="Newsroom" />
            <Text style={s.title}>Alerts</Text>
          </View>
        }
        data={q.data ?? []}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <Card>
            <View style={s.row}>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: item.read ? 'rgba(255,255,255,0.07)' : 'rgba(56,225,255,0.16)',
                  borderWidth: 1,
                  borderColor: item.read ? 'rgba(255,255,255,0.12)' : 'rgba(56,225,255,0.4)',
                }}
              >
                <Text style={{ color: item.read ? palette.muted : palette.accent, fontWeight: '800', fontSize: 10.5 }}>
                  {item.read ? 'read' : 'new'}
                </Text>
              </View>
              <Text style={s.tiny}>{new Date(item.createdAt ?? Date.now()).toLocaleString()}</Text>
            </View>
            <Text style={[s.h, { marginTop: 8 }]}>{item.title}</Text>
            <Text style={s.body}>{item.message}</Text>
            {!item.read ? (
              <GhostButton
                label="Mark as read"
                onPress={() => markRead(item.id)}
                style={{ marginTop: 12, alignSelf: 'flex-start' }}
              />
            ) : null}
          </Card>
        )}
        ListEmptyComponent={
          q.loading ? <Loading /> : q.error ? <ErrorBox message={q.error} onRetry={q.refresh} /> : <Empty label="You're all caught up." />
        }
      />
    </GlassBackground>
  );
}
