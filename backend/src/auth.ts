import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const ACCESS_TTL_MS = 1000 * 60 * 30; // 30 min
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const dk = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${dk.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algo, salt, hex] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hex) return false;
  const dk = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  if (dk.length !== expected.length) return false;
  return timingSafeEqual(dk, expected);
}

// Minimal stateless access token: base64url(payload).sig where sig is HMAC.
// Keeps sessions revocable via refresh-token table; access tokens are short-lived.
import { createHmac } from "node:crypto";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production")
    throw new Error("SESSION_SECRET must be set in production");
  return s ?? "dev-only-secret-change-me";
}

export interface AccessClaims {
  sub: string;
  role: string;
  exp: number;
  sid: string;
}

export function signAccess(sub: string, role: string, sid: string): string {
  const claims: AccessClaims = {
    sub,
    role,
    sid,
    exp: Date.now() + ACCESS_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAccess(token: string): AccessClaims | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as AccessClaims;
    if (claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

export function newRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("hex");
  const hash = createHmac("sha256", secret()).update(token).digest("hex");
  return { token, hash };
}

export function hashRefresh(token: string): string {
  return createHmac("sha256", secret()).update(token).digest("hex");
}

export { ACCESS_TTL_MS, REFRESH_TTL_MS };
