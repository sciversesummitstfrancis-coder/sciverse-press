import { describe, it, expect } from "vitest";
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

async function login(app: ReturnType<typeof buildApp>, email: string, password = "Password123!") {
  const r = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  expect(r.statusCode).toBe(200);
  return (r.json() as { accessToken: string }).accessToken;
}

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe("admin account management", () => {
  it("admin creates an account with a chosen role; the new account can sign in", async () => {
    const db = freshDb();
    const app = buildApp();
    await makeUser(db, "admin", "boss@t.local");
    const at = await login(app, "boss@t.local");

    const created = await app.inject({
      method: "POST", url: "/admin/accounts", headers: auth(at),
      payload: { email: "newbie@t.local", name: "New Bie", role: "press", password: "Str0ngPass!" },
    });
    expect(created.statusCode).toBe(201);

    // the new account works immediately
    const t = await login(app, "newbie@t.local", "Str0ngPass!");
    const me = await app.inject({ method: "GET", url: "/me", headers: auth(t) });
    expect(me.json().role).toBe("press");

    // duplicate email is rejected
    const dupe = await app.inject({
      method: "POST", url: "/admin/accounts", headers: auth(at),
      payload: { email: "newbie@t.local", name: "Clone", role: "press", password: "Str0ngPass!" },
    });
    expect(dupe.statusCode).toBe(409);

    // weak password is rejected by the schema
    const weak = await app.inject({
      method: "POST", url: "/admin/accounts", headers: auth(at),
      payload: { email: "weak@t.local", name: "Weak", role: "press", password: "short" },
    });
    expect(weak.statusCode).toBe(400);
  });

  it("non-admins cannot create accounts", async () => {
    const db = freshDb();
    const app = buildApp();
    await makeUser(db, "press", "p@t.local");
    await makeUser(db, "coordinator", "co@t.local");
    const pt = await login(app, "p@t.local");
    const ct = await login(app, "co@t.local");
    const payload = { email: "sneaky@t.local", name: "Sneaky", role: "admin", password: "Str0ngPass!" };
    for (const t of [pt, ct]) {
      const r = await app.inject({ method: "POST", url: "/admin/accounts", headers: auth(t), payload });
      expect(r.statusCode).toBe(403);
    }
  });

  it("admin edits role, resets password (revoking sessions) and deletes accounts", async () => {
    const db = freshDb();
    const app = buildApp();
    await makeUser(db, "admin", "boss@t.local");
    const target = await makeUser(db, "press", "target@t.local");
    const at = await login(app, "boss@t.local");

    // role change
    const promoted = await app.inject({
      method: "PATCH", url: `/admin/accounts/${target.id}`, headers: auth(at), payload: { role: "chair" },
    });
    expect(promoted.statusCode).toBe(200);
    const t2 = await login(app, "target@t.local");
    expect((await app.inject({ method: "GET", url: "/me", headers: auth(t2) })).json().role).toBe("chair");

    // password reset invalidates the old password and the old session
    const reset = await app.inject({
      method: "PATCH", url: `/admin/accounts/${target.id}`, headers: auth(at), payload: { password: "N3wPassword!" },
    });
    expect(reset.statusCode).toBe(200);
    const oldLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "target@t.local", password: "Password123!" } });
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "target@t.local", password: "N3wPassword!" } });
    expect(newLogin.statusCode).toBe(200);

    // deletion removes the account
    const del = await app.inject({ method: "DELETE", url: `/admin/accounts/${target.id}`, headers: auth(at) });
    expect(del.statusCode).toBe(200);
    const gone = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "target@t.local", password: "N3wPassword!" } });
    expect(gone.statusCode).toBe(401);
  });

  it("protects the acting admin and the last admin account", async () => {
    const db = freshDb();
    const app = buildApp();
    const boss = await makeUser(db, "admin", "boss@t.local");
    const at = await login(app, "boss@t.local");

    // cannot delete yourself
    const self = await app.inject({ method: "DELETE", url: `/admin/accounts/${boss.id}`, headers: auth(at) });
    expect(self.statusCode).toBe(400);

    // cannot demote yourself
    const demote = await app.inject({ method: "PATCH", url: `/admin/accounts/${boss.id}`, headers: auth(at), payload: { role: "press" } });
    expect(demote.statusCode).toBe(400);

    // cannot delete the only other admin either (would leave zero admins)
    const other = await makeUser(db, "admin", "other@t.local");
    const selfDemote = await app.inject({ method: "PATCH", url: `/admin/accounts/${other.id}`, headers: auth(at), payload: { role: "press" } });
    expect(selfDemote.statusCode).toBe(200); // two admins -> demotion allowed
    const lastDemote = await app.inject({ method: "PATCH", url: `/admin/accounts/${boss.id}`, headers: auth(at), payload: { role: "press" } });
    expect(lastDemote.statusCode).toBe(400); // now the only admin -> blocked
  });

  it("deleting a user reassigns their articles to the acting admin", async () => {
    const db = freshDb();
    const app = buildApp();
    const boss = await makeUser(db, "admin", "boss@t.local");
    const writer = await makeUser(db, "press", "writer@t.local");
    const at = await login(app, "boss@t.local");
    const wt = await login(app, "writer@t.local");
    const body = "word ".repeat(30);
    const art = await app.inject({
      method: "POST", url: "/articles", headers: auth(wt),
      payload: { title: "Authored Article Title", body, category: "Report", tags: [] },
    });
    expect(art.statusCode).toBe(201);
    const { id } = art.json() as { id: string };

    const del = await app.inject({ method: "DELETE", url: `/admin/accounts/${writer.id}`, headers: auth(at) });
    expect(del.statusCode).toBe(200);
    expect((del.json() as { reassignedArticles: number }).reassignedArticles).toBe(1);

    const still = await app.inject({ method: "GET", url: `/articles/${id}`, headers: auth(at) });
    expect(still.statusCode).toBe(200);
    expect((still.json() as { author_id: string }).author_id).toBe(boss.id);
  });

  it("bulk-imports accounts and skips existing emails", async () => {
    const db = freshDb();
    const app = buildApp();
    await makeUser(db, "admin", "boss@t.local");
    const at = await login(app, "boss@t.local");
    const res = await app.inject({
      method: "POST", url: "/admin/accounts/bulk", headers: auth(at),
      payload: {
        rows: [
          { email: "a@t.local", name: "A", role: "press", password: "Password123!" },
          { email: "b@t.local", name: "B", role: "eb", password: "Password123!" },
          { email: "a@t.local", name: "Dup", role: "press", password: "Password123!" },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { created: number; skipped: number };
    expect(body.created).toBe(2);
    expect(body.skipped).toBe(1);
  });
});

describe("admin committee oversight", () => {
  it("admin edits, archives and deletes committees; non-admins are blocked", async () => {
    const db = freshDb();
    const app = buildApp();
    await makeUser(db, "admin", "boss@t.local");
    await makeUser(db, "eb", "eb@t.local");
    await makeUser(db, "press", "p@t.local");
    const at = await login(app, "boss@t.local");
    const et = await login(app, "eb@t.local");
    const pt = await login(app, "p@t.local");

    const com = await app.inject({
      method: "POST", url: "/committees", headers: auth(at),
      payload: { name: "Security Council", abbreviation: "UNSC", venue: "Hall A" },
    });
    expect(com.statusCode).toBe(201);
    const cid = (com.json() as { id: string }).id;

    // non-admin cannot use the oversight endpoints
    for (const t of [et, pt]) {
      expect((await app.inject({ method: "GET", url: "/admin/committees", headers: auth(t) })).statusCode).toBe(403);
      expect((await app.inject({ method: "PATCH", url: `/admin/committees/${cid}`, headers: auth(t), payload: { venue: "X" } })).statusCode).toBe(403);
      expect((await app.inject({ method: "DELETE", url: `/admin/committees/${cid}`, headers: auth(t) })).statusCode).toBe(403);
    }

    // admin can edit
    const edited = await app.inject({
      method: "PATCH", url: `/admin/committees/${cid}`, headers: auth(at),
      payload: { venue: "Hall B", status: "in_session", progressPercent: 65 },
    });
    expect(edited.statusCode).toBe(200);
    const detail = await app.inject({ method: "GET", url: `/committees/${cid}`, headers: auth(at) });
    expect(detail.json().venue).toBe("Hall B");
    expect(detail.json().progressPercent).toBe(65);
    expect(detail.json().status).toBe("in_session");

    // duplicate abbreviation is rejected
    await app.inject({ method: "POST", url: "/committees", headers: auth(at), payload: { name: "Other", abbreviation: "WHO" } });
    const clash = await app.inject({
      method: "PATCH", url: `/admin/committees/${cid}`, headers: auth(at), payload: { abbreviation: "WHO" },
    });
    expect(clash.statusCode).toBe(409);

    // oversight list includes the committee
    const list = await app.inject({ method: "GET", url: "/admin/committees", headers: auth(at) });
    expect((list.json() as Array<{ id: string }>).some((c) => c.id === cid)).toBe(true);

    // archive round-trips
    expect((await app.inject({ method: "PATCH", url: `/admin/committees/${cid}`, headers: auth(at), payload: { archived: true } })).statusCode).toBe(200);
    const after = await app.inject({ method: "GET", url: `/committees/${cid}`, headers: auth(at) });
    expect(after.json().archived).toBe(true);

    // delete cascades: delegates removed, articles detached
    const del = await app.inject({ method: "POST", url: "/delegates", headers: auth(at), payload: { name: "Asha", committeeId: cid, country: "India" } });
    expect(del.statusCode).toBe(201);
    const rm = await app.inject({ method: "DELETE", url: `/admin/committees/${cid}`, headers: auth(at) });
    expect(rm.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: `/committees/${cid}`, headers: auth(at) })).statusCode).toBe(404);
  });

  it("admin can remove committee members, sessions and agenda items", async () => {
    const db = freshDb();
    const app = buildApp();
    await makeUser(db, "admin", "boss@t.local");
    const chair = await makeUser(db, "chair", "chair@t.local");
    const at = await login(app, "boss@t.local");
    const com = await app.inject({ method: "POST", url: "/committees", headers: auth(at), payload: { name: "Council", abbreviation: "C1" } });
    const cid = (com.json() as { id: string }).id;

    await app.inject({ method: "POST", url: `/committees/${cid}/members`, headers: auth(at), payload: { userId: chair.id } });
    const sess = await app.inject({
      method: "POST", url: `/committees/${cid}/sessions`, headers: auth(at),
      payload: { title: "Session One", startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 3600_000).toISOString() },
    });
    const sid = (sess.json() as { id: string }).id;
    const ag = await app.inject({ method: "POST", url: `/committees/${cid}/agenda`, headers: auth(at), payload: { title: "Opening statements" } });
    const aid = (ag.json() as { id: string }).id;

    expect((await app.inject({ method: "DELETE", url: `/admin/committees/${cid}/members/${chair.id}`, headers: auth(at) })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: `/admin/committees/${cid}/sessions/${sid}`, headers: auth(at) })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: `/admin/committees/${cid}/agenda/${aid}`, headers: auth(at) })).statusCode).toBe(200);

    const detail = await app.inject({ method: "GET", url: `/committees/${cid}`, headers: auth(at) });
    expect(detail.json().members).toHaveLength(0);
    expect(detail.json().sessions).toHaveLength(0);
    expect(detail.json().agendaItems).toHaveLength(0);
  });
});
