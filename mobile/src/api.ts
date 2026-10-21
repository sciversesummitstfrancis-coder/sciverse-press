import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  findUserByEmail,
  ready,
  localArticle,
  localArticles,
  localCommittees,
  localNotifications,
  localRankings,
  insertArticle,
  markNotificationRead,
  updateArticle as updateLocalArticle,
  verifyLocalPassword,
  getUserById,
  replaceFromServer,
  listLocalAccounts,
  createLocalAccount,
  setLocalUserRole,
  deleteLocalAccount,
  listLocalCommitteesAdmin,
  createLocalCommittee,
  patchLocalCommittee,
  deleteLocalCommittee,
  listActivity,
} from './local/db';
import {
  getApiBase,
  getToken,
  hasExplicitServer,
  ping,
  request,
  setApiBase,
  setToken,
} from './local/sync';

export {
  getApiBase,
  setApiBase,
  getToken,
  setToken,
  request,
  DEFAULT_API_URL,
  API_URL,
} from './local/sync';

// --------------------------------------------------------------- types ----
export interface User { id: string; email: string; name: string; role?: string; }
export interface Committee { id: string; name: string; topic?: string; delegateCount?: number; }
export interface Ranking { delegateId: string; name: string; committeeId?: string; score: number; rank: number; }
export interface Article {
  id: string; title: string; body: string;
  committeeId?: string; status?: string;
  updatedAt: string; createdAt?: string;
}
export interface AppNotification { id: string; title: string; message: string; read?: boolean; createdAt?: string; }

// --------------------------------------------------------- session state ----
let currentUser: User | null = null;

export function currentUserId(): string | null {
  return currentUser?.id ?? null;
}

/** The signed-in user (role checks, admin screens). */
export function currentUserInfo(): User | null {
  return currentUser;
}

export function setCurrentUser(u: User | null): void {
  currentUser = u;
}

/** Restore the signed-in user from the stored token on app start. */
export async function restoreSession(): Promise<User | null> {
  await ready();
  const token = await getToken();
  if (!token) return null;
  if (token.startsWith('local:')) {
    const id = token.slice('local:'.length);
    const user = getUserById(id);
    if (user) {
      currentUser = user;
      await AsyncStorage.setItem('sciverse_user', JSON.stringify(user));
      return user;
    }
    return null;
  }
  // A token from an older build: trust the cached user, never hit the network.
  const cached = await AsyncStorage.getItem('sciverse_user');
  if (cached) {
    currentUser = JSON.parse(cached);
    return currentUser;
  }
  return null;
}

async function rememberUser(u: User): Promise<void> {
  currentUser = u;
  await AsyncStorage.setItem('sciverse_user', JSON.stringify(u));
}

