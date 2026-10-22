import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api, loadDrafts, syncDrafts, upsertDraft, type Draft } from '../api';
import { Card, Eyebrow, GlassBackground, GlassPanel, GradientButton, GhostButton, s, theme } from '../ui';

function nid() {
  return `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export default function EditorScreen({ route, navigation }: any) {
  const { localId, serverId } = (route?.params ?? {}) as { localId?: string; serverId?: string };
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState('Ready');
  const [conflict, setConflict] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      if (serverId) {
        try {
          const remote = await api.article(serverId);
          const d: Draft = {
            localId: localId ?? nid(), serverId,
            title: remote.title, body: remote.body,
            updatedAt: remote.updatedAt, dirty: false,
          };
          setDraft(d); setTitle(d.title); setBody(d.body);
          await upsertDraft(d);
        } catch (e) {
          setStatus(e instanceof Error ? e.message : 'Failed to load article');
        }
      } else if (localId) {
        const all = await loadDrafts();
        const d = all.find((x) => x.localId === localId);
        if (d) { setDraft(d); setTitle(d.title); setBody(d.body); }
      } else {
        const d: Draft = { localId: nid(), title: '', body: '', updatedAt: new Date().toISOString(), dirty: false };
        setDraft(d);
        await upsertDraft(d);
      }
    })();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [localId, serverId]);

  function queueAutosave(nextTitle: string, nextBody: string) {
    if (timer.current) clearTimeout(timer.current);
    setStatus('Editing…');
    timer.current = setTimeout(async () => {
      if (!draft) return;
      const d: Draft = {
        ...draft, title: nextTitle, body: nextBody,
        updatedAt: new Date().toISOString(), dirty: true,
      };
      setDraft(d);
      await upsertDraft(d);
      setStatus('Draft saved locally ✓');
    }, 800);
  }

  async function sync() {
    setStatus('Syncing…'); setConflict(false);
    const res = await syncDrafts();
    const all = await loadDrafts();
    const mine = draft ? all.find((x) => x.localId === draft.localId) : undefined;
    if (mine) {
      setDraft(mine); setTitle(mine.title); setBody(mine.body);
      if (res.conflicts.some((c) => c.localId === mine.localId)) {
        setConflict(true);
        setStatus('Conflict: server had a newer version — server copy kept.');
      } else if (res.errors.length) {
        setStatus(`Sync error: ${res.errors[0]?.slice(0, 160)}`);
      } else {
        setStatus(mine.dirty ? 'Still offline — kept locally.' : 'Synced ✓');
      }
    } else {
      setStatus(`Synced ${res.synced} draft(s).`);
    }
  }

  return (
    <GlassBackground>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Eyebrow label="Copy desk" />
        <Text style={s.title}>Editor</Text>
        <View style={{ height: 12 }} />
        {conflict ? (
          <Card><Text style={{ color: theme.red }}>Server version was newer; local edits were replaced.</Text></Card>
        ) : null}
        <GlassPanel>
          <TextInput
            style={[s.input, { backgroundColor: 'rgba(255,255,255,0.04)' }]}
            placeholder="Headline"
            placeholderTextColor={theme.faint}
            value={title}
            onChangeText={(t) => { setTitle(t); queueAutosave(t, body); }}
            accessibilityLabel="Headline"
          />
          <TextInput
            style={[s.input, { backgroundColor: 'rgba(255,255,255,0.04)', minHeight: 160, textAlignVertical: 'top' }]}
            placeholder="Write the story\u2026"
            placeholderTextColor={theme.faint}
            value={body}
            multiline
            onChangeText={(b) => { setBody(b); queueAutosave(title, b); }}
            accessibilityLabel="Story body"
          />
          <Text style={s.tiny}>{status}</Text>
        </GlassPanel>
        <GradientButton label="Save & sync" onPress={sync} style={{ marginTop: 14 }} />
        <GhostButton label="Back" onPress={() => navigation?.goBack?.()} style={{ marginTop: 10 }} />
      </ScrollView>
    </GlassBackground>
  );
}
