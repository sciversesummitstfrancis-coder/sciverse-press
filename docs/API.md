# API

Base `http://localhost:4000`. Auth: `Authorization: Bearer <accessToken>`. Full machine-readable spec: `GET /openapi.json`.

| Method | Path | Perm | Notes |
|---|---|---|---|
| POST | /auth/register | open | roles press/eb/chair/coordinator/organizer (admin blocked in prod) |
| POST | /auth/login | open | returns accessToken + httpOnly refresh cookie |
| POST | /auth/refresh | cookie | rotates access token |
| POST | /auth/logout | auth | revokes session |
| GET | /me | auth | |
| GET | /users | admin:users | `?q=` search |
| PATCH | /users/:id/role | admin:users | audited, confirm in UI |
| DELETE | /users/:id/sessions | admin:users | revoke all sessions |
| GET | /audit-logs | admin:config | `?limit=&offset=` |
| GET | /admin/health | admin:config | table counts + errors |
| GET | /admin/export/:entity | admin:export | CSV (users, articles, delegates, point_awards, committees, audit_logs) |
| GET | /committees | open | |
| POST | /committees | admin:config | |
| GET | /committees/:id | open | detail + sessions + agenda + timeline + related articles + next session |
| POST | /committees/:id/members | admin:config | |
| POST | /committees/:id/sessions | admin:config | validates endsAt > startsAt |
| POST | /committees/:id/agenda | admin:config | |
| PATCH | /committees/:id/agenda/:itemId | committee:update | toggle done |
| POST | /committees/:id/progress | committee:update | transaction + deduped press notifications |
| POST | /committees/:id/announce | committee:update | notifies all users |
| GET | /announcements | auth | |
| POST | /delegates | admin:config | |
| GET | /delegates | open | `?committeeId=&country=&q=&minPoints=&limit=&offset=` computed ranks |
| GET | /delegates/:id | open | totals, trend, by-category, award history |
| POST | /points/award | points:award | `Idempotency-Key` supported, value −50..100 |
| POST | /points/:awardId/reverse | points:reverse | append-only reversal |
| GET | /radar | open | 24h movers + active committees, factual only |
| GET/POST | /articles | article:submit | press see own+published; `?status=&category=&committeeId=&q=&sort=&limit=&offset=` |
| GET | /articles/queue | article:review | pending review |
| GET | /articles/:id | auth | detail + revisions + reviews + attachments (visibility enforced) |
| PATCH | /articles/:id | article:submit | `expectedVersion` → 409 on conflict |
| POST | /articles/:id/transition | auth | author submit moves; reviewers others |
| POST | /articles/:id/review | article:review | assign/request_revision/approve/reject/publish |
| POST | /articles/:id/attachments | article:submit | multipart, allowlist + sniff, 8 MB |
| GET | /notifications | auth | `{items, unread}` |
| POST | /notifications/:id/read, /read-all | auth | |
| GET | /notifications/stream | auth | SSE |
| GET | /analytics/overview | auth | `?from=&to=&committeeId=` live SQL |
| GET/PUT | /settings | auth / admin:config | event settings |
| GET | /health, /openapi.json | open | |
