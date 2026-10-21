# Architecture

```
              +-----------------+        +------------------+
              | desktop (web/   |        | mobile (Expo RN,  |
              | Tauri webview)  |        | SecureStore token)|
              +--------+--------+        +--------+---------+
                       | REST + SSE (poll fallback) |
                       v                            v
              +------------------------------------------------+
              | backend (Fastify, Zod, scrypt, HMAC sessions)  |
              | routes: auth/users/committees/delegates/      |
              | points/articles/reviews/attachments/          |
              | notifications(SSE hub)/analytics/admin/export |
              +------------------------------------------------+
              | SQLite (dev) — same logical schema as Postgres|
              | shared: Zod schemas, RBAC matrix, API client, |
              | tokens (colors/radii/fonts)                   |
              +------------------------------------------------+
```

- **Auth**: short-lived HMAC access token (30 min) + httpOnly refresh cookie (7 d), revocable server-side (`sessions` table). Every protected route checks role server-side via `can(role, perm)` from `@sciverse/shared`.
- **Articles**: status machine enforced both in Zod-shared `ARTICLE_TRANSITIONS` and server-side; optimistic concurrency via `expectedVersion`; every save writes `article_revisions`; reviews/attachments append-only.
- **Committees**: `committees` row holds current state; every update appends `progress_events` (timeline) inside a transaction and fans out deduped notifications (`dedupe_key` unique → no duplicates, safe reconnect via polling).
- **Points**: `point_awards` append-only; reversals mark + append a zero-value reversal row (audit preserved); `Idempotency-Key` header prevents double awards; rankings computed by query, never stored.
- **Analytics**: pure SQL aggregations over stored rows; empty arrays returned honestly when no data.
- **Uploads**: allowlist MIME + magic-byte sniff, 8 MB cap, random filenames, served never executed.
- **Offline (mobile/desktop editor)**: drafts autosaved to local storage; sync compares `updatedAt`/version — server wins on conflict with explicit message (no silent overwrite).
- **Performance**: paginated lists, lazy-loaded chart bundle (`Charts.tsx` split chunk), `low-power` mode disables backdrop blur, reduced-motion respected.
