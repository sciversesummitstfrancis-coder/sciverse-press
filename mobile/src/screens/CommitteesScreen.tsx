import { FlatList, Text, View } from 'react-native';
import { api } from '../api';
import { Card, Empty, ErrorBox, Eyebrow, GlassBackground, Loading, palette, s, useFetch } from '../ui';

export default function CommitteesScreen() {
  const q = useFetch(() => api.committees());
  return (
    <GlassBackground>
      <FlatList
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <Eyebrow label="Who’s who" />
            <Text style={s.title}>Committees</Text>
          </View>
        }
        data={q.data ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <Card>
            <View style={s.row}>
              <Text style={s.h}>{item.name}</Text>
              <View style={{ backgroundColor: 'rgba(56,225,255,0.14)', borderWidth: 1, borderColor: 'rgba(56,225,255,0.32)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                <Text style={{ color: palette.accent, fontWeight: '800', fontSize: 11 }}>
                  {item.delegateCount ?? 0}
                </Text>
              </View>
            </View>
            {item.topic ? <Text style={s.body}>{item.topic}</Text> : null}
            <View style={{ height: 8 }} />
            <Text style={s.tiny}>
              {item.delegateCount != null ? `${item.delegateCount} delegates` : 'Committee'}
            </Text>
          </Card>
        )}
        ListEmptyComponent={
          q.loading ? <Loading /> : q.error ? <ErrorBox message={q.error} onRetry={q.refresh} /> : <Empty label="No committees found." />
        }
      />
    </GlassBackground>
  );
}
