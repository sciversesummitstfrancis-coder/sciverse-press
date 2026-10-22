import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { FadeIn } from '../anim';
import { getApiBase, request } from '../api';
import { Card, palette, s } from '../ui';

/**
 * First-run setup for the mobile app.
 *
 * A fresh install has no committees or stories, so the app looked empty and
 * broken. This walks the admin through the first committee and points them
 * at the next steps. The whole thing works offline against the local
 * database, and syncs to the server when one is configured.
 */
export default function SetupPanel({ nav, isAdmin }: { nav: any; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [abbr, setAbbr] = useState('');
  const [venue, setVenue] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isAdmin) {
    return (
      <Card>
        <Text style={[s.h, { marginTop: 0 }]}>The newsroom is being set up</Text>
        <Text style={s.body}>
          No committees exist yet. An admin creates them from the Admin centre — once there is
          a committee, its live status and progress appear here.
        </Text>
      </Card>
    );
  }

  async function create() {
    setErr(''); setMsg(''); setBusy(true);
    try {
      const base = await getApiBase();
      await request('/committees', base, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), abbreviation: abbr.trim(), venue: venue.trim() }),
      });
      setMsg(`${name} created. Add your team from the Admin centre, then file the first story.`);
      setName(''); setAbbr(''); setVenue(''); setOpen(false);
    } catch (e) {
      setErr(
        e instanceof Error && /network|fetch|Failed/i.test(e.message)
          ? 'Could not reach the server. Check the server address, or create it from the Admin centre when connected.'
          : String(e instanceof Error ? e.message : e),
      );
    } finally {
      setBusy(false);
    }
  }

  const steps: Array<[string, string, string]> = [
    ['1', 'Create a committee', 'Committees are the working groups of the summit.'],
    ['2', 'Add your team', 'Create press, EB, chair and coordinator accounts.'],
    ['3', 'File the first story', 'Publish a dispatch to open the pressroom.'],
  ];

  return (
    <Card>
      <Text style={[s.h, { marginTop: 0 }]}>Set up your newsroom</Text>
      <Text style={[s.body, { marginBottom: 12 }]}>
        Three steps and this app comes alive. Nothing is pre-filled — you decide the committees,
        the people and the stories.
      </Text>

      {steps.map(([n, t, d]) => (
        <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(56,225,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: palette.accent, fontWeight: '900', fontSize: 12 }}>{n}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.ink, fontWeight: '700', fontSize: 14 }}>{t}</Text>
            <Text style={s.tiny}>{d}</Text>
          </View>
          {n === '1' ? (
            <Pressable style={s.btnGhost} onPress={() => setOpen((v) => !v)} accessibilityRole="button">
              <Text style={s.btnGhostText}>{open ? 'Cancel' : 'Start'}</Text>
            </Pressable>
          ) : n === '2' ? (
            <Pressable style={s.btnGhost} onPress={() => nav.navigate('Admin')} accessibilityRole="button">
              <Text style={s.btnGhostText}>Admin</Text>
            </Pressable>
          ) : (
            <Pressable style={s.btnGhost} onPress={() => nav.navigate('Editor')} accessibilityRole="button">
              <Text style={s.btnGhostText}>Story</Text>
            </Pressable>
          )}
        </View>
      ))}

      {open ? (
        <View style={{ marginTop: 8 }}>
          <FadeIn>
            <TextInput style={s.input} placeholder="Committee name" value={name} onChangeText={setName} accessibilityLabel="Committee name" />
            <TextInput style={s.input} placeholder="Abbreviation" value={abbr} onChangeText={setAbbr} accessibilityLabel="Abbreviation" />
            <TextInput style={s.input} placeholder="Venue" value={venue} onChangeText={setVenue} accessibilityLabel="Venue" />
            <Pressable style={s.btn} onPress={create} disabled={busy || !name.trim() || !abbr.trim()} accessibilityRole="button" accessibilityLabel="Create committee">
              <Text style={s.btnText}>{busy ? 'Creating…' : 'Create committee'}</Text>
            </Pressable>
          </FadeIn>
        </View>
      ) : null}

      {msg ? <Text style={[s.tiny, { color: palette.green, marginTop: 10 }]}>{msg}</Text> : null}
      {err ? (
        <Text style={{ color: palette.red, fontSize: 13, fontWeight: '700', marginTop: 10 }}>{err}</Text>
      ) : null}
    </Card>
  );
}