// ------------------------------------------------------------ local auth ----
async function localLogin(email: string, password: string): Promise<User | null> {
  const row = findUserByEmail(email);
  if (!row) return null;
  const ok = await verifyLocalPassword(password, row.password_hash);
  if (!ok) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

// ------------------------------------------------------------- sync glue ----
let syncing = false;

/**
 * Push local changes and pull fresh copies when a server is reachable.
 * Never throws and never blocks the UI for long.
 */
export async function syncNow(): Promise<{ ok: boolean; message: string }> {
  if (syncing) return { ok: false, message: 'Sync already running' };
  syncing = true;
  try {
    const base = await getApiBase();
    const explicit = await hasExplicitServer();
    if (!explicit) return { ok: false, message: 'Offline mode — no server configured' };
    if (!(await ping(base))) return { ok: false, message: `Server ${base} unreachable` };

    const token = await getToken();
    if (!token || token.startsWith('local:')) {
      return { ok: false, message: 'Signed in locally — server sync needs a server sign-in' };
    }

    const [committees, articles, notifications] = await Promise.all([
      request<any[]>('/committees', base, {}, true, 8000),
      request<any>('/articles', base, {}, true, 8000),
      request<any>('/notifications', base, {}, true, 8000),
    ]);
    replaceFromServer({
      committees,
      articles: articles?.items ?? articles ?? [],
      notifications: notifications?.items ?? notifications ?? [],
    });
    return { ok: true, message: 'Synced with server' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Sync failed' };
  } finally {
    syncing = false;
  }
}

// ------------------------------------------------------------------- api ----
export const api = {
  /**
   * Sign in against the on-device database. No network call is ever made —
   * an unknown account fails immediately with a clear message.
   */
  login: async (email: string, password: string): Promise<{ token: string; user: User }> => {
    await ready();
    const local = await localLogin(email, password);
    if (!local) {
      const known = findUserByEmail(email);
      throw new Error(
        known
          ? 'Wrong password for this account.'
          : 'No account with that email on this device. Accounts: admin@sciverse.local, coord@sciverse.local, eb@sciverse.local, chair@sciverse.local, press@sciverse.local, org@sciverse.local',
      );
    }
    await rememberUser(local);
    await setToken(`local:${local.id}`);
    return { token: `local:${local.id}`, user: local };
  },

  committees: async (): Promise<Committee[]> => {
    await ready();
    return localCommittees();
  },

  rankings: async (): Promise<Ranking[]> => {
    await ready();
    return localRankings();
  },

  articles: async (): Promise<Article[]> => {
    await ready();
    return localArticles(currentUserId());
  },

  article: async (id: string): Promise<Article> => {
    await ready();
    const row = localArticle(id);
    if (!row) throw new Error('Article not found');
    return row;
  },

  createArticle: async (a: { title: string; body: string; committeeId?: string }): Promise<Article> => {
    await ready();
    const id = insertArticle({
      authorId: currentUserId() ?? 'local',
      title: a.title,
      body: a.body,
      committeeId: a.committeeId ?? null,
    });
    const created = localArticle(id);
    void pushArticle(created);
    return created as Article;
  },

  updateArticle: async (id: string, a: { title: string; body: string }): Promise<Article> => {
    await ready();
    updateLocalArticle(id, a);
    const updated = localArticle(id);
    void pushArticle(updated);
    return updated as Article;
  },

  notifications: async (): Promise<AppNotification[]> => {
    await ready();
    const id = currentUserId();
    if (!id) return [];
    return localNotifications(id).map((n: any) => ({
      id: n.id,
      title: n.title,
      message: n.body,
      read: !!n.read,
      createdAt: n.createdAt,
    }));
  },

  markRead: async (id: string): Promise<void> => {
    await ready();
    markNotificationRead(id);
  },

  // ------------------------------------------------------------ admin centre --
  // Runs on the device: no server required.
  adminAccounts: async () => {
    await ready();
    return listLocalAccounts();
  },
  createAccount: async (input: {
    email: string;
    name: string;
    role: string;
    password: string;
  }) => {
    await ready();
    return createLocalAccount(input.email, input.name, input.role, input.password);
  },
  setUserRole: async (id: string, role: string) => {
    await ready();
    setLocalUserRole(id, role);
  },
  deleteAccount: async (id: string) => {
    await ready();
    deleteLocalAccount(id, currentUserId());
  },
  adminCommittees: async () => {
    await ready();
    return listLocalCommitteesAdmin();
  },
  createCommittee: async (input: {
    name: string;
    abbreviation: string;
    venue?: string;
    agenda?: string;
  }) => {
    await ready();
    return createLocalCommittee(input);
  },
  patchCommittee: async (
    id: string,
    patch: { status?: string; progressPercent?: number; archived?: boolean; venue?: string; agenda?: string },
  ) => {
    await ready();
    patchLocalCommittee(id, patch);
  },
  deleteCommittee: async (id: string) => {
    await ready();
    deleteLocalCommittee(id);
  },
  activity: async (limit = 25) => {
    await ready();
    return listActivity(limit);
  },
};

/** Best-effort push of one article to the server. Failures are ignored. */
async function pushArticle(article: any): Promise<void> {
  if (!article) return;
  try {
    const base = await getApiBase();
    if (!(await hasExplicitServer())) return;
    if (!(await ping(base))) return;
    const token = await getToken();
    if (!token || token.startsWith('local:')) return;
    await request('/articles', base, {
      method: 'POST',
      body: JSON.stringify({
        title: article.title,
        body: article.body,
        committeeId: article.committeeId ?? undefined,
      }),
    }, true, 8000);
  } catch {
    /* stays local until the next successful sync */
  }
}

// ------------------------------------------------------- offline drafts ----
const DRAFTS_KEY = 'sciverse_drafts';

export interface Draft {
  localId: string; serverId?: string;
  title: string; body: string; committeeId?: string;
  updatedAt: string; dirty: boolean;
}

export async function loadDrafts(): Promise<Draft[]> {
  const raw = await AsyncStorage.getItem(DRAFTS_KEY);
  return raw ? (JSON.parse(raw) as Draft[]) : [];
}

export async function saveDrafts(drafts: Draft[]): Promise<void> {
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

export async function upsertDraft(d: Draft): Promise<Draft[]> {
  const all = await loadDrafts();
  const i = all.findIndex((x) => x.localId === d.localId);
  if (i >= 0) all[i] = d; else all.push(d);
  await saveDrafts(all);
  return all;
}

export async function removeDraft(localId: string): Promise<Draft[]> {
  const all = (await loadDrafts()).filter((d) => d.localId !== localId);
  await saveDrafts(all);
  return all;
}

/**
 * Commit local drafts into the local database (always) and try to push them
 * to the server (when reachable). The local commit never fails, so the
 * editor always reports progress instead of hanging on a dead network.
 */
export interface SyncResult { synced: number; conflicts: Draft[]; errors: string[]; }

export async function syncDrafts(): Promise<SyncResult> {
  await ready();
  const drafts = await loadDrafts();
  const out: SyncResult = { synced: 0, conflicts: [], errors: [] };
  const next: Draft[] = [];

  for (const d of drafts) {
    if (!d) continue;
    if (!d.dirty) { next.push(d); continue; }
    try {
      if (d.serverId) {
        updateLocalArticle(d.serverId, { title: d.title, body: d.body });
      } else {
        const id = insertArticle({
          authorId: currentUserId() ?? 'local',
          title: d.title,
          body: d.body,
          committeeId: d.committeeId ?? null,
        });
        d.serverId = id;
      }
      d.dirty = false;
      out.synced++;
      next.push(d);
    } catch (e) {
      out.errors.push(e instanceof Error ? e.message : String(e));
      next.push(d);
    }
  }

  await saveDrafts(next);
  void syncNow();
  return out;
}
