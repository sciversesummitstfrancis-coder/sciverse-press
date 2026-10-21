import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
let db: Database.Database;

export function getDb(path?: string): Database.Database {
  if (!db) {
    const file =
      path ?? process.env.DATABASE_PATH ?? join(here, "..", "data.sqlite");
    db = new Database(file);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    const schema = readFileSync(join(here, "schema.sql"), "utf8");
    db.exec(schema);
  }
  return db;
}

export function resetDbForTests(): Database.Database {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  const schema = readFileSync(join(here, "schema.sql"), "utf8");
  db.exec(schema);
  return db;
}

/** For tests: swap the singleton with an in-memory db. */
export function __setDb(d: Database.Database) {
  db = d;
}

export function uid(prefix = ""): string {
  const r = Math.random().toString(16).slice(2) + Date.now().toString(16);
  // pseudo-uuid v4 shape
  const h = (prefix + r).replace(/[^a-f0-9]/gi, "a").padEnd(32, "0").slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
