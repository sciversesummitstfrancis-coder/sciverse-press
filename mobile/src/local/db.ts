/**
 * Local-first database for the Sciverse Press Android app.
 *
 * The app ships with its own SQLite database (expo-sqlite), seeded with the
 * demo accounts and fixture data, so sign-in and every screen work instantly
 * and offline — exactly like the other local-first apps in this workspace.
 *
 * The REST backend stays optional: `sync.ts` pushes/pulls changes when a
 * server is reachable, but nothing here depends on the network.
 */
import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

const DB_NAME = 'sciverse.db';

let db: SQLite.SQLiteDatabase | null = null;

export function uid(prefix = ''): string {
  const r = Math.random().toString(16).slice(2) + Date.now().toString(16);
  const h = `${prefix}${r}`.replace(/[^a-f0-9]/gi, 'a').padEnd(32, '0').slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------- schema ----
// Mirrors the columns used by backend/src/schema.sql so records can move
// between the phone and the server without translation.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS committees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  venue TEXT NOT NULL DEFAULT '',
  agenda TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'upcoming',
  progress_percent INTEGER NOT NULL DEFAULT 0,
  current_agenda_item TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS delegates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public_id TEXT NOT NULL,
  committee_id TEXT NOT NULL,
  country TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS point_awards (
  id TEXT PRIMARY KEY,
  delegate_id TEXT NOT NULL,
  awarded_by TEXT NOT NULL,
  category TEXT NOT NULL,
  value INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  reversed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_awards_delegate ON point_awards(delegate_id);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  committee_id TEXT,
  category TEXT NOT NULL DEFAULT 'dispatch',
  tags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'published',
  version INTEGER NOT NULL DEFAULT 1,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_articles_updated ON articles(updated_at);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at);

CREATE TABLE IF NOT EXISTS event_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT 'Admin',
  created_at TEXT NOT NULL
);
`;

// --------------------------------------------------------------- hashing ----
// Local credentials are salted SHA-256 digests (scrypt is not available in
// the RN runtime, and a device-local demo account does not need KDF strength).
export async function hashPassword(password: string, salt: string): Promise<string> {
  const hex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `sciverse-local:${salt}:${password}`,
  );
  return `sha256$${salt}$${hex}`;
}

export async function verifyLocalPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algo, salt, hex] = stored.split('$');
  if (algo !== 'sha256' || !salt || !hex) return false;
  const candidate = await hashPassword(password, salt);
  return candidate === stored;
}

// ------------------------------------------------------------------ seed ----
// The app is local-first: it must be usable the moment it is installed, with
// no server, no network and no configuration.
//
// A bootstrap admin account is always created (the admin can then create
// everything else from the app). Demo committees, delegates, points, articles
// and notifications are seeded as well so a fresh install has something to
// show instead of empty screens.
const BOOTSTRAP_USER: [string, string, string] = [
  'admin@sciverse.local',
  'Admin',
  'admin',
];
const BOOTSTRAP_PASSWORD = 'Sciverse123!';

const DEMO_USERS: Array<[string, string, string]> = [
  BOOTSTRAP_USER,
  ['coord@sciverse.local', 'Priya Coordinator', 'coordinator'],
  ['eb@sciverse.local', 'Arjun EB', 'eb'],
  ['chair@sciverse.local', 'Meera Chair', 'chair'],
  ['press@sciverse.local', 'Dev Press', 'press'],
  ['org@sciverse.local', 'Sam Organizer', 'organizer'],
];

const DEMO_COMMITTEES: Array<[string, string, string, string]> = [
  ['United Nations Security Council', 'UNSC', 'Hall A', 'Middle East ceasefire and aid corridor'],
  ['World Health Organization', 'WHO', 'Hall B', 'Pandemic preparedness fund'],
  ['Disarmament Commission', 'DISEC', 'Hall C', 'Non-proliferation verification regime'],
];

const DEMO_DELEGATES: Array<[string, string, number, string]> = [
  ['Aarav Sharma', 'India', 0, 'SEED-0'],
  ['Beatriz Costa', 'Brazil', 1, 'SEED-1'],
  ['Chen Wei', 'China', 2, 'SEED-2'],
  ['Dalia Haddad', 'Egypt', 0, 'SEED-3'],
  ['Erik Lindqvist', 'Sweden', 1, 'SEED-4'],
  ['Fatima Zahra', 'Morocco', 2, 'SEED-5'],
  ['Gabriel Souza', 'Brazil', 0, 'SEED-6'],
  ['Hana Sato', 'Japan', 1, 'SEED-7'],
];

/**
 * Idempotent seed.
 *
 * Each block only runs when its table is empty, so an app that was installed
 * with a partial database (or an older build) repairs itself on next launch
 * instead of showing empty screens.
 */
async function seedIfEmpty(database: SQLite.SQLiteDatabase): Promise<void> {
  const ts = nowIso();
  const count = (table: string) =>
    database.getFirstSync<{ c: number }>(`SELECT COUNT(*) AS c FROM ${table}`)?.c ?? 0;

  // ---- accounts -------------------------------------------------------
  // Repaired on every launch: a missing account is created, and an account
  // whose stored hash no longer matches the demo password is re-hashed. That
  // way an install from an older build (or a partially seeded database) can
  // still sign in.
  for (const [email, name, role] of DEMO_USERS) {
    const existing = database.getFirstSync<{ id: string; password_hash: string }>(
      'SELECT id, password_hash FROM users WHERE email = ?',
      [email],
    );
    if (!existing) {
      const salt = Math.random().toString(16).slice(2, 10);
      const hash = await hashPassword(BOOTSTRAP_PASSWORD, salt);
      database.runSync(
        'INSERT OR REPLACE INTO users (id, email, name, role, password_hash, created_at) VALUES (?,?,?,?,?,?)',
        [uid('u-'), email, name, role, hash, ts],
      );
      continue;
    }
    const valid = await verifyLocalPassword(BOOTSTRAP_PASSWORD, existing.password_hash);
    if (!valid) {
      const salt = Math.random().toString(16).slice(2, 10);
      const hash = await hashPassword(BOOTSTRAP_PASSWORD, salt);
      database.runSync('UPDATE users SET password_hash = ? WHERE id = ?', [hash, existing.id]);
    }
  }

  const userIds = database
    .getAllSync<{ id: string }>('SELECT id FROM users')
    .map((u) => u.id);

  // ---- committees, delegates, points, articles, notifications ----------
  if (count('committees') === 0) {
    const committeeIds: string[] = [];
    for (const [name, abbr, venue, topic] of DEMO_COMMITTEES) {
      const id = uid('c-');
      committeeIds.push(id);
      database.runSync(
        `INSERT OR REPLACE INTO committees
          (id, name, abbreviation, venue, agenda, topic, status, progress_percent, current_agenda_item, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [id, name, abbr, venue, topic, topic, 'in_session', 40, 'Opening statements', ts],
      );
    }

    const delegateIds: string[] = [];
    for (const [name, country, comIdx, publicId] of DEMO_DELEGATES) {
      const id = uid('d-');
      delegateIds.push(id);
      database.runSync(
        'INSERT OR REPLACE INTO delegates (id, name, public_id, committee_id, country) VALUES (?,?,?,?,?)',
        [id, name, publicId, committeeIds[comIdx], country],
      );
    }

    const pressId = (
      database.getFirstSync<{ id: string }>(
        "SELECT id FROM users WHERE email = 'press@sciverse.local'",
      ) ?? { id: userIds[0] }
    ).id;

    const articles: Array<[string, string, string, number]> = [
      [
        'Security council opens with ceasefire debate',
        'Delegates traded opening statements on the corridor proposal before the committee moved to a procedural vote on sanctions exemptions.',
        'UNSC',
        0,
      ],
      [
        'WHO panel backs pooled procurement fund',
        'Members agreed to seed a shared vaccine procurement facility, with the first tranche earmarked for frontline clinics.',
        'WHO',
        1,
      ],
      [
        'Disarmament commission reviews verification protocol',
        'The technical annex on inspection timelines drew sharp objections from three delegations seeking a longer grace period.',
        'DISEC',
        2,
      ],
      [
        'Points desk: diplomacy leads the tally',
        'Early caucus figures show diplomacy awards clustering around the regional bloc, with procedure points spread thin across committees.',
        'UNSC',
        0,
      ],
    ];

    articles.forEach(([title, body, abbr, comIdx], i) => {
      const when = new Date(Date.now() - i * 3600_000).toISOString();
      database.runSync(
        `INSERT OR REPLACE INTO articles
          (id, author_id, title, subtitle, body, committee_id, category, tags, status, version, word_count, created_at, updated_at, dirty)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
        [
          uid('a-'),
          pressId,
          title,
          '',
          body,
          committeeIds[comIdx],
          abbr,
          '[]',
          'published',
          1,
          body.split(/\s+/).length,
          when,
          when,
        ],
      );
    });

    const scores = [42, 37, 31, 28, 24, 19, 15, 11];
    delegateIds.forEach((delegateId, i) => {
      database.runSync(
        `INSERT OR REPLACE INTO point_awards
          (id, delegate_id, awarded_by, category, value, reason, reversed, created_at)
         VALUES (?,?,?,?,?,?,0,?)`,
        [
          uid('p-'),
          delegateId,
          pressId,
          ['substance', 'diplomacy', 'procedure', 'leadership'][i % 4],
          scores[i],
          'Seeded demo score',
          ts,
        ],
      );
    });

    const notes: Array<[string, string]> = [
      ['Committee update', 'UNSC moved to in_session with 40% progress.'],
      ['New article published', 'Security council opens with ceasefire debate'],
      ['Points update', 'Diplomacy +3 for the regional bloc'],
    ];
    notes.forEach(([title, body], i) => {
      // Every account gets the same notification feed.
      for (const userId of userIds) {
        database.runSync(
          `INSERT OR REPLACE INTO notifications (id, user_id, kind, title, body, read, created_at)
           VALUES (?,?,?,?,?,?,?)`,
          [`${uid('n-')}-${userId}`, userId, 'system', title, body, i > 0 ? 1 : 0, ts],
        );
      }
    });
  }

  database.runSync(
    'INSERT OR REPLACE INTO event_settings (key, value) VALUES (?,?)',
    ['eventName', 'Sciverse Summit 2026'],
  );
}

// ------------------------------------------------------------------ open ----
export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
    db.execSync(SCHEMA);
    // Seeding is async (hashing); fire and forget — the first read awaits
    // `ready` below, so screens never see a half-seeded database.
    seeding = seedIfEmpty(db).catch((e) => {
      seedError = e;
      console.error('[sciverse] local database seed failed:', e);
      throw e;
    });
  }
  return db;
}

let seeding: Promise<void> | null = null;
let seedError: unknown = null;

/** Resolves once the database has been created and seeded. */
export async function ready(): Promise<void> {
  getDb();
  if (seeding) {
    try {
      await seeding;
    } catch (e) {
      throw new Error(
        `Local database unavailable: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  void seedError;
}

// --------------------------------------------------------------- queries ----
export interface LocalUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function findUserByEmail(email: string): (LocalUser & { password_hash: string }) | null {
  const row = getDb().getFirstSync<LocalUser & { password_hash: string }>(
    'SELECT id, email, name, role, password_hash FROM users WHERE email = ?',
    [email.toLowerCase().trim()],
  );
  return row ?? null;
}

export function getUserById(id: string): LocalUser | null {
  const row = getDb().getFirstSync<LocalUser>(
    'SELECT id, email, name, role FROM users WHERE id = ?',
    [id],
  );
  return row ?? null;
}

export function upsertUser(user: LocalUser, passwordHash: string): void {
  getDb().runSync(
    `INSERT INTO users (id, email, name, role, password_hash, created_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(email) DO UPDATE SET name = excluded.name, role = excluded.role`,
    [user.id, user.email.toLowerCase().trim(), user.name, user.role, passwordHash, nowIso()],
  );
}

export function localCommittees() {
  return getDb().getAllSync<any>(
    `SELECT c.id, c.name, c.abbreviation, c.venue, c.agenda, c.topic, c.status,
            c.progress_percent AS progressPercent, c.current_agenda_item AS currentAgendaItem,
            c.updated_at AS updatedAt,
            (SELECT COUNT(*) FROM delegates d WHERE d.committee_id = c.id) AS delegateCount
     FROM committees c
     WHERE c.status != 'archived'
     ORDER BY c.name ASC`,
  );
}

export function localRankings() {
  return getDb().getAllSync<any>(
    `SELECT d.id AS delegateId, d.name, d.committee_id AS committeeId,
            d.public_id AS publicId, d.country,
            COALESCE(SUM(CASE WHEN p.reversed = 0 THEN p.value ELSE 0 END), 0) AS score
     FROM delegates d
     LEFT JOIN point_awards p ON p.delegate_id = d.id
     GROUP BY d.id
     ORDER BY score DESC`,
  ).map((r: any, i: number) => ({ ...r, rank: i + 1 }));
}

export function localArticles(userId?: string | null) {
  return getDb().getAllSync<any>(
    `SELECT a.id, a.title, a.subtitle, a.body, a.committee_id AS committeeId,
            a.category, a.status, a.version, a.word_count AS wordCount,
            a.created_at AS createdAt, a.updated_at AS updatedAt,
            u.name AS authorName, c.name AS committeeName
     FROM articles a
     LEFT JOIN users u ON u.id = a.author_id
     LEFT JOIN committees c ON c.id = a.committee_id
     WHERE a.status = 'published' OR a.author_id = ?
     ORDER BY a.updated_at DESC`,
    [userId ?? ''],
  );
}

export function localArticle(id: string) {
  const row = getDb().getFirstSync<any>(
    `SELECT a.id, a.title, a.subtitle, a.body, a.committee_id AS committeeId,
            a.category, a.status, a.version, a.word_count AS wordCount,
            a.created_at AS createdAt, a.updated_at AS updatedAt
     FROM articles a WHERE a.id = ?`,
    [id],
  );
  return row ?? null;
}

export function localNotifications(userId: string) {
  return getDb().getAllSync<any>(
    `SELECT id, user_id AS userId, kind, title, body, read, created_at AS createdAt
     FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
    [userId],
  );
}

export function markNotificationRead(id: string): void {
  getDb().runSync('UPDATE notifications SET read = 1 WHERE id = ?', [id]);
}

export function insertArticle(a: {
  id?: string;
  authorId: string;
  title: string;
  body: string;
  committeeId?: string | null;
  category?: string;
}): string {
  const id = a.id ?? uid('a-');
  const ts = nowIso();
  getDb().runSync(
    `INSERT INTO articles
      (id, author_id, title, subtitle, body, committee_id, category, tags, status, version, word_count, created_at, updated_at, dirty)
     VALUES (?,?,?,'',?,?,?,'[]','published',1,?,?,?,1)`,
    [
      id,
      a.authorId,
      a.title,
      a.body,
      a.committeeId ?? null,
      a.category ?? 'dispatch',
      a.body.split(/\s+/).filter(Boolean).length,
      ts,
      ts,
    ],
  );
  return id;
}

export function updateArticle(id: string, patch: { title?: string; body?: string }): void {
  const current = localArticle(id);
  if (!current) return;
  const title = patch.title ?? current.title;
  const body = patch.body ?? current.body;
  getDb().runSync(
    `UPDATE articles SET title = ?, body = ?, word_count = ?, updated_at = ?, dirty = 1 WHERE id = ?`,
    [title, body, body.split(/\s+/).filter(Boolean).length, nowIso(), id],
  );
  logActivity('article.update', 'article', id, title);
}

export function dirtyArticles() {
  return getDb().getAllSync<any>('SELECT * FROM articles WHERE dirty = 1');
}
export function clearDirty(id: string): void {
  getDb().runSync('UPDATE articles SET dirty = 0 WHERE id = ?', [id]);
}

// ------------------------------------------------------------ admin centre ----
// Everything below runs entirely on the device: the admin can create accounts
// and committees without a server.
export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
  activeSessions: number;
  articleCount: number;
  committeeCount: number;
}

export function listLocalAccounts(): AdminAccount[] {
  return getDb().getAllSync<any>(
    `SELECT u.id, u.email, u.name, u.role, u.created_at,
            0 AS activeSessions,
            (SELECT COUNT(*) FROM articles a WHERE a.author_id = u.id) AS articleCount,
            (SELECT COUNT(*) FROM committees c WHERE c.id IN (SELECT committee_id FROM articles WHERE author_id = u.id)) AS committeeCount
     FROM users u ORDER BY u.created_at ASC`,
  );
}

export async function createLocalAccount(
  email: string,
  name: string,
  role: string,
  password: string,
): Promise<{ id: string }> {
  const clean = email.trim().toLowerCase();
  if (!clean || !name.trim()) throw new Error('Email and name are required');
  if (password.length < 8) throw new Error('Password must be at least 8 characters');
  if (findUserByEmail(clean)) throw new Error('An account with that email already exists');
  const salt = Math.random().toString(16).slice(2, 10);
  const hash = await hashPassword(password, salt);
  const id = uid('u-');
  getDb().runSync(
    'INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES (?,?,?,?,?,?)',
    [id, clean, name.trim(), role, hash, nowIso()],
  );
  logActivity('user.create', 'user', id, `${clean} joined as ${role}`);
  return { id };
}

export function setLocalUserRole(id: string, role: string): void {
  getDb().runSync('UPDATE users SET role = ? WHERE id = ?', [role, id]);
  logActivity('user.role.change', 'user', id, `role set to ${role}`);
}

export function deleteLocalAccount(id: string, reassignTo?: string | null): void {
  const db2 = getDb();
  if (reassignTo) {
    db2.runSync('UPDATE articles SET author_id = ? WHERE author_id = ?', [reassignTo, id]);
  }
  db2.runSync('DELETE FROM notifications WHERE user_id = ?', [id]);
  db2.runSync('DELETE FROM point_awards WHERE awarded_by = ?', [id]);
  db2.runSync('DELETE FROM users WHERE id = ?', [id]);
  logActivity('user.delete', 'user', id, 'account deleted');
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

export function listLocalCommitteesAdmin(): AdminCommittee[] {
  return getDb().getAllSync<any>(
    `SELECT c.id, c.name, c.abbreviation, c.venue, c.agenda, c.status,
            c.progress_percent AS progressPercent,
            0 AS archived,
            (SELECT COUNT(*) FROM delegates d WHERE d.committee_id = c.id) AS delegateCount,
            (SELECT COUNT(*) FROM articles a WHERE a.committee_id = c.id) AS articleCount,
            0 AS memberCount,
            0 AS sessionCount
     FROM committees c ORDER BY c.name ASC`,
  );
}

export function createLocalCommittee(input: {
  name: string;
  abbreviation: string;
  venue?: string;
  agenda?: string;
}): { id: string } {
  if (!input.name.trim()) throw new Error('Committee name is required');
  const id = uid('c-');
  getDb().runSync(
    `INSERT INTO committees (id, name, abbreviation, venue, agenda, topic, status, progress_percent, current_agenda_item, updated_at)
     VALUES (?,?,?,?,?,?,'upcoming',0,'',?)`,
    [
      id,
      input.name.trim(),
      (input.abbreviation || input.name.slice(0, 5)).trim().toUpperCase(),
      input.venue ?? '',
      input.agenda ?? '',
      input.agenda ?? '',
      nowIso(),
    ],
  );
  logActivity('committee.create', 'committee', id, input.name.trim());
  return { id };
}

export function patchLocalCommittee(
  id: string,
  patch: { status?: string; progressPercent?: number; archived?: boolean; venue?: string; agenda?: string },
): void {
  const current = getDb().getFirstSync<any>('SELECT * FROM committees WHERE id = ?', [id]);
  if (!current) throw new Error('Committee not found');
  getDb().runSync(
    `UPDATE committees SET status = ?, progress_percent = ?, venue = ?, agenda = ?, updated_at = ? WHERE id = ?`,
    [
      patch.status ?? current.status,
      patch.progressPercent ?? current.progress_percent,
      patch.venue ?? current.venue,
      patch.agenda ?? current.agenda,
      nowIso(),
      id,
    ],
  );
  logActivity('committee.update', 'committee', id, current.name);
}

export function deleteLocalCommittee(id: string): void {
  const current = getDb().getFirstSync<any>('SELECT name FROM committees WHERE id = ?', [id]);
  getDb().runSync('UPDATE articles SET committee_id = NULL WHERE committee_id = ?', [id]);
  getDb().runSync('DELETE FROM delegates WHERE committee_id = ?', [id]);
  getDb().runSync('DELETE FROM committees WHERE id = ?', [id]);
  logActivity('committee.update', 'committee', id, `${current?.name ?? id} deleted`);
}

// ----------------------------------------------------------------- activity ----
export interface ActivityItem {
  action: string;
  entity: string;
  entityId: string;
  title: string;
  detail: string;
  actor: string;
  at: string;
}

export function logActivity(
  action: string,
  entity: string,
  entityId: string,
  title: string,
  actor = 'Admin',
): void {
  getDb().runSync(
    `INSERT OR REPLACE INTO activity (id, action, entity, entity_id, title, detail, actor, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [uid('act-'), action, entity, entityId, title, '', actor, nowIso()],
  );
}

export function listActivity(limit = 25): ActivityItem[] {
  return getDb().getAllSync<any>(
    `SELECT action, entity, entity_id AS entityId, title, detail, actor, created_at AS at
     FROM activity ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
}

/** Replace local tables with data pulled from the server. */
export function replaceFromServer(payload: {
  committees?: any[];
  articles?: any[];
  notifications?: any[];
  rankings?: any[];
}): void {
  const database = getDb();
  database.withTransactionSync(() => {
    for (const c of payload.committees ?? []) {
      database.runSync(
        `INSERT INTO committees (id, name, abbreviation, venue, agenda, topic, status, progress_percent, current_agenda_item, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = excluded.status,
           progress_percent = excluded.progress_percent, updated_at = excluded.updated_at`,
        [
          c.id,
          c.name,
          c.abbreviation ?? c.name.slice(0, 5).toUpperCase(),
          c.venue ?? '',
          c.agenda ?? '',
          c.topic ?? c.agenda ?? '',
          c.status ?? 'upcoming',
          c.progressPercent ?? 0,
          c.currentAgendaItem ?? '',
          c.updatedAt ?? nowIso(),
        ],
      );
    }
    for (const a of payload.articles ?? []) {
      const existing = database.getFirstSync<{ dirty: number }>(
        'SELECT dirty FROM articles WHERE id = ?',
        [a.id],
      );
      if (existing && existing.dirty) continue; // never clobber unsynced local edits
      database.runSync(
        `INSERT INTO articles (id, author_id, title, subtitle, body, committee_id, category, tags, status, version, word_count, created_at, updated_at, dirty)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0)
         ON CONFLICT(id) DO UPDATE SET title = excluded.title, body = excluded.body,
           updated_at = excluded.updated_at, status = excluded.status`,
        [
          a.id,
          a.authorId ?? '',
          a.title,
          a.subtitle ?? '',
          a.body,
          a.committeeId ?? null,
          a.category ?? 'dispatch',
          a.tags ?? '[]',
          a.status ?? 'published',
          a.version ?? 1,
          a.wordCount ?? 0,
          a.createdAt ?? nowIso(),
          a.updatedAt ?? nowIso(),
        ],
      );
    }
    for (const n of payload.notifications ?? []) {
      database.runSync(
        `INSERT INTO notifications (id, user_id, kind, title, body, read, created_at)
         VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET read = excluded.read`,
        [
          n.id,
          n.userId ?? '',
          n.kind ?? 'system',
          n.title,
          n.body ?? n.message ?? '',
          n.read ? 1 : 0,
          n.createdAt ?? nowIso(),
        ],
      );
    }
  });
}
