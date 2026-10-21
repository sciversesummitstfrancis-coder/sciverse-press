import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FadeIn } from '../anim';
import { api, currentUserInfo } from '../api';
import { Card, Empty, ErrorBox, Loading, palette, s } from '../ui';

const ROLES = ['press', 'eb', 'chair', 'coordinator', 'admin', 'organizer'] as const;

export interface Account {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
  activeSessions: number;
  articleCount: number;
  committeeCount: number;
}

export interface AdminCommittee {
  id: string;
  name: string;
  abbreviation: string;
  venue: string;
  agenda: string;
  status: string;
  progressPercent: number;
  archived: boolean;
  memberCount: number;
  delegateCount: number;
  articleCount: number;
  sessionCount: number;
}

type Tab = 'accounts' | 'committees';

export default function AdminScreen() {
  const [tab, setTab] = useState<Tab>('accounts');
  const [role, setRole] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    const u = currentUserInfo();
    setRole(u?.role ?? null);
  }, [tick]);

  if (role === null) return <Loading />;
  if (role !== 'admin')
    return (
      <View style={s.screen}>
        <Empty label="Admins only." />
      </View>
    );

  return (
    <View style={s.screen}>
      <View style={s.row}>
        <TabButton label="Accounts" active={tab === 'accounts'} onPress={() => setTab('accounts')} />
        <TabButton label="Committees" active={tab === 'committees'} onPress={() => setTab('committees')} />
      </View>
      {msg ? <Text style={[s.muted, { color: palette.green, marginBottom: 8 }]}>{msg}</Text> : null}
      {err ? <ErrorBox message={err} onRetry={refresh} /> : null}
      {tab === 'accounts' ? (
        <AccountsTab tick={tick} refresh={refresh} setMsg={setMsg} setErr={setErr} />
      ) : (
        <CommitteesTab tick={tick} refresh={refresh} setMsg={setMsg} setErr={setErr} />
      )}
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{
        flex: 1,
        paddingVertical: 11,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? palette.accent : palette.line,
        backgroundColor: active ? palette.accentSoft : 'transparent',
        alignItems: 'center',
        marginBottom: 14,
      }}
    >
      <Text style={{ color: active ? palette.accent : palette.muted, fontWeight: '800', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------- accounts --

function AccountsTab({
  tick, refresh, setMsg, setErr,
}: {
  tick: number; refresh: () => void; setMsg: (m: string | null) => void; setErr: (m: string | null) => void;
}) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', role: 'press', password: '' });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await api.adminAccounts();
        if (alive) setAccounts(rows);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tick]);

  async function create() {
    setErr(null); setMsg(null);
    try {
      await api.createAccount(form);
      setMsg(`Created ${form.email}.`);
      setForm({ email: '', name: '', role: 'press', password: '' });
      setShowNew(false);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function setRole(id: string, role: string) {
    try {
      await api.setUserRole(id, role);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(a: Account) {
    Alert.alert('Delete account', `Delete ${a.email}? Their articles are reassigned to you.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAccount(a.id);
            setMsg(`Deleted ${a.email}.`);
            refresh();
          } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  }

  if (loading) return <Loading />;

  return (
    <ScrollView>
      <Card>
        <View style={s.row}>
          <Text style={s.h}>Accounts</Text>
          <Pressable style={s.btnGhost} onPress={() => setShowNew((v) => !v)} accessibilityRole="button">
            <Text style={s.btnGhostText}>{showNew ? 'Cancel' : 'New account'}</Text>
          </Pressable>
        </View>

        {showNew ? (
          <View style={{ marginTop: 12 }}>
            <TextInput
              style={s.input}
              placeholder="Email"
              value={form.email}
              onChangeText={(email) => setForm({ ...form, email })}
              autoCapitalize="none"
              keyboardType="email-address"
              accessibilityLabel="New account email"
            />
            <TextInput
              style={s.input}
              placeholder="Full name"
              value={form.name}
              onChangeText={(name) => setForm({ ...form, name })}
              accessibilityLabel="New account name"
            />
            <TextInput
              style={s.input}
              placeholder="Password (min 8 chars)"
              value={form.password}
              onChangeText={(password) => setForm({ ...form, password })}
              secureTextEntry
              accessibilityLabel="New account password"
            />
            <View style={s.row}>
              {ROLES.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setForm({ ...form, role: r })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: form.role === r }}
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: 11,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: form.role === r ? palette.accent : palette.line,
                    marginRight: 6,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: form.role === r ? palette.accent : palette.muted, fontSize: 12, fontWeight: '700' }}>
                    {r}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={s.btn} onPress={create} accessibilityRole="button" accessibilityLabel="Create account">
              <Text style={s.btnText}>Create account</Text>
            </Pressable>
          </View>
        ) : null}
      </Card>

      {(accounts ?? []).map((a) => (
        <FadeIn key={a.id}>
        <Card>
          <Text style={s.h}>{a.name}</Text>
          <Text style={s.muted}>{a.email}</Text>
          <Text style={[s.muted, { marginTop: 4 }]}>
            {a.articleCount} article(s) · {a.committeeCount} committee(s) · {a.activeSessions} active session(s)
          </Text>
          <View style={s.row}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', flex: 1 }}>
              {ROLES.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setRole(a.id, r)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: a.role === r }}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: a.role === r ? palette.accent : palette.line,
                    marginRight: 6,
                    marginTop: 10,
                  }}
                >
                  <Text style={{ color: a.role === r ? palette.accent : palette.muted, fontSize: 11.5, fontWeight: '700' }}>
                    {r}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable
            style={[s.btnGhost, { marginTop: 12, borderColor: palette.red }]}
            onPress={() => remove(a)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${a.email}`}
          >
            <Text style={{ color: palette.red, fontWeight: '800', fontSize: 13 }}>Delete account</Text>
          </Pressable>
        </Card>
        </FadeIn>
      ))}
      {!accounts?.length ? <Empty label="No accounts found." /> : null}
    </ScrollView>
  );
}

