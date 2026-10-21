import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import {
  articleSchema,
  awardSchema,
  adminUserBulkSchema,
  adminUserCreateSchema,
  adminUserUpdateSchema,
  can,
  committeeSchema,
  committeeUpdateSchema,
  loginSchema,
  progressSchema,
  registerSchema,
  reviewSchema,
  sessionSchema,
  ARTICLE_TRANSITIONS,
  type Permission,
  type Role,
} from "@sciverse/shared";
import { getDb, uid, nowIso } from "./db.js";
import {
  hashPassword,
  verifyPassword,
  signAccess,
  verifyAccess,
  newRefreshToken,
  REFRESH_TTL_MS,
} from "./auth.js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface Authed {
  id: string;
  email: string;
  name: string;
  role: Role;
  sid: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: Authed;
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? join(here, "..", "uploads");

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// ---------- notification fan-out (in-process SSE hub) ----------
type Listener = (n: { kind: string; title: string; body: string }) => void;
export const sseHub = new Map<string, Set<Listener>>(); // userId -> listeners

export function notifyUser(
  userId: string,
  kind: string,
  title: string,
  body = "",
  dedupeKey?: string,
) {
  const db = getDb();
  try {
    db.prepare(
      `INSERT INTO notifications (id, user_id, kind, title, body, dedupe_key) VALUES (?,?,?,?,?,?)`,
    ).run(uid(), userId, kind, title, body, dedupeKey ?? null);
  } catch {
    return; // duplicate dedupe_key -> skip (prevents duplicate notifications)
  }
  const set = sseHub.get(userId);
  if (set) for (const fn of set) fn({ kind, title, body });
}

export function notifyRole(
  role: string,
  kind: string,
  title: string,
  body = "",
  dedupeKey?: string,
) {
  const db = getDb();
  const users = db
    .prepare(`SELECT id FROM users WHERE role = ?`)
    .all(role) as { id: string }[];
  for (const u of users)
    notifyUser(
      u.id,
      kind,
      title,
      body,
      dedupeKey ? `${dedupeKey}:${u.id}` : undefined,
    );
}

function audit(actorId: string | null, action: string, entity: string, entityId: string, detail = "") {
  getDb()
    .prepare(
      `INSERT INTO audit_logs (id, actor_id, action, entity, entity_id, detail) VALUES (?,?,?,?,?,?)`,
    )
    .run(uid(), actorId, action, entity, entityId, detail);
}

async function requireAuth(req: FastifyRequest) {
  const hdr = req.headers.authorization;
  const token = hdr?.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
  const claims = verifyAccess(token);
  if (!claims) throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
  const db = getDb();
  const sess = db
    .prepare(`SELECT revoked, expires_at FROM sessions WHERE id = ?`)
    .get(claims.sid) as { revoked: number; expires_at: string } | undefined;
  if (!sess || sess.revoked || new Date(sess.expires_at).getTime() < Date.now())
    throw Object.assign(new Error("session revoked"), { statusCode: 401 });
  const user = db
    .prepare(`SELECT id, email, name, role FROM users WHERE id = ?`)
    .get(claims.sub) as Authed | undefined;
  if (!user) throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
  req.user = { ...user, sid: claims.sid };
}

function requirePerm(perm: Permission) {
  return async (req: FastifyRequest) => {
    await requireAuth(req);
    if (!can(req.user!.role, perm))
      throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  };
}

