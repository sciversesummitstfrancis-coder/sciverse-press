# Security

- Passwords: scrypt (64-byte, random 16-byte salt). Never logged.
- Sessions: 30-min HMAC access tokens + 7-day httpOnly SameSite=Lax refresh cookies (Secure in production); revocable per-session and per-user.
- Authorization enforced server-side on every route (`can(role, perm)`); UI hiding is cosmetic only.
- Validation: shared Zod schemas; file uploads allowlisted (png/jpg/webp/pdf/txt), magic-byte sniffed, 8 MB cap, 3 files max, randomized storage names, never served as executable.
- Rate limiting: 300 req/min/IP; CORS restricted via `CORS_ORIGIN`; production requires `SESSION_SECRET` (server refuses to boot without it in `NODE_ENV=production`).
- Audit logs for user/role changes, committee ops, points, article transitions, exports, settings.
- IDOR protection: article visibility checks (own or published unless reviewer); attachment upload checks authorship.
- Secrets only via env (see `.env.example`); demo credentials exist solely in dev seed, never in production.
- Dependency checks: `npm audit --omit=dev` in CI before release.
