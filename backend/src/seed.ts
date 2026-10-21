/* Dev-only bootstrap. Creates ONE admin account for demo purposes.
 *
 * No demo committees, delegates, articles or points are seeded — the admin
 * creates those from the Admin centre. See `npm run seed`.
 */
import { getDb, uid } from "./db.js";
import { hashPassword } from "./auth.js";

const db = getDb();

const BOOTSTRAP = {
  email: "admin@sciverse.local",
  name: "Admin",
  role: "admin" as const,
  password: "Sciverse123!",
};

const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(BOOTSTRAP.email);
if (existing) {
  console.log(`bootstrap account already exists: ${BOOTSTRAP.email}`);
} else {
  db.prepare(`INSERT INTO users (id, email, name, role, password_hash) VALUES (?,?,?,?,?)`)
    .run(uid(), BOOTSTRAP.email, BOOTSTRAP.name, BOOTSTRAP.role, await hashPassword(BOOTSTRAP.password));
  console.log(`created bootstrap admin: ${BOOTSTRAP.email} / ${BOOTSTRAP.password}`);
}

db.prepare(
  `INSERT OR IGNORE INTO event_settings (key, value) VALUES ('eventName','Sciverse Summit'),('timezone','Asia/Kolkata')`,
).run();

console.log("bootstrap complete — no demo content seeded");
