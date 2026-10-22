import { getDb } from "../src/db.js";
const db = getDb();
console.log("users:", db.prepare("SELECT email, role FROM users").all());
for (const t of ["committees", "delegates", "articles", "point_awards", "notifications"]) {
  console.log(t, (db.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as { c: number }).c);
}