// ---------- rankings ----------
export function computeRankings(committeeId?: string) {
  const db = getDb();
  const where = committeeId ? `WHERE d.committee_id = ?` : ``;
  const params = committeeId ? [committeeId] : [];
  const rows = db
    .prepare(
      `SELECT d.id, d.name, d.public_id AS publicId, d.committee_id AS committeeId,
              c.name AS committeeName, c.abbreviation, d.country,
              COALESCE(SUM(CASE WHEN a.reversed = 0 THEN a.value ELSE 0 END), 0) AS totalPoints
       FROM delegates d
       LEFT JOIN point_awards a ON a.delegate_id = d.id
       LEFT JOIN committees c ON c.id = d.committee_id
       ${where}
       GROUP BY d.id ORDER BY totalPoints DESC, d.name ASC`,
    )
    .all(...params) as Array<{
    id: string; name: string; publicId: string; committeeId: string;
    committeeName: string; abbreviation: string; country: string; totalPoints: number;
  }>;
  // overall ranks (all delegates)
  const all = committeeId
    ? (db.prepare(
        `SELECT d.id, COALESCE(SUM(CASE WHEN a.reversed = 0 THEN a.value ELSE 0 END),0) AS t
         FROM delegates d LEFT JOIN point_awards a ON a.delegate_id = d.id
         GROUP BY d.id ORDER BY t DESC, d.id ASC`,
      ).all() as Array<{ id: string; t: number }>)
    : rows.map((r) => ({ id: r.id, t: r.totalPoints }));
  const overall = new Map(all.map((r, i) => [r.id, i + 1]));
  return rows.map((r, i) => ({
    ...r,
    rankInCommittee: committeeId ? i + 1 : i + 1,
    overallRank: overall.get(r.id) ?? i + 1,
  }));
}

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  // Allowed origins:
  //  - http://localhost:<any>  -> Vite dev (5173) and preview (4173) servers
  //  - tauri://localhost       -> packaged Tauri app (Linux/Windows)
  //  - http(s)://tauri.localhost-> packaged Tauri app (macOS)
  // Override with CORS_ORIGIN (comma separated) in production.
  const configuredOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
    : null;
  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (configuredOrigins) return cb(null, configuredOrigins.includes(origin));
      const isLocalDev = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      const isTauri =
        origin === "tauri://localhost" ||
        origin === "http://tauri.localhost" ||
        origin === "https://tauri.localhost";
      cb(null, isLocalDev || isTauri);
    },
    credentials: true,
  });
  app.register(cookie);
  app.register(multipart, {
    limits: { fileSize: 8 * 1024 * 1024, files: 3 },
  });
  app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    const status = err.statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    reply.status(status).send({
      error: status >= 500 ? "internal error" : err.message,
    });
  });

  // ---------- health / openapi ----------
  app.get("/health", async () => ({ ok: true, time: nowIso() }));
  app.get("/openapi.json", async () => openapiDoc());

  // ---------- auth ----------
  app.post("/auth/register", async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid input" });
    const db = getDb();
    if (process.env.NODE_ENV === "production") {
      // No privilege escalation via self-registration in production.
      (parsed.data as { role: string }).role = "press";
    }
    const exists = db.prepare(`SELECT id FROM users WHERE email = ?`).get(parsed.data.email);
    if (exists) return reply.status(409).send({ error: "email taken" });
    const id = uid();
    await db
      .prepare(`INSERT INTO users (id, email, name, role, password_hash) VALUES (?,?,?,?,?)`)
      .run(id, parsed.data.email, parsed.data.name, parsed.data.role, await hashPassword(parsed.data.password));
    audit(null, "user.register", "user", id, parsed.data.role);
    return reply.status(201).send({ id });
  });

  app.post("/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid input" });
    const db = getDb();
    const user = db
      .prepare(`SELECT * FROM users WHERE email = ?`)
      .get(parsed.data.email) as
      | { id: string; email: string; name: string; role: Role; password_hash: string }
      | undefined;
    if (!user || !(await verifyPassword(parsed.data.password, user.password_hash)))
      return reply.status(401).send({ error: "invalid credentials" });
    const sid = uid();
    const { token: refresh, hash } = newRefreshToken();
    db.prepare(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at) VALUES (?,?,?,?)`,
    ).run(sid, user.id, hash, new Date(Date.now() + REFRESH_TTL_MS).toISOString());
    const access = signAccess(user.id, user.role, sid);
    reply.setCookie("refresh", refresh, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: REFRESH_TTL_MS / 1000,
    });
    return { accessToken: access, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  });

  app.post("/auth/refresh", async (req, reply) => {
    const raw = (req.cookies as Record<string, string>)?.refresh;
    if (!raw) return reply.status(401).send({ error: "no refresh token" });
    const db = getDb();
    const { hashRefresh } = await import("./auth.js");
    const sess = db.prepare(`SELECT * FROM sessions WHERE refresh_token_hash = ?`).get(hashRefresh(raw)) as
      | { id: string; user_id: string; revoked: number; expires_at: string } | undefined;
    if (!sess || sess.revoked || new Date(sess.expires_at).getTime() < Date.now())
      return reply.status(401).send({ error: "invalid session" });
    const user = db.prepare(`SELECT id, role FROM users WHERE id = ?`).get(sess.user_id) as { id: string; role: Role };
    return { accessToken: signAccess(user.id, user.role, sess.id) };
  });

  app.post("/auth/logout", { preHandler: requireAuth }, async (req) => {
    getDb().prepare(`UPDATE sessions SET revoked = 1 WHERE id = ?`).run(req.user!.sid);
    return { ok: true };
  });

  app.get("/me", { preHandler: requireAuth }, async (req) => ({
    id: req.user!.id, email: req.user!.email, name: req.user!.name, role: req.user!.role,
  }));

  // ---------- users / admin ----------
  app.get("/users", { preHandler: requirePerm("admin:users") }, async (req) => {
    const q = (req.query as Record<string, string>).q ?? "";
    return getDb()
      .prepare(`SELECT id, email, name, role, created_at FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT 200`)
      .all(`%${q}%`, `%${q}%`);
  });

  /** Rich account list for the admin centre: includes derived stats. */
  app.get("/admin/accounts", { preHandler: requirePerm("admin:accounts") }, async (req) => {
    const q = ((req.query as Record<string, string>).q ?? "").trim();
    const like = `%${q}%`;
    return getDb()
      .prepare(
        `SELECT u.id, u.email, u.name, u.role, u.created_at,
                (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.revoked = 0) AS activeSessions,
                (SELECT COUNT(*) FROM articles a WHERE a.author_id = u.id) AS articleCount,
                (SELECT COUNT(*) FROM committee_members m WHERE m.user_id = u.id) AS committeeCount,
                (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS lastSeenAt
         FROM users u
         WHERE (? = '' OR u.email LIKE ? OR u.name LIKE ? OR u.role LIKE ?)
         ORDER BY u.created_at DESC
         LIMIT 500`,
      )
      .all(q, like, like, like);
  });

  /** Admin creates an account for someone else. */
  app.post("/admin/accounts", { preHandler: requirePerm("admin:accounts") }, async (req, reply) => {
    const parsed = adminUserCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid input", detail: parsed.error.issues });
    const db = getDb();
    const { email, name, role, password } = parsed.data;
    if (db.prepare(`SELECT id FROM users WHERE email = ?`).get(email))
      return reply.status(409).send({ error: "email already exists" });
    const id = uid();
    await db
      .prepare(`INSERT INTO users (id, email, name, role, password_hash) VALUES (?,?,?,?,?)`)
      .run(id, email.toLowerCase(), name, role, await hashPassword(password));
    audit(req.user!.id, "user.create", "user", id, `${email} (${role})`);
    return reply.status(201).send({ id, email: email.toLowerCase() });
  });

  /** Admin edits name / role / resets password. */
  app.patch("/admin/accounts/:id", { preHandler: requirePerm("admin:accounts") }, async (req, reply) => {
    const parsed = adminUserUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid input", detail: parsed.error.issues });
    const db = getDb();
    const { id } = req.params as { id: string };
    const target = db.prepare(`SELECT id, role, email FROM users WHERE id = ?`).get(id) as
      | { id: string; role: Role; email: string }
      | undefined;
    if (!target) return reply.status(404).send({ error: "not found" });

    const { name, role, password } = parsed.data;
    if (role && role !== target.role) {
      // Never let the last admin demote themselves out of the role.
      if (target.id === req.user!.id && role !== "admin")
        return reply.status(400).send({ error: "you cannot remove your own admin role" });
      if (target.role === "admin" && role !== "admin") {
        const admins = (db.prepare(`SELECT COUNT(*) c FROM users WHERE role = 'admin'`).get() as { c: number }).c;
        if (admins <= 1) return reply.status(400).send({ error: "at least one admin must remain" });
      }
      db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, id);
      audit(req.user!.id, "user.role.change", "user", id, role);
    }
    if (name) db.prepare(`UPDATE users SET name = ? WHERE id = ?`).run(name, id);
    if (password) {
      await db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(await hashPassword(password), id);
      // Force re-login everywhere after a credential reset.
      db.prepare(`UPDATE sessions SET revoked = 1 WHERE user_id = ?`).run(id);
      audit(req.user!.id, "user.password.reset", "user", id, target.email);
    }
    if (name && !password && !role) audit(req.user!.id, "user.update", "user", id, name);
    return { ok: true };
  });

  /** Admin deletes an account and everything it owns. */
  app.delete("/admin/accounts/:id", { preHandler: requirePerm("admin:accounts") }, async (req, reply) => {
    const db = getDb();
    const { id } = req.params as { id: string };
    const target = db.prepare(`SELECT id, role, email FROM users WHERE id = ?`).get(id) as
      | { id: string; role: Role; email: string }
      | undefined;
    if (!target) return reply.status(404).send({ error: "not found" });
    if (target.id === req.user!.id)
      return reply.status(400).send({ error: "you cannot delete your own account" });
    if (target.role === "admin") {
      const admins = (db.prepare(`SELECT COUNT(*) c FROM users WHERE role = 'admin'`).get() as { c: number }).c;
      if (admins <= 1) return reply.status(400).send({ error: "at least one admin must remain" });
    }

    // Every table that references users(id) must be handled before the
    // delete, otherwise the foreign key blocks it. Work authored by the
    // departing user is re-pointed at the acting admin so the pressroom and
    // the audit trail survive; assignments and notifications are cleared.
    const acting = req.user!.id;
    const articles = (db.prepare(`SELECT COUNT(*) c FROM articles WHERE author_id = ?`).get(id) as { c: number }).c;
    const txn = db.transaction(() => {
      db.prepare(`UPDATE articles SET author_id = ? WHERE author_id = ?`).run(acting, id);
      db.prepare(`UPDATE article_revisions SET editor_id = ? WHERE editor_id = ?`).run(acting, id);
      db.prepare(`UPDATE reviews SET reviewer_id = ? WHERE reviewer_id = ?`).run(acting, id);
      db.prepare(`UPDATE progress_events SET author_id = ? WHERE author_id = ?`).run(acting, id);
      db.prepare(`UPDATE point_awards SET awarded_by = ? WHERE awarded_by = ?`).run(acting, id);
      db.prepare(`UPDATE announcements SET author_id = ? WHERE author_id = ?`).run(acting, id);
      db.prepare(`UPDATE articles SET assignee_id = NULL WHERE assignee_id = ?`).run(id);
      // audit_logs.actor_id is nullable — keep the rows, drop the dangling ref.
      db.prepare(`UPDATE audit_logs SET actor_id = NULL WHERE actor_id = ?`).run(id);
      db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
    });
    txn();
    audit(acting, "user.delete", "user", id, `${target.email} (${target.role})`);
    return { ok: true, reassignedArticles: articles };
  });

  /** Bulk-create accounts from a pasted list — skips duplicates. */
  app.post("/admin/accounts/bulk", { preHandler: requirePerm("admin:accounts") }, async (req, reply) => {
    const parsed = adminUserBulkSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid input", detail: parsed.error.issues });
    const db = getDb();
    const created: string[] = [];
    const skipped: string[] = [];
    for (const row of parsed.data.rows) {
      const email = row.email.toLowerCase();
      if (db.prepare(`SELECT id FROM users WHERE email = ?`).get(email)) {
        skipped.push(email);
        continue;
      }
      const id = uid();
      await db
        .prepare(`INSERT INTO users (id, email, name, role, password_hash) VALUES (?,?,?,?,?)`)
        .run(id, email, row.name, row.role, await hashPassword(row.password));
      created.push(email);
      audit(req.user!.id, "user.create", "user", id, `${email} (${row.role})`);
    }
    return reply.status(201).send({ created: created.length, skipped: skipped.length, skippedEmails: skipped });
  });

  /** Force a sign-out of every active session for a user. */
  app.delete("/users/:id/sessions", { preHandler: requirePerm("admin:users") }, async (req) => {
    getDb().prepare(`UPDATE sessions SET revoked = 1 WHERE user_id = ?`).run((req.params as { id: string }).id);
    audit(req.user!.id, "session.revoke", "user", (req.params as { id: string }).id);
    return { ok: true };
  });
  app.patch("/users/:id/role", { preHandler: requirePerm("admin:users") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { role } = (req.body as { role?: Role }) ?? {};
    if (!role || !["press", "eb", "chair", "coordinator", "admin", "organizer"].includes(role))
      return reply.status(400).send({ error: "invalid role" });
    getDb().prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, id);
    audit(req.user!.id, "user.role.change", "user", id, role);
    return { ok: true };
  });
  app.get("/audit-logs", { preHandler: requirePerm("admin:config") }, async (req) => {
    const q = req.query as Record<string, string>;
    return getDb()
      .prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(Math.min(Number(q.limit ?? 100), 500), Number(q.offset ?? 0));
  });

  /**
   * Newsroom ticker — a single, human-readable stream of everything that
   * just happened across the summit. Powers the live activity feed in the
   * desktop and mobile clients.
   */
  app.get("/activity", { preHandler: requireAuth }, async (req) => {
    const db = getDb();
    const limit = Math.min(Number((req.query as Record<string, string>).limit ?? 30), 100);
    const rows = db.prepare(
      `SELECT a.action, a.entity, a.entity_id, a.detail, a.created_at, u.name AS actorName
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC LIMIT ?`,
    ).all(limit) as Array<{
      action: string; entity: string; entity_id: string;
      detail: string; created_at: string; actorName: string | null;
    }>;

    // Enrich known entities with a human title so the ticker reads well.
    const titled = rows.map((r) => {
      let title = "";
      if (r.entity === "article") {
        const a = db.prepare(`SELECT title FROM articles WHERE id = ?`).get(r.entity_id) as { title: string } | undefined;
        title = a?.title ?? "";
      } else if (r.entity === "committee") {
        const c = db.prepare(`SELECT name, abbreviation FROM committees WHERE id = ?`).get(r.entity_id) as
          | { name: string; abbreviation: string }
          | undefined;
        title = c ? `${c.name} (${c.abbreviation})` : "";
      } else if (r.entity === "user") {
        const u = db.prepare(`SELECT name, email FROM users WHERE id = ?`).get(r.entity_id) as
          | { name: string; email: string }
          | undefined;
        title = u ? `${u.name} · ${u.email}` : "";
      } else if (r.entity === "delegate") {
        const d = db.prepare(`SELECT name, public_id FROM delegates WHERE id = ?`).get(r.entity_id) as
          | { name: string; public_id: string }
          | undefined;
        title = d ? `${d.name} (${d.public_id})` : "";
      }
      return {
        action: r.action,
        entity: r.entity,
        entityId: r.entity_id,
        title,
        detail: r.detail,
        actor: r.actorName ?? "System",
        at: r.created_at,
      };
    });
    return { items: titled, time: nowIso() };
  });
  app.get("/admin/health", { preHandler: requirePerm("admin:config") }, async () => {
    const db = getDb();
    const counts: Record<string, number> = {};
    for (const t of ["users", "committees", "delegates", "articles", "point_awards", "notifications", "audit_logs"])
      counts[t] = (db.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as { c: number }).c;
    const errors = db.prepare(`SELECT action, COUNT(*) n FROM audit_logs WHERE action LIKE '%error%' GROUP BY action`).all();
    return { counts, errors, time: nowIso() };
  });
  app.get("/admin/export/:entity", { preHandler: requirePerm("admin:export") }, async (req, reply) => {
    const allowed = ["users", "articles", "delegates", "point_awards", "committees", "audit_logs"] as const;
    const e = (req.params as { entity: string }).entity;
    if (!(allowed as readonly string[]).includes(e)) return reply.status(400).send({ error: "bad entity" });
    const rows = getDb().prepare(`SELECT * FROM ${e} LIMIT 5000`).all() as Record<string, unknown>[];
    const cols = Object.keys(rows[0] ?? { id: 0 });
    const csv = [cols.join(",")].concat(rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(","))).join("\n");
    audit(req.user!.id, "data.export", e, "csv");
    reply.header("Content-Type", "text/csv").send(csv);
  });

  // ---------- committees ----------
  app.get("/committees", async (req) => {
    const archived = (req.query as Record<string, string>).archived === "1" ? 1 : 0;
    const rows = getDb().prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM sessions_sched s WHERE s.committee_id = c.id) AS sessionCount
       FROM committees c WHERE archived = ? ORDER BY name ASC`,
    ).all(archived) as Array<Record<string, unknown>>;
    return rows.map((c) => ({
      id: c.id, name: c.name, abbreviation: c.abbreviation, venue: c.venue,
      agenda: c.agenda, status: c.status, progressPercent: c.progress_percent,
      currentAgendaItem: c.current_agenda_item, updatedAt: c.updated_at,
      sessionCount: (c as { sessionCount: number }).sessionCount,
    }));
  });

  app.post("/committees", { preHandler: requirePerm("admin:config") }, async (req, reply) => {
    const parsed = committeeSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid input" });
    const id = uid();
    getDb().prepare(`INSERT INTO committees (id, name, abbreviation, venue, agenda) VALUES (?,?,?,?,?)`)
      .run(id, parsed.data.name, parsed.data.abbreviation, parsed.data.venue, parsed.data.agenda);
    audit(req.user!.id, "committee.create", "committee", id);
    return reply.status(201).send({ id });
  });

  // ---------- admin committee oversight ----------
  /** Full oversight view: every committee, including archived, with rosters. */
  app.get("/admin/committees", { preHandler: requirePerm("admin:committees") }, async () => {
    const db = getDb();
    const rows = db.prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM committee_members m WHERE m.committee_id = c.id) AS memberCount,
              (SELECT COUNT(*) FROM sessions_sched s WHERE s.committee_id = c.id) AS sessionCount,
              (SELECT COUNT(*) FROM agenda_items a WHERE a.committee_id = c.id) AS agendaCount,
              (SELECT COUNT(*) FROM articles a WHERE a.committee_id = c.id) AS articleCount,
              (SELECT COUNT(*) FROM delegates d WHERE d.committee_id = c.id) AS delegateCount,
              (SELECT MAX(p.created_at) FROM progress_events p WHERE p.committee_id = c.id) AS lastUpdateAt
       FROM committees c
       ORDER BY c.archived ASC, c.name ASC`,
    ).all() as Array<Record<string, unknown>>;
    return rows.map((c) => ({
      id: c.id, name: c.name, abbreviation: c.abbreviation, venue: c.venue, agenda: c.agenda,
      status: c.status, progressPercent: c.progress_percent, currentAgendaItem: c.current_agenda_item,
      archived: !!c.archived, updatedAt: c.updated_at,
      memberCount: c.memberCount, sessionCount: c.sessionCount, agendaCount: c.agendaCount,
      articleCount: c.articleCount, delegateCount: c.delegateCount, lastUpdateAt: c.lastUpdateAt ?? null,
    }));
  });

  /** Admin edits any committee field. */
  app.patch("/admin/committees/:id", { preHandler: requirePerm("admin:committees") }, async (req, reply) => {
    const parsed = committeeUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid input", detail: parsed.error.issues });
    const db = getDb();
    const { id } = req.params as { id: string };
    const existing = db.prepare(`SELECT * FROM committees WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) return reply.status(404).send({ error: "not found" });

    const d = parsed.data;
    if (d.abbreviation && d.abbreviation !== existing.abbreviation) {
      const clash = db.prepare(`SELECT id FROM committees WHERE abbreviation = ? AND id <> ?`).get(d.abbreviation, id);
      if (clash) return reply.status(409).send({ error: "abbreviation already in use" });
    }
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (d.name !== undefined) { sets.push("name = ?"); vals.push(d.name); }
    if (d.abbreviation !== undefined) { sets.push("abbreviation = ?"); vals.push(d.abbreviation); }
    if (d.venue !== undefined) { sets.push("venue = ?"); vals.push(d.venue); }
    if (d.agenda !== undefined) { sets.push("agenda = ?"); vals.push(d.agenda); }
    if (d.status !== undefined) { sets.push("status = ?"); vals.push(d.status); }
    if (d.progressPercent !== undefined) { sets.push("progress_percent = ?"); vals.push(d.progressPercent); }
    if (d.currentAgendaItem !== undefined) { sets.push("current_agenda_item = ?"); vals.push(d.currentAgendaItem); }
    if (d.archived !== undefined) { sets.push("archived = ?"); vals.push(d.archived ? 1 : 0); }
    if (!sets.length) return { ok: true };
    sets.push("updated_at = ?");
    vals.push(nowIso(), id);
    db.prepare(`UPDATE committees SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
    audit(req.user!.id, "committee.update", "committee", id, JSON.stringify(d).slice(0, 300));
    return { ok: true };
  });

  /** Admin deletes a committee and everything attached to it. */
  app.delete("/admin/committees/:id", { preHandler: requirePerm("admin:committees") }, async (req, reply) => {
    const db = getDb();
    const { id } = req.params as { id: string };
    const c = db.prepare(`SELECT id, name FROM committees WHERE id = ?`).get(id) as
      | { id: string; name: string }
      | undefined;
    if (!c) return reply.status(404).send({ error: "not found" });

    const articles = (db.prepare(`SELECT COUNT(*) c FROM articles WHERE committee_id = ?`).get(id) as { c: number }).c;
    const delegates = (db.prepare(`SELECT COUNT(*) c FROM delegates WHERE committee_id = ?`).get(id) as { c: number }).c;
    // Articles keep existing but lose the link; delegates must be removed
    // first because their committee_id has no ON DELETE CASCADE.
    db.prepare(`UPDATE articles SET committee_id = NULL WHERE committee_id = ?`).run(id);
    db.prepare(`DELETE FROM delegates WHERE committee_id = ?`).run(id);
    db.prepare(`DELETE FROM committees WHERE id = ?`).run(id);
    audit(req.user!.id, "committee.delete", "committee", id, `${c.name} (${articles} articles detached, ${delegates} delegates removed)`);
    return { ok: true, detachedArticles: articles, removedDelegates: delegates };
  });

  /** Admin removes a member from a committee roster. */
  app.delete("/admin/committees/:id/members/:userId", { preHandler: requirePerm("admin:committees") }, async (req) => {
    const { id, userId } = req.params as { id: string; userId: string };
    getDb().prepare(`DELETE FROM committee_members WHERE committee_id = ? AND user_id = ?`).run(id, userId);
    audit(req.user!.id, "committee.member.remove", "committee", id, userId);
    return { ok: true };
  });

  /** Admin deletes a scheduled session. */
  app.delete("/admin/committees/:id/sessions/:sessionId", { preHandler: requirePerm("admin:committees") }, async (req) => {
    const { id, sessionId } = req.params as { id: string; sessionId: string };
    getDb().prepare(`DELETE FROM sessions_sched WHERE id = ? AND committee_id = ?`).run(sessionId, id);
    audit(req.user!.id, "session.delete", "committee", id, sessionId);
    return { ok: true };
  });

  /** Admin deletes an agenda item and re-packs the ordering. */
  app.delete("/admin/committees/:id/agenda/:itemId", { preHandler: requirePerm("admin:committees") }, async (req) => {
    const db = getDb();
    const { id, itemId } = req.params as { id: string; itemId: string };
    const item = db.prepare(`SELECT position FROM agenda_items WHERE id = ? AND committee_id = ?`).get(itemId, id) as
      | { position: number }
      | undefined;
    if (!item) return { ok: true };
    const txn = db.transaction(() => {
      db.prepare(`DELETE FROM agenda_items WHERE id = ?`).run(itemId);
      db.prepare(`UPDATE agenda_items SET position = position - 1 WHERE committee_id = ? AND position > ?`).run(id, item.position);
    });
    txn();
    audit(req.user!.id, "agenda.delete", "committee", id, itemId);
    return { ok: true };
  });

  app.get("/committees/:id", async (req, reply) => {
    const db = getDb();
    const { id } = req.params as { id: string };
    const c = db.prepare(`SELECT * FROM committees WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!c) return reply.status(404).send({ error: "not found" });
    const members = db.prepare(
      `SELECT u.id, u.name, u.email, u.role FROM committee_members m JOIN users u ON u.id = m.user_id WHERE m.committee_id = ?`,
    ).all(id);
    const sched = db.prepare(`SELECT * FROM sessions_sched WHERE committee_id = ? ORDER BY starts_at ASC`).all(id);
    const agendaItems = db.prepare(`SELECT * FROM agenda_items WHERE committee_id = ? ORDER BY position ASC`).all(id);
    const updates = db.prepare(
      `SELECT p.*, u.name AS authorName FROM progress_events p JOIN users u ON u.id = p.author_id WHERE committee_id = ? ORDER BY created_at DESC LIMIT 20`,
    ).all(id);
    const related = db.prepare(
      `SELECT id, title, category, published_at FROM articles WHERE committee_id = ? AND status = 'published' ORDER BY published_at DESC LIMIT 10`,
    ).all(id);
    const next = db.prepare(
      `SELECT * FROM sessions_sched WHERE committee_id = ? AND starts_at > ? ORDER BY starts_at ASC LIMIT 1`,
    ).get(id, nowIso());
    return {
      id: c.id, name: c.name, abbreviation: c.abbreviation, venue: c.venue, agenda: c.agenda,
      status: c.status, progressPercent: c.progress_percent, currentAgendaItem: c.current_agenda_item,
      archived: !!c.archived,
      updatedAt: c.updated_at, members, sessions: sched, agendaItems, updates, relatedArticles: related, nextSession: next ?? null,
    };
  });

  app.post("/committees/:id/members", { preHandler: requirePerm("admin:config") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { userId } = (req.body as { userId?: string }) ?? {};
    if (!userId) return reply.status(400).send({ error: "userId required" });
    getDb().prepare(`INSERT OR IGNORE INTO committee_members (id, committee_id, user_id) VALUES (?,?,?)`).run(uid(), id, userId);
    return reply.status(201).send({ ok: true });
  });

  app.post("/committees/:id/sessions", { preHandler: requirePerm("admin:config") }, async (req, reply) => {
    const parsed = sessionSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid input" });
    if (new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt))
      return reply.status(400).send({ error: "endsAt must be after startsAt" });
    const id = uid();
    getDb().prepare(`INSERT INTO sessions_sched (id, committee_id, title, starts_at, ends_at, venue) VALUES (?,?,?,?,?,?)`)
      .run(id, (req.params as { id: string }).id, parsed.data.title, parsed.data.startsAt, parsed.data.endsAt, parsed.data.venue);
    audit(req.user!.id, "session.schedule", "committee", (req.params as { id: string }).id, parsed.data.title);
    return reply.status(201).send({ id });
  });

  app.post("/committees/:id/agenda", { preHandler: requirePerm("admin:config") }, async (req, reply) => {
    const db = getDb();
    const { id } = req.params as { id: string };
    const { title } = (req.body as { title?: string }) ?? {};
    if (!title || title.length < 2) return reply.status(400).send({ error: "title required" });
    const max = (db.prepare(`SELECT COALESCE(MAX(position), -1) m FROM agenda_items WHERE committee_id = ?`).get(id) as { m: number }).m;
    const aid = uid();
    db.prepare(`INSERT INTO agenda_items (id, committee_id, title, position) VALUES (?,?,?,?)`).run(aid, id, title, max + 1);
    return reply.status(201).send({ id: aid });
  });

  app.patch("/committees/:id/agenda/:itemId", { preHandler: requirePerm("committee:update") }, async (req) => {
    const { itemId } = req.params as { itemId: string };
    const { done } = (req.body as { done?: boolean }) ?? {};
    getDb().prepare(`UPDATE agenda_items SET done = ? WHERE id = ?`).run(done ? 1 : 0, itemId);
    return { ok: true };
  });

  app.post("/committees/:id/progress", { preHandler: requirePerm("committee:update") }, async (req, reply) => {
    const parsed = progressSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid input" });
    const db = getDb();
    const { id } = req.params as { id: string };
    const c = db.prepare(`SELECT id FROM committees WHERE id = ?`).get(id);
    if (!c) return reply.status(404).send({ error: "not found" });
    const t = nowIso();
    const txn = db.transaction(() => {
      db.prepare(`UPDATE committees SET status = ?, current_agenda_item = ?, progress_percent = ?, updated_at = ? WHERE id = ?`)
        .run(parsed.data.status, parsed.data.agendaItem, parsed.data.progressPercent, t, id);
      db.prepare(`INSERT INTO progress_events (id, committee_id, author_id, status, agenda_item, progress_percent, note) VALUES (?,?,?,?,?,?,?)`)
        .run(uid(), id, req.user!.id, parsed.data.status, parsed.data.agendaItem, parsed.data.progressPercent, parsed.data.note);
    });
    txn();
    audit(req.user!.id, "committee.progress", "committee", id, `${parsed.data.status} ${parsed.data.progressPercent}%`);
    // notify all press users (deduped per event second)
    const press = db.prepare(`SELECT id FROM users WHERE role = 'press'`).all() as { id: string }[];
    const key = `progress:${id}:${t}`;
    for (const p of press) notifyUser(p.id, "committee", "Committee update", `${parsed.data.status} — ${parsed.data.progressPercent}%`, `${key}:${p.id}`);
    return { ok: true };
  });

  app.post("/committees/:id/announce", { preHandler: requirePerm("committee:update") }, async (req, reply) => {
    const { title, body } = (req.body as { title?: string; body?: string }) ?? {};
    if (!title || !body) return reply.status(400).send({ error: "title and body required" });
    const db = getDb();
    const id = uid();
    db.prepare(`INSERT INTO announcements (id, author_id, title, body) VALUES (?,?,?,?)`).run(id, req.user!.id, title, body);
    const users = db.prepare(`SELECT id FROM users`).all() as { id: string }[];
    for (const u of users) notifyUser(u.id, "announcement", title, body.slice(0, 140), `ann:${id}:${u.id}`);
    audit(req.user!.id, "announcement.create", "announcement", id, title);
    return reply.status(201).send({ id });
  });

  app.get("/announcements", { preHandler: requireAuth }, async () => {
    return getDb().prepare(
      `SELECT a.*, u.name AS authorName FROM announcements a JOIN users u ON u.id = a.author_id ORDER BY created_at DESC LIMIT 50`,
    ).all();
  });

  // ---------- delegates & points ----------
  app.post("/delegates", { preHandler: requirePerm("admin:config") }, async (req, reply) => {
    const { name, committeeId, country } = (req.body as Record<string, string>) ?? {};
    if (!name || !committeeId || !country) return reply.status(400).send({ error: "name, committeeId, country required" });
    const id = uid();
    const publicId = `DEL-${randomBytes(3).toString("hex").toUpperCase()}`;
    getDb().prepare(`INSERT INTO delegates (id, name, public_id, committee_id, country) VALUES (?,?,?,?,?)`)
      .run(id, name, publicId, committeeId, country);
    audit(req.user!.id, "delegate.register", "delegate", id, name);
    return reply.status(201).send({ id, publicId });
  });

  app.get("/delegates", async (req) => {
    const q = req.query as Record<string, string>;
    const db = getDb();
    let rows = computeRankings(q.committeeId || undefined) as Array<Record<string, unknown>>;
    if (q.country) rows = rows.filter((r) => (r.country as string).toLowerCase().includes(q.country.toLowerCase()));
    if (q.q) rows = rows.filter((r) => `${r.name} ${r.publicId} ${r.country}`.toLowerCase().includes((q.q as string).toLowerCase()));
    const min = Number(q.minPoints ?? -Infinity);
    if (Number.isFinite(min)) rows = rows.filter((r) => (r.totalPoints as number) >= min);
    const limit = Math.min(Number(q.limit ?? 100), 500);
    const offset = Number(q.offset ?? 0);
    void db;
    return { total: rows.length, items: rows.slice(offset, offset + limit) };
  });

  app.get("/delegates/:id", async (req, reply) => {
    const db = getDb();
    const { id } = req.params as { id: string };
    const d = db.prepare(
      `SELECT d.*, c.name AS committeeName FROM delegates d JOIN committees c ON c.id = d.committee_id WHERE d.id = ?`,
    ).get(id) as Record<string, unknown> | undefined;
    if (!d) return reply.status(404).send({ error: "not found" });
    const awards = db.prepare(
      `SELECT a.*, u.name AS awardedByName FROM point_awards a JOIN users u ON u.id = a.awarded_by WHERE delegate_id = ? ORDER BY created_at DESC LIMIT 100`,
    ).all(id);
    const total = (awards as Array<{ value: number; reversed: number }>).reduce((s, a) => s + (a.reversed ? 0 : a.value), 0);
    const trend = db.prepare(
      `SELECT substr(created_at,1,10) day, SUM(CASE WHEN reversed=0 THEN value ELSE 0 END) pts FROM point_awards WHERE delegate_id = ? GROUP BY day ORDER BY day ASC`,
    ).all(id);
    const byCat = db.prepare(
      `SELECT category, SUM(CASE WHEN reversed=0 THEN value ELSE 0 END) pts, COUNT(*) n FROM point_awards WHERE delegate_id = ? GROUP BY category`,
    ).all(id);
    return { ...d, totalPoints: total, awards, trend, byCategory: byCat };
  });

  app.post("/points/award", { preHandler: requirePerm("points:award") }, async (req, reply) => {
    const parsed = awardSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid input" });
    const db = getDb();
    const d = db.prepare(`SELECT id FROM delegates WHERE id = ?`).get(parsed.data.delegateId);
    if (!d) return reply.status(404).send({ error: "delegate not found" });
    const key = (req.headers["idempotency-key"] as string) || undefined;
    const id = uid();
    try {
      db.prepare(
        `INSERT INTO point_awards (id, delegate_id, awarded_by, category, value, reason, idempotency_key) VALUES (?,?,?,?,?,?,?)`,
      ).run(id, parsed.data.delegateId, req.user!.id, parsed.data.category, parsed.data.value, parsed.data.reason, key ?? null);
    } catch {
      // idempotent replay: return existing award
      if (key) {
        const existing = db.prepare(`SELECT id FROM point_awards WHERE idempotency_key = ?`).get(key) as { id: string } | undefined;
        if (existing) return { id: existing.id, deduped: true };
      }
      return reply.status(409).send({ error: "duplicate award" });
    }
    audit(req.user!.id, "points.award", "delegate", parsed.data.delegateId, `${parsed.data.category} ${parsed.data.value}`);
    // notify press (factual, no editorializing)
    const press = db.prepare(`SELECT id FROM users WHERE role = 'press'`).all() as { id: string }[];
    for (const p of press)
      notifyUser(p.id, "points", "Points update", `${parsed.data.category} ${parsed.data.value > 0 ? "+" : ""}${parsed.data.value}`, `award:${id}:${p.id}`);
    return reply.status(201).send({ id });
  });

  app.post("/points/:awardId/reverse", { preHandler: requirePerm("points:reverse") }, async (req, reply) => {
    const db = getDb();
    const { awardId } = req.params as { awardId: string };
    const a = db.prepare(`SELECT * FROM point_awards WHERE id = ?`).get(awardId) as
      | { id: string; delegate_id: string; reversed: number } | undefined;
    if (!a) return reply.status(404).send({ error: "not found" });
    if (a.reversed) return reply.status(409).send({ error: "already reversed" });
    const txn = db.transaction(() => {
      db.prepare(`UPDATE point_awards SET reversed = 1 WHERE id = ?`).run(awardId);
      const rid = uid();
      db.prepare(`INSERT INTO point_awards (id, delegate_id, awarded_by, category, value, reason, reversal_of) VALUES (?,?,?,?,?,?,?)`)
        .run(rid, a.delegate_id, req.user!.id, "conduct", 0, `Reversal of ${awardId}`, awardId);
    });
    txn();
    audit(req.user!.id, "points.reverse", "point_award", awardId);
    return { ok: true };
  });

  /** Press Radar: factual noteworthy activity only (no inferred labels). */
  app.get("/radar", async (req) => {
    const db = getDb();
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const movers = db.prepare(
      `SELECT d.id, d.name, d.public_id AS publicId, d.country, c.name AS committeeName,
              COALESCE(SUM(CASE WHEN a.reversed=0 AND a.created_at >= ? THEN a.value ELSE 0 END),0) AS points24h,
              COUNT(CASE WHEN a.created_at >= ? THEN 1 END) AS awards24h
       FROM delegates d LEFT JOIN point_awards a ON a.delegate_id = d.id
       LEFT JOIN committees c ON c.id = d.committee_id
       GROUP BY d.id HAVING points24h <> 0 OR awards24h > 0
       ORDER BY ABS(points24h) DESC LIMIT 20`,
    ).all(since, since);
    const activeCommittees = db.prepare(
      `SELECT c.id, c.name, c.abbreviation, c.status, c.progress_percent AS progressPercent, MAX(p.created_at) AS lastUpdate
       FROM committees c LEFT JOIN progress_events p ON p.committee_id = c.id
       WHERE p.created_at >= ? GROUP BY c.id ORDER BY lastUpdate DESC LIMIT 10`,
    ).all(since);
    void req;
    return { movers, activeCommittees, windowHours: 24 };
  });

  // ---------- articles ----------
  function serializeArticle(a: Record<string, unknown>) {
    return {
      ...a,
      tags: JSON.parse((a.tags as string) || "[]"),
    };
  }

  app.get("/articles", { preHandler: requireAuth }, async (req) => {
    const q = req.query as Record<string, string>;
    const db = getDb();
    const conds: string[] = [];
    const params: unknown[] = [];
    // press see own + published; coordinators/admins see all
    const privileged = ["coordinator", "admin"].includes(req.user!.role);
    if (!privileged) {
      conds.push(`(a.author_id = ? OR a.status = 'published')`);
      params.push(req.user!.id);
    }
    if (q.status) { conds.push(`a.status = ?`); params.push(q.status); }
    if (q.category) { conds.push(`a.category = ?`); params.push(q.category); }
    if (q.committeeId) { conds.push(`a.committee_id = ?`); params.push(q.committeeId); }
    if (q.q) { conds.push(`(a.title LIKE ? OR a.body LIKE ?)`); params.push(`%${q.q}%`, `%${q.q}%`); }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const order =
      q.sort === "oldest" ? "a.created_at ASC" : q.sort === "title" ? "a.title ASC" : "a.updated_at DESC";
    const limit = Math.min(Number(q.limit ?? 20), 100);
    const offset = Number(q.offset ?? 0);
    const total = (db.prepare(`SELECT COUNT(*) c FROM articles a ${where}`).get(...params) as { c: number }).c;
    const rows = db.prepare(
      `SELECT a.id, a.title, a.status, a.category, a.version, a.word_count AS wordCount,
              a.created_at AS createdAt, a.updated_at AS updatedAt, u.name AS authorName, c.name AS committeeName
       FROM articles a JOIN users u ON u.id = a.author_id LEFT JOIN committees c ON c.id = a.committee_id
       ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
    ).all(...params, limit, offset);
    return { total, items: rows };
  });

  app.get("/articles/queue", { preHandler: requirePerm("article:review") }, async () => {
    return getDb().prepare(
      `SELECT a.id, a.title, a.status, a.category, a.updated_at AS updatedAt, u.name AS authorName, c.name AS committeeName
       FROM articles a JOIN users u ON u.id = a.author_id LEFT JOIN committees c ON c.id = a.committee_id
       WHERE a.status IN ('submitted','under_review','revision_requested') ORDER BY a.updated_at ASC`,
    ).all();
  });

  app.post("/articles", { preHandler: requirePerm("article:submit") }, async (req, reply) => {
    const parsed = articleSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid input", detail: parsed.error.issues });
    const id = uid();
    const wc = wordCount(parsed.data.body);
    getDb().prepare(
      `INSERT INTO articles (id, author_id, title, subtitle, body, committee_id, category, tags, word_count, embargo_until)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).run(id, req.user!.id, parsed.data.title, parsed.data.subtitle ?? "", parsed.data.body,
      parsed.data.committeeId ?? null, parsed.data.category, JSON.stringify(parsed.data.tags ?? []), wc,
      parsed.data.embargoUntil ?? null);
    getDb().prepare(`INSERT INTO article_revisions (id, article_id, version, title, body, editor_id) VALUES (?,?,?,?,?,?)`)
      .run(uid(), id, 1, parsed.data.title, parsed.data.body, req.user!.id);
    audit(req.user!.id, "article.create", "article", id, parsed.data.title);
    return reply.status(201).send({ id, version: 1 });
  });

  app.get("/articles/:id", { preHandler: requireAuth }, async (req, reply) => {
    const db = getDb();
    const { id } = req.params as { id: string };
    const a = db.prepare(
      `SELECT a.*, u.name AS authorName, c.name AS committeeName FROM articles a
       JOIN users u ON u.id = a.author_id LEFT JOIN committees c ON c.id = a.committee_id WHERE a.id = ?`,
    ).get(id) as Record<string, unknown> | undefined;
    if (!a) return reply.status(404).send({ error: "not found" });
    const privileged = ["coordinator", "admin"].includes(req.user!.role);
    if (!privileged && a.author_id !== req.user!.id && a.status !== "published")
      return reply.status(403).send({ error: "forbidden" });
    const revisions = db.prepare(
      `SELECT r.id, r.version, r.title, r.created_at AS createdAt, u.name AS editorName FROM article_revisions r
       JOIN users u ON u.id = r.editor_id WHERE r.article_id = ? ORDER BY r.version ASC`,
    ).all(id);
    const reviews = db.prepare(
      `SELECT r.*, u.name AS reviewerName FROM reviews r JOIN users u ON u.id = r.reviewer_id WHERE r.article_id = ? ORDER BY r.created_at ASC`,
    ).all(id);
    const attachments = db.prepare(`SELECT id, original_name AS originalName, mime, size_bytes AS sizeBytes, created_at AS createdAt FROM attachments WHERE article_id = ?`).all(id);
    return { ...serializeArticle(a), revisions, reviews, attachments };
  });

  app.patch("/articles/:id", { preHandler: requirePerm("article:submit") }, async (req, reply) => {
    const parsed = articleSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid input" });
    const db = getDb();
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const a = db.prepare(`SELECT * FROM articles WHERE id = ?`).get(id) as
      | { id: string; author_id: string; status: string; version: number } | undefined;
    if (!a) return reply.status(404).send({ error: "not found" });
    const privileged = ["coordinator", "admin"].includes(req.user!.role);
    if (!privileged && a.author_id !== req.user!.id) return reply.status(403).send({ error: "forbidden" });
    if (!["draft", "revision_requested"].includes(a.status) && !privileged)
      return reply.status(409).send({ error: `cannot edit while ${a.status}` });
    // optimistic concurrency
    if (body.expectedVersion !== undefined && Number(body.expectedVersion) !== a.version)
      return reply.status(409).send({ error: "version conflict — reload and merge", serverVersion: a.version });
    const next = a.version + 1;
    const t = nowIso();
    const fields: string[] = [`version = ?`, `updated_at = ?`];
    const params: unknown[] = [next, t];
    for (const k of ["title", "subtitle", "body", "category", "embargoUntil"] as const) {
      if (parsed.data[k] !== undefined) {
        const col = k === "embargoUntil" ? "embargo_until" : k;
        fields.push(`${col} = ?`); params.push(parsed.data[k] ?? null);
      }
    }
    if (parsed.data.committeeId !== undefined) { fields.push(`committee_id = ?`); params.push(parsed.data.committeeId ?? null); }
    if (parsed.data.tags !== undefined) { fields.push(`tags = ?`); params.push(JSON.stringify(parsed.data.tags)); }
    if (parsed.data.body !== undefined) { fields.push(`word_count = ?`); params.push(wordCount(parsed.data.body as string)); }
    params.push(id);
    const txn = db.transaction(() => {
      db.prepare(`UPDATE articles SET ${fields.join(", ")} WHERE id = ?`).run(...params);
      const cur = db.prepare(`SELECT title, body FROM articles WHERE id = ?`).get(id) as { title: string; body: string };
      db.prepare(`INSERT INTO article_revisions (id, article_id, version, title, body, editor_id) VALUES (?,?,?,?,?,?)`)
        .run(uid(), id, next, cur.title, cur.body, req.user!.id);
    });
    txn();
    audit(req.user!.id, "article.edit", "article", id, `v${next}`);
    return { version: next };
  });

  app.post("/articles/:id/transition", { preHandler: requireAuth }, async (req, reply) => {
    const db = getDb();
    const { id } = req.params as { id: string };
    const { to } = (req.body as { to?: string }) ?? {};
    const a = db.prepare(`SELECT * FROM articles WHERE id = ?`).get(id) as
      | { id: string; author_id: string; status: string; title: string } | undefined;
    if (!a) return reply.status(404).send({ error: "not found" });
    const allowed = (ARTICLE_TRANSITIONS as Record<string, string[]>)[a.status] ?? [];
    if (!to || !allowed.includes(to)) return reply.status(400).send({ error: `cannot move ${a.status} -> ${to}` });
    const role = req.user!.role;
    // Author moves (submit / resubmit) vs reviewer moves, enforced server-side.
    const reviewerMoves = ["under_review", "revision_requested", "approved", "rejected", "published"];
    if (reviewerMoves.includes(to)) {
      if (!["coordinator", "admin"].includes(role))
        return reply.status(403).send({ error: "reviewers only" });
    } else {
      if (a.author_id !== req.user!.id && !["coordinator", "admin"].includes(role))
        return reply.status(403).send({ error: "author only" });
    }
    const t = nowIso();
    db.prepare(`UPDATE articles SET status = ?, updated_at = ?, published_at = CASE WHEN ? = 'published' THEN ? ELSE published_at END WHERE id = ?`)
      .run(to, t, to, t, id);
    db.prepare(`INSERT INTO reviews (id, article_id, reviewer_id, action, comment) VALUES (?,?,?,?,?)`)
      .run(uid(), id, req.user!.id, to, "");
    audit(req.user!.id, `article.${to}`, "article", id, a.title);
    notifyUser(a.author_id, "article", `Article ${to.replace("_", " ")}`, a.title, `art:${id}:${to}`);
    if (to === "published") notifyRole("press", "article", "New article published", a.title, `pub:${id}`);
    return { status: to };
  });

  app.post("/articles/:id/review", { preHandler: requirePerm("article:review") }, async (req, reply) => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid input" });
    const db = getDb();
    const { id } = req.params as { id: string };
    const a = db.prepare(`SELECT * FROM articles WHERE id = ?`).get(id) as
      | { id: string; author_id: string; status: string; title: string } | undefined;
    if (!a) return reply.status(404).send({ error: "not found" });
    const map = { assign: "under_review", request_revision: "revision_requested", approve: "approved", reject: "rejected", publish: "published" } as const;
    const to = map[parsed.data.action];
    const allowed = (ARTICLE_TRANSITIONS as Record<string, string[]>)[a.status] ?? [];
    if (parsed.data.action !== "assign" && !allowed.includes(to))
      return reply.status(400).send({ error: `cannot move ${a.status} -> ${to}` });
    const t = nowIso();
    const txn = db.transaction(() => {
      if (parsed.data.action === "assign") {
        db.prepare(`UPDATE articles SET status = 'under_review', assignee_id = ?, updated_at = ? WHERE id = ?`)
          .run(parsed.data.assigneeId ?? req.user!.id, t, id);
      } else {
        db.prepare(`UPDATE articles SET status = ?, updated_at = ?, published_at = CASE WHEN ? = 'published' THEN ? ELSE published_at END WHERE id = ?`)
          .run(to, t, to, t, id);
      }
      db.prepare(`INSERT INTO reviews (id, article_id, reviewer_id, action, comment) VALUES (?,?,?,?,?)`)
        .run(uid(), id, req.user!.id, parsed.data.action, parsed.data.comment);
    });
    txn();
    audit(req.user!.id, `article.review.${parsed.data.action}`, "article", id, parsed.data.comment.slice(0, 200));
    notifyUser(a.author_id, "article", `Editorial update: ${parsed.data.action.replace("_", " ")}`, `${a.title}${parsed.data.comment ? " — " + parsed.data.comment.slice(0, 120) : ""}`, `rev:${id}:${parsed.data.action}:${t}`);
    return { status: parsed.data.action === "assign" ? "under_review" : to };
  });

  // attachments: validated, randomized names, never executed
  const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain"]);
  app.post("/articles/:id/attachments", { preHandler: requirePerm("article:submit") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const a = db.prepare(`SELECT author_id FROM articles WHERE id = ?`).get(id) as { author_id: string } | undefined;
    if (!a) return reply.status(404).send({ error: "not found" });
    if (a.author_id !== req.user!.id && !["coordinator", "admin"].includes(req.user!.role))
      return reply.status(403).send({ error: "forbidden" });
    const part = await req.file();
    if (!part) return reply.status(400).send({ error: "file required" });
    if (!ALLOWED_MIME.has(part.mimetype)) return reply.status(415).send({ error: "file type not allowed" });
    const buf = await part.toBuffer();
    if (buf.length > 8 * 1024 * 1024) return reply.status(413).send({ error: "file too large" });
    // magic-byte sniff for images
    if (part.mimetype.startsWith("image/")) {
      const png = buf[0] === 0x89 && buf[1] === 0x50;
      const jpg = buf[0] === 0xff && buf[1] === 0xd8;
      const webp = buf.toString("ascii", 8, 12) === "WEBP";
      if (!(png || jpg || webp)) return reply.status(415).send({ error: "invalid image content" });
    }
    mkdirSync(UPLOAD_DIR, { recursive: true });
    const stored = `${randomBytes(16).toString("hex")}.bin`;
    writeFileSync(join(UPLOAD_DIR, stored), buf);
    const aid = uid();
    db.prepare(`INSERT INTO attachments (id, article_id, stored_name, original_name, mime, size_bytes) VALUES (?,?,?,?,?,?)`)
      .run(aid, id, stored, part.filename.slice(0, 200), part.mimetype, buf.length);
    audit(req.user!.id, "article.attach", "article", id, part.filename);
    return reply.status(201).send({ id: aid });
  });

  // Download an attachment: same visibility rules as the parent article.
  app.get("/attachments/:aid", { preHandler: requireAuth }, async (req, reply) => {
    const db = getDb();
    const { aid } = req.params as { aid: string };
    const row = db.prepare(
      `SELECT at.*, a.author_id, a.status FROM attachments at JOIN articles a ON a.id = at.article_id WHERE at.id = ?`,
    ).get(aid) as
      | { stored_name: string; original_name: string; mime: string; author_id: string; status: string }
      | undefined;
    if (!row) return reply.status(404).send({ error: "not found" });
    const privileged = ["coordinator", "admin"].includes(req.user!.role);
    if (!privileged && row.author_id !== req.user!.id && row.status !== "published")
      return reply.status(403).send({ error: "forbidden" });
    const file = join(UPLOAD_DIR, row.stored_name);
    if (!file.startsWith(UPLOAD_DIR)) return reply.status(400).send({ error: "bad path" });
    try {
      const data = readFileSync(file);
      // Never serve as executable HTML/JS: force safe content type + download.
      reply
        .header("Content-Type", row.mime)
        .header("Content-Disposition", `attachment; filename="${row.original_name.replace(/"/g, "")}"`)
        .header("X-Content-Type-Options", "nosniff")
        .send(data);
    } catch {
      return reply.status(410).send({ error: "file missing" });
    }
  });

  // ---------- notifications ----------
  app.get("/notifications", { preHandler: requireAuth }, async (req) => {
    const q = req.query as Record<string, string>;
    const db = getDb();
    const items = db.prepare(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ).all(req.user!.id, Math.min(Number(q.limit ?? 30), 100), Number(q.offset ?? 0));
    const unread = (db.prepare(`SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0`).get(req.user!.id) as { c: number }).c;
    return { items, unread };
  });
  app.post("/notifications/:id/read", { preHandler: requireAuth }, async (req) => {
    getDb().prepare(`UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?`).run((req.params as { id: string }).id, req.user!.id);
    return { ok: true };
  });
  app.post("/notifications/read-all", { preHandler: requireAuth }, async (req) => {
    getDb().prepare(`UPDATE notifications SET read = 1 WHERE user_id = ?`).run(req.user!.id);
    return { ok: true };
  });
  // SSE stream
  app.get("/notifications/stream", { preHandler: requireAuth }, async (req, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive",
    });
    reply.raw.write(`: connected\n\n`);
    const userId = req.user!.id;
    const fn: Listener = (n) => {
      try { reply.raw.write(`data: ${JSON.stringify(n)}\n\n`); } catch { /* closed */ }
    };
    if (!sseHub.has(userId)) sseHub.set(userId, new Set());
    sseHub.get(userId)!.add(fn);
    req.raw.on("close", () => { sseHub.get(userId)?.delete(fn); });
    // keep open; never resolve until client disconnects
    await new Promise(() => {});
  });

  // ---------- analytics (all from real DB queries) ----------
  app.get("/analytics/overview", { preHandler: requireAuth }, async (req) => {
    const db = getDb();
    const q = req.query as Record<string, string>;
    const from = q.from ?? "1970-01-01";
    const to = q.to ?? "2999-01-01";
    const com = q.committeeId;
    const artParams: unknown[] = [from, to];
    // Parameterized — never interpolate user input into SQL.
    const artFilter = com ? `AND committee_id = ?` : "";
    if (com) artParams.push(com);
    const articlesByDay = db.prepare(
      `SELECT substr(created_at,1,10) day, COUNT(*) n FROM articles WHERE created_at BETWEEN ? AND ? ${artFilter} GROUP BY day ORDER BY day ASC`,
    ).all(...artParams) as Array<{ day: string; n: number }>;
    const articlesByStatus = db.prepare(`SELECT status, COUNT(*) n FROM articles GROUP BY status`).all();
    const articlesByCategory = db.prepare(`SELECT category, COUNT(*) n FROM articles GROUP BY category ORDER BY n DESC LIMIT 12`).all();
    const reviewAvg = db.prepare(
      `SELECT AVG(julianday(r.created_at) - julianday(a.created_at)) d FROM reviews r JOIN articles a ON a.id = r.article_id WHERE r.action IN ('approve','reject','publish')`,
    ).get() as { d: number | null };
    const revisionRate = db.prepare(
      `SELECT (SELECT COUNT(DISTINCT article_id) FROM reviews WHERE action = 'request_revision') * 1.0 / NULLIF((SELECT COUNT(*) FROM articles),0) r`,
    ).get() as { r: number | null };
    const committeeProgress = db.prepare(
      `SELECT id, name, abbreviation, status, progress_percent AS progress FROM committees WHERE archived = 0 ORDER BY progress_percent DESC`,
    ).all();
    const sessionCounts = db.prepare(
      `SELECT c.abbreviation, COUNT(s.id) total,
              SUM(CASE WHEN s.ends_at < strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN 1 ELSE 0 END) done,
              SUM(CASE WHEN s.starts_at > strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN 1 ELSE 0 END) upcoming
       FROM committees c LEFT JOIN sessions_sched s ON s.committee_id = c.id GROUP BY c.id`,
    ).all();
    const pointsDist = db.prepare(
      `SELECT d.name, d.public_id AS publicId, COALESCE(SUM(CASE WHEN a.reversed=0 THEN a.value ELSE 0 END),0) total
       FROM delegates d LEFT JOIN point_awards a ON a.delegate_id = d.id GROUP BY d.id ORDER BY total DESC LIMIT 20`,
    ).all();
    const awardsByCat = db.prepare(`SELECT category, COUNT(*) n, SUM(value) pts FROM point_awards WHERE reversed = 0 GROUP BY category`).all();
    const pointsOverTime = db.prepare(
      `SELECT substr(created_at,1,10) day, SUM(CASE WHEN reversed=0 THEN value ELSE 0 END) pts FROM point_awards WHERE created_at BETWEEN ? AND ? GROUP BY day ORDER BY day ASC`,
    ).all(from, to);
    const delegatesByCommittee = db.prepare(
      `SELECT c.abbreviation, COUNT(d.id) n FROM committees c LEFT JOIN delegates d ON d.committee_id = c.id GROUP BY c.id`,
    ).all();
    const countryRep = db.prepare(`SELECT country, COUNT(*) n FROM delegates GROUP BY country ORDER BY n DESC LIMIT 20`).all();
    const queue = (db.prepare(`SELECT status, COUNT(*) n FROM articles WHERE status IN ('submitted','under_review','revision_requested') GROUP BY status`).all() ?? []);
    void req;
    return {
      articlesByDay, articlesByStatus, articlesByCategory,
      avgReviewDays: reviewAvg?.d ?? null, revisionRate: revisionRate?.r ?? 0,
      committeeProgress, sessionCounts, pointsDist, awardsByCat, pointsOverTime,
      delegatesByCommittee, countryRep, queue,
      note: "All figures computed live from stored records. Empty arrays mean no data yet — not an error.",
    };
  });

  // ---------- event settings ----------
  app.get("/settings", { preHandler: requireAuth }, async () => {
    const rows = getDb().prepare(`SELECT key, value FROM event_settings`).all() as Array<{ key: string; value: string }>;
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });
  app.put("/settings", { preHandler: requirePerm("admin:config") }, async (req) => {
    const body = (req.body as Record<string, string>) ?? {};
    const db = getDb();
    for (const [k, v] of Object.entries(body).slice(0, 50)) {
      if (/^[a-z0-9_.]{1,60}$/.test(k))
        db.prepare(`INSERT INTO event_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(k, String(v).slice(0, 2000));
    }
    audit(req.user!.id, "settings.update", "settings", "event");
    return { ok: true };
  });

  return app;
}

export function openapiDoc() {
  const paths: Record<string, unknown> = {};
  for (const [m, p] of [
    ["post", "/auth/login"], ["post", "/auth/register"], ["post", "/auth/refresh"],
    ["get", "/committees"], ["post", "/committees"], ["get", "/committees/{id}"],
    ["get", "/delegates"], ["post", "/delegates"], ["post", "/points/award"],
    ["get", "/articles"], ["post", "/articles"], ["get", "/articles/{id}"],
    ["get", "/analytics/overview"], ["get", "/notifications"], ["get", "/radar"],
  ] as Array<[string, string]>)
    paths[p] = { [m]: { summary: `${m.toUpperCase()} ${p}`, responses: { "200": { description: "ok" } } } };
  return { openapi: "3.0.0", info: { title: "Sciverse Press Platform API", version: "1.0.0" }, paths };
}

// helper to hash refresh without circular import issues in route
export { createHash };
