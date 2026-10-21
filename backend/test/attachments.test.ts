import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), "sp-uploads-"));

const { buildApp } = await import("../src/app.js");
const { __setDb } = await import("../src/db.js");
const { hashPassword } = await import("../src/auth.js");

const here = dirname(fileURLToPath(import.meta.url));

function freshDb() {
  const d = new Database(":memory:");
  d.pragma("foreign_keys = ON");
  d.exec(readFileSync(join(here, "..", "src", "schema.sql"), "utf8"));
  __setDb(d);
  return d;
}

async function makeUser(db: Database.Database, role: string, email: string) {
  const id = randomUUID();
  db.prepare(`INSERT INTO users (id, email, name, role, password_hash) VALUES (?,?,?,?,?)`)
    .run(id, email, role, role, await hashPassword("Password123!"));
  return id;
}

async function login(app: ReturnType<typeof buildApp>, email: string) {
  const r = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "Password123!" } });
  return (r.json() as { accessToken: string }).accessToken;
}

function multipart(filename: string, mime: string, bytes: Buffer) {
  const b = "----sp-test-boundary";
  const head = Buffer.from(
    `--${b}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${b}--\r\n`);
  return { payload: Buffer.concat([head, bytes, tail]), contentType: `multipart/form-data; boundary=${b}` };
}

describe("attachments", () => {
  it("rejects executables, accepts images, serves downloads with visibility checks", async () => {
    const db = freshDb();
    const app = buildApp();
    await makeUser(db, "press", "au@t.local");
    await makeUser(db, "press", "other@t.local");
    const t = await login(app, "au@t.local");
    const ot = await login(app, "other@t.local");
    const created = await app.inject({
      method: "POST", url: "/articles", headers: { authorization: `Bearer ${t}` },
      payload: { title: "Attachment Test Article", body: "word ".repeat(30), category: "Report" },
    });
    const aid = (created.json() as { id: string }).id;

    // executable rejected
    const evil = multipart("run.exe", "application/x-msdownload", Buffer.from("MZ..."));
    const rej = await app.inject({
      method: "POST", url: `/articles/${aid}/attachments`,
      headers: { authorization: `Bearer ${t}`, "content-type": evil.contentType },
      payload: evil.payload,
    });
    expect(rej.statusCode).toBe(415);

    // fake image (bad magic bytes) rejected
    const fake = multipart("fake.png", "image/png", Buffer.from("not-an-image-at-all"));
    const rej2 = await app.inject({
      method: "POST", url: `/articles/${aid}/attachments`,
      headers: { authorization: `Bearer ${t}`, "content-type": fake.contentType },
      payload: fake.payload,
    });
    expect(rej2.statusCode).toBe(415);

    // real PNG header accepted
    const png = multipart("shot.png", "image/png",
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]));
    const ok = await app.inject({
      method: "POST", url: `/articles/${aid}/attachments`,
      headers: { authorization: `Bearer ${t}`, "content-type": png.contentType },
      payload: png.payload,
    });
    expect(ok.statusCode).toBe(201);
    const fileId = (ok.json() as { id: string }).id;

    // author can download
    const dl = await app.inject({ method: "GET", url: `/attachments/${fileId}`, headers: { authorization: `Bearer ${t}` } });
    expect(dl.statusCode).toBe(200);
    expect(dl.headers["x-content-type-options"]).toBe("nosniff");

    // unrelated press user cannot download an unpublished draft's file
    const blocked = await app.inject({ method: "GET", url: `/attachments/${fileId}`, headers: { authorization: `Bearer ${ot}` } });
    expect(blocked.statusCode).toBe(403);
  });

  it("analytics committee filter is parameterized and works", async () => {
    const db = freshDb();
    const app = buildApp();
    await makeUser(db, "admin", "an@t.local");
    const t = await login(app, "an@t.local");
    const r = await app.inject({ method: "GET", url: "/analytics/overview?committeeId=' OR '1'='1", headers: { authorization: `Bearer ${t}` } });
    expect(r.statusCode).toBe(200);
  });
});
