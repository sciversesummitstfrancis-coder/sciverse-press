import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "../src/app.js";
import { __setDb } from "../src/db.js";
import { hashPassword } from "../src/auth.js";
import { randomUUID } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));

function freshDb() {
  const d = new Database(":memory:");
  d.pragma("foreign_keys = ON");
  d.exec(readFileSync(join(here, "..", "src", "schema.sql"), "utf8"));
  __setDb(d);
  return d;
}

async function makeUser(db: Database.Database, role: string, email?: string) {
  const em = email ?? `${role}-${randomUUID().slice(0, 6)}@t.local`;
  const id = randomUUID();
  db.prepare(`INSERT INTO users (id, email, name, role, password_hash) VALUES (?,?,?,?,?)`)
    .run(id, em, role, role, await hashPassword("Password123!"));
  return { id, email: em };
}

async function login(app: ReturnType<typeof buildApp>, email: string) {
  const r = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "Password123!" } });
  expect(r.statusCode).toBe(200);
  return (r.json() as { accessToken: string }).accessToken;
}

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe("auth & RBAC", () => {
  it("rejects bad credentials, enforces admin-only user list", async () => {
    const db = freshDb();
    const app = buildApp();
    await makeUser(db, "press", "p@t.local");
    await makeUser(db, "admin", "a@t.local");
    const bad = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "p@t.local", password: "nope-nope-nope" } });
    expect(bad.statusCode).toBe(401);
    const pt = await login(app, "p@t.local");
    const forbidden = await app.inject({ method: "GET", url: "/users", headers: auth(pt) });
    expect(forbidden.statusCode).toBe(403);
    const at = await login(app, "a@t.local");
    const ok = await app.inject({ method: "GET", url: "/users", headers: auth(at) });
    expect(ok.statusCode).toBe(200);
  });
});

describe("article lifecycle", () => {
  it("draft -> submitted -> under_review -> approved -> published with optimistic concurrency", async () => {
    const db = freshDb();
    const app = buildApp();
    await makeUser(db, "press", "w@t.local");
    await makeUser(db, "coordinator", "c@t.local");
    const pt = await login(app, "w@t.local");
    const ct = await login(app, "c@t.local");
    const body = "word ".repeat(30);
    const created = await app.inject({
      method: "POST", url: "/articles", headers: auth(pt),
      payload: { title: "Test Article Title", body, category: "Report", tags: ["unsc"] },
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json() as { id: string };
    // stale version rejected
    const stale = await app.inject({
      method: "PATCH", url: `/articles/${id}`, headers: auth(pt),
      payload: { title: "New Title Here", expectedVersion: 999 },
    });
    expect(stale.statusCode).toBe(409);
    // submit
    expect((await app.inject({ method: "POST", url: `/articles/${id}/transition`, headers: auth(pt), payload: { to: "submitted" } })).statusCode).toBe(200);
    // press cannot approve
    const no = await app.inject({ method: "POST", url: `/articles/${id}/review`, headers: auth(pt), payload: { action: "approve" } });
    expect(no.statusCode).toBe(403);
    // coordinator reviews through
    for (const action of ["assign", "approve", "publish"]) {
      const r = await app.inject({ method: "POST", url: `/articles/${id}/review`, headers: auth(ct), payload: { action } });
      expect(r.statusCode).toBe(200);
    }
    const got = await app.inject({ method: "GET", url: `/articles/${id}`, headers: auth(pt) });
    expect(got.json().status).toBe("published");
    // revision history preserved
    expect(got.json().reviews.length).toBeGreaterThanOrEqual(3);
  });
});

describe("committees & points", () => {
  it("progress updates from stored data; awards compute rankings with audit trail", async () => {
    const db = freshDb();
    const app = buildApp();
    await makeUser(db, "admin", "ad@t.local");
    await makeUser(db, "eb", "eb@t.local");
    await makeUser(db, "press", "px@t.local");
    const at = await login(app, "ad@t.local");
    const et = await login(app, "eb@t.local");
    const com = await app.inject({ method: "POST", url: "/committees", headers: auth(at), payload: { name: "Test Council", abbreviation: "TC" } });
    expect(com.statusCode).toBe(201);
    const cid = (com.json() as { id: string }).id;
    // unauthorized progress update blocked
    const pt = await login(app, "px@t.local");
    const blocked = await app.inject({ method: "POST", url: `/committees/${cid}/progress`, headers: auth(pt), payload: { status: "in_session", progressPercent: 50 } });
    expect(blocked.statusCode).toBe(403);
    const upd = await app.inject({ method: "POST", url: `/committees/${cid}/progress`, headers: auth(et), payload: { status: "in_session", agendaItem: "Agenda 1", progressPercent: 40, note: "debate" } });
    expect(upd.statusCode).toBe(200);
    const det = await app.inject({ method: "GET", url: `/committees/${cid}`, headers: auth(et) });
    expect(det.json().progressPercent).toBe(40);
    // delegates + awards
    const d1 = await app.inject({ method: "POST", url: "/delegates", headers: auth(at), payload: { name: "Asha", committeeId: cid, country: "India" } });
    const d2 = await app.inject({ method: "POST", url: "/delegates", headers: auth(at), payload: { name: "Bruno", committeeId: cid, country: "Brazil" } });
    const id1 = (d1.json() as { id: string }).id;
    const id2 = (d2.json() as { id: string }).id;
    await app.inject({ method: "POST", url: "/points/award", headers: auth(et), payload: { delegateId: id1, category: "substance", value: 20, reason: "great speech today" }, });
    await app.inject({ method: "POST", url: "/points/award", headers: auth(et), payload: { delegateId: id2, category: "substance", value: 5, reason: "present and voting" } });
    // idempotent replay
    const key = "idem-1";
    const first = await app.inject({ method: "POST", url: "/points/award", headers: { ...auth(et), "idempotency-key": key }, payload: { delegateId: id1, category: "diplomacy", value: 10, reason: "solid negotiation round" } });
    const replay = await app.inject({ method: "POST", url: "/points/award", headers: { ...auth(et), "idempotency-key": key }, payload: { delegateId: id1, category: "diplomacy", value: 10, reason: "solid negotiation round" } });
    expect(replay.json().deduped).toBe(true);
    void first;
    const rank = await app.inject({ method: "GET", url: `/delegates?committeeId=${cid}`, headers: auth(et) });
    const items = (rank.json() as { items: Array<{ id: string; totalPoints: number; rankInCommittee: number }> }).items;
    expect(items[0].id).toBe(id1);
    expect(items[0].rankInCommittee).toBe(1);
    // audit trail exists
    const logs = await app.inject({ method: "GET", url: "/audit-logs?limit=50", headers: auth(at) });
    expect((logs.json() as Array<{ action: string }>).some((l) => l.action === "points.award")).toBe(true);
    // analytics reflects fixtures
    const an = await app.inject({ method: "GET", url: "/analytics/overview", headers: auth(at) });
    expect(an.statusCode).toBe(200);
    expect((an.json() as { pointsDist: unknown[] }).pointsDist.length).toBeGreaterThanOrEqual(2);
  });
});
