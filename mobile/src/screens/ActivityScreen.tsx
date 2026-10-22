import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { FadeIn } from '../anim';
import { api } from '../api';
import { Card, Empty, ErrorBox, Eyebrow, GlassBackground, Loading, palette, s } from '../ui';

export interface ActivityItem {
  action: string;
  entity: string;
  entityId: string;
  title: string;
  detail: string;
  actor: string;
  at: string;
}

const VERB: Record<string, string> = {
  'article.create': 'filed a story',
  'article.update': 'edited a story',
  'article.publish': 'published',
  'article.review': 'reviewed a story',
  'committee.create': 'created a committee',
  'committee.update': 'updated a committee',
  'committee.progress': 'reported committee progress',
  'user.create': 'created an account',
  'user.delete': 'deleted an account',
  'user.role.change': 'changed a role',
  'delegate.register': 'registered a delegate',
  'point.award': 'awarded points',
  'announcement.create': 'posted an announcement',
};

function describe(a: ActivityItem): string {
  const verb = VERB[a.action] ?? a.action.replace(/[._]/g, ' ');
  const what = a.title || a.detail;
  return what ? `${verb} — ${what}` : verb;
}

function ago(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch {
    return '';
  }
}

/** Live newsroom ticker for the mobile app. */
export default function ActivityTicker() {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const res = await api.activity(25);
        if (alive) {
          setItems(res ?? []);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) timer = setTimeout(load, 15000);
      }
    };
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  if (error) return <ErrorBox message={error} onRetry={() => setItems(null)} />;
  if (!items) return <Loading />;
  if (!items.length)
    return (
      <GlassBackground>
        <View style={s.screen}>
          <Empty
            title="Nothing yet"
            msg="Activity across the summit will appear here as it happens."
          />
        </View>
      </GlassBackground>
    );

  return (
    <GlassBackground>
    <FlatList
      style={{ backgroundColor: 'transparent' }}
      contentContainerStyle={{ padding: 16 }}
      data={items}
      keyExtractor={(i) => `${i.action}-${i.entityId}-${i.at}`}
      renderItem={({ item, index }) => (
        <FadeIn delay={Math.min(index * 0.03, 0.3)}>
          <Card>
            <View style={s.row}>
              <Text style={{ color: palette.ink, fontWeight: '800', fontSize: 14 }}>{item.actor}</Text>
              <Text style={[s.muted, { fontSize: 11.5 }]}>{ago(item.at)}</Text>
            </View>
            <Text style={[s.body, { marginTop: 4 }]}>{describe(item)}</Text>
          </Card>
        </FadeIn>
      )}
    />
    </GlassBackground>
  );
}
