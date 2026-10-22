/* Dev-only bootstrap.
 *
 * Creates the demo ACCOUNTS so every role can be tried, but NO content:
 * no committees, delegates, articles, points or notifications. The admin
 * creates all of that from the Admin centre (desktop /admin, or the mobile
 * Profile -> Admin centre).
 *
 * Idempotent: existing accounts are left alone.
 */
import { getDb, uid } from "./db.js";
import { hashPassword } from "./auth.js";

const db = getDb();

const PASSWORD = "Sciverse123!";

const ACCOUNTS: Array<[string, string, string]> = [
  ["admin@sciverse.local", "Admin", "admin"],
  ["coord@sciverse.local", "Priya Coordinator", "coordinator"],
  ["eb@sciverse.local", "Arjun EB", "eb"],
  ["chair@sciverse.local", "Meera Chair", "chair"],
  ["press@sciverse.local", "Dev Press", "press"],
  ["org@sciverse.local", "Sam Organizer", "organizer"],
];

let created = 0;
for (const [email, name, role] of ACCOUNTS) {
  if (db.prepare(`SELECT id FROM users WHERE email = ?`).get(email)) continue;
  db.prepare(`INSERT INTO users (id, email, name, role, password_hash) VALUES (?,?,?,?,?)`)
    .run(uid(), email, name, role, await hashPassword(PASSWORD));
  created++;
  console.log(`created ${email} (${role})`);
}
if (created === 0) console.log("all demo accounts already exist");

db.prepare(
  `INSERT OR IGNORE INTO event_settings (key, value) VALUES ('eventName','Sciverse Summit'),('timezone','Asia/Kolkata')`,
).run();

console.log(`bootstrap complete — ${created} account(s) created, no demo content seeded`);
