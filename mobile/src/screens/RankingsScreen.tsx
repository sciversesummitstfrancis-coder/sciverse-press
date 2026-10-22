import { FlatList, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../api';
import { Card, Empty, ErrorBox, Eyebrow, GlassBackground, Loading, palette, s, useFetch } from '../ui';

export default function RankingsScreen() {
  const q = useFetch(() => api.rankings());
  const rows = [...(q.data ?? [])].sort((a, b) => a.rank - b.rank);
  return (
    <GlassBackground>
      <FlatList
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <Eyebrow label="Floor standings" />
            <Text style={s.title}>Rankings</Text>
          </View>
        }
        data={rows}
        keyExtractor={(r) => r.delegateId}
        renderItem={({ item, index }) => (
          <Card>
            <View style={s.row}>
              <View style={s.rowTop}>
                <LinearGradient
                  colors={
                    index === 0
                      ? ['#f5c451', '#ffb454']
                      : index === 1
                        ? ['#c6cdda', '#8b93a5']
                        : index === 2
                          ? ['#d08a4a', '#8a5a2b']
                          : ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.08)']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: index < 3 ? '#04121a' : palette.ink, fontWeight: '900', fontSize: 13 }}>
                    {index + 1}
                  </Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[s.h, { marginTop: 0, marginBottom: 2 }]}>{item.name}</Text>
                  {item.committeeId ? <Text style={s.tiny}>{item.committeeId}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: palette.accent, fontWeight: '900', fontSize: 17 }}>{item.score}</Text>
                  <Text style={s.tiny}>points</Text>
                </View>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          q.loading ? <Loading /> : q.error ? <ErrorBox message={q.error} onRetry={q.refresh} /> : <Empty label="No rankings published yet." />
        }
      />
    </GlassBackground>
  );
}