// -------------------------------------------------------------- committees --

function CommitteesTab({
  tick, refresh, setMsg, setErr,
}: {
  tick: number; refresh: () => void; setMsg: (m: string | null) => void; setErr: (m: string | null) => void;
}) {
  const [rows, setRows] = useState<AdminCommittee[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', abbreviation: '', venue: '' });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.adminCommittees();
        if (alive) setRows(data);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tick]);

  async function create() {
    setErr(null); setMsg(null);
    try {
      await api.createCommittee(form);
      setMsg(`Created ${form.name}.`);
      setForm({ name: '', abbreviation: '', venue: '' });
      setShowNew(false);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function patch(id: string, body: Record<string, unknown>, ok: string) {
    try {
      await api.patchCommittee(id, body);
      setMsg(ok);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(c: AdminCommittee) {
    Alert.alert(
      'Delete committee',
      `Delete ${c.name}? ${c.delegateCount} delegate(s) will be removed and ${c.articleCount} article(s) detached.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteCommittee(c.id);
              setMsg(`Deleted ${c.name}.`);
              refresh();
            } catch (e) {
              setErr(e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  }

  if (loading) return <Loading />;

  return (
    <ScrollView>
      <Card>
        <View style={s.row}>
          <Text style={s.h}>Committees</Text>
          <Pressable style={s.btnGhost} onPress={() => setShowNew((v) => !v)} accessibilityRole="button">
            <Text style={s.btnGhostText}>{showNew ? 'Cancel' : 'New'}</Text>
          </Pressable>
        </View>
        {showNew ? (
          <View style={{ marginTop: 12 }}>
            <TextInput style={s.input} placeholder="Name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} accessibilityLabel="Committee name" />
            <TextInput style={s.input} placeholder="Abbreviation" value={form.abbreviation} onChangeText={(abbreviation) => setForm({ ...form, abbreviation })} accessibilityLabel="Abbreviation" />
            <TextInput style={s.input} placeholder="Venue" value={form.venue} onChangeText={(venue) => setForm({ ...form, venue })} accessibilityLabel="Venue" />
            <Pressable style={s.btn} onPress={create} accessibilityRole="button" accessibilityLabel="Create committee">
              <Text style={s.btnText}>Create committee</Text>
            </Pressable>
          </View>
        ) : null}
      </Card>

      {(rows ?? []).map((c) => (
        <FadeIn key={c.id}>
        <Card>
          <Text style={s.h}>{c.name}</Text>
          <Text style={s.muted}>
            {c.abbreviation} · {c.venue || 'No venue'} · {c.status} · {c.progressPercent}%
          </Text>
          <Text style={[s.muted, { marginTop: 4 }]}>
            {c.memberCount} member(s) · {c.delegateCount} delegate(s) · {c.articleCount} article(s) · {c.sessionCount} session(s)
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
            {['upcoming', 'in_session', 'on_break', 'completed', 'delayed'].map((st) => (
              <Pressable
                key={st}
                onPress={() => patch(c.id, { status: st }, `${c.name} is now ${st}.`)}
                accessibilityRole="button"
                accessibilityState={{ selected: c.status === st }}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: c.status === st ? palette.accent : palette.line,
                  marginRight: 6,
                  marginBottom: 6,
                }}
              >
                <Text style={{ color: c.status === st ? palette.accent : palette.muted, fontSize: 11.5, fontWeight: '700' }}>
                  {st.replace('_', ' ')}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Pressable
              style={[s.btnGhost, { flex: 1 }]}
              onPress={() => patch(c.id, { archived: !c.archived }, `${c.name} ${c.archived ? 'restored' : 'archived'}.`)}
              accessibilityRole="button"
            >
              <Text style={s.btnGhostText}>{c.archived ? 'Restore' : 'Archive'}</Text>
            </Pressable>
            <Pressable
              style={[s.btnGhost, { flex: 1, borderColor: palette.red }]}
              onPress={() => remove(c)}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${c.name}`}
            >
              <Text style={{ color: palette.red, fontWeight: '800', fontSize: 13 }}>Delete</Text>
            </Pressable>
          </View>
        </Card>
        </FadeIn>
      ))}
      {!rows?.length ? <Empty label="No committees yet." /> : null}
    </ScrollView>
  );
}
