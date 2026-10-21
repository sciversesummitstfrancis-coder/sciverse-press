import { FlatList, Text, View } from 'react-native';
import { api } from '../api';
import { Card, Empty, ErrorBox, Loading, s } from '../ui';
import { useFetch } from '../ui';

export default function CommitteesScreen() {
  const q = useFetch(() => api.committees());
  if (q.loading) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.refresh} />;
  if (!q.data?.length) return <Empty label="No committees found." />;
  return (
    <FlatList
      style={{ backgroundColor: '#0c0c10' }}
      contentContainerStyle={{ padding: 16 }}
      data={q.data}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => (
        <Card>
          <Text style={s.h}>{item.name}</Text>
          {item.topic ? <Text style={s.body}>{item.topic}</Text> : null}
          <View style={{ height: 6 }} />
          <Text style={s.muted}>
            {item.delegateCount != null ? `${item.delegateCount} delegates` : 'Committee'}
          </Text>
        </Card>
      )}
    />
  );
}
