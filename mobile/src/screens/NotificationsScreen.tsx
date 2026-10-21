import { FlatList, Pressable, Text } from 'react-native';
import { api } from '../api';
import { Card, Empty, ErrorBox, Loading, s, useFetch } from '../ui';

export default function NotificationsScreen({ nav }: { nav?: any }) {
  const q = useFetch(() => api.notifications());

  async function markRead(id: string) {
    try { await api.markRead(id); } catch { /* keep optimistic */ }
    q.refresh();
  }

  if (q.loading) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.refresh} />;
  if (!q.data?.length) return <Empty label="You're all caught up." />;

  return (
    <FlatList
      style={{ backgroundColor: '#0c0c10' }}
      contentContainerStyle={{ padding: 16 }}
      data={q.data}
      keyExtractor={(n) => n.id}
      renderItem={({ item }) => (
        <Card>
          <Text style={s.badge}>{item.read ? 'read' : 'new'}</Text>
          <Text style={s.h}>{item.title}</Text>
          <Text style={s.body}>{item.message}</Text>
          {!item.read ? (
            <Pressable style={s.btnGhost} onPress={() => markRead(item.id)}>
              <Text style={s.btnGhostText}>Mark as read</Text>
            </Pressable>
          ) : null}
        </Card>
      )}
    />
  );
}
