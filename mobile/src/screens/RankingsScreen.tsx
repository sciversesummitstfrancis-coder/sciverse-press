import { FlatList, Text } from 'react-native';
import { api } from '../api';
import { Card, Empty, ErrorBox, Loading, s, useFetch } from '../ui';

export default function RankingsScreen() {
  const q = useFetch(() => api.rankings());
  if (q.loading) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.refresh} />;
  const rows = [...(q.data ?? [])].sort((a, b) => a.rank - b.rank);
  if (!rows.length) return <Empty label="No rankings published yet." />;
  return (
    <FlatList
      style={{ backgroundColor: '#0c0c10' }}
      contentContainerStyle={{ padding: 16 }}
      data={rows}
      keyExtractor={(r) => r.delegateId}
      renderItem={({ item }) => (
        <Card>
          <Text style={s.badge}>#{item.rank} · {item.score} pts</Text>
          <Text style={s.h}>{item.name}</Text>
          {item.committeeId ? <Text style={s.muted}>{item.committeeId}</Text> : null}
        </Card>
      )}
    />
  );
}
