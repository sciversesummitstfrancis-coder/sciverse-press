# Database

Tables: `users`, `sessions`, `committees`, `committee_members`, `sessions_sched`, `agenda_items`, `progress_events`, `delegates`, `point_awards`, `articles`, `article_revisions`, `reviews`, `attachments`, `notifications`, `announcements`, `audit_logs`, `event_settings`. See `backend/src/schema.sql` (authoritative).

- Timestamps stored as UTC ISO-8601 (`strftime('%Y-%m-%dT%H:%M:%fZ','now')`), rendered in the user's local timezone.
- Foreign keys + `ON DELETE CASCADE` where history must follow the parent; audit-relevant rows (`point_awards`, `article_revisions`, `audit_logs`) are append-only — corrections are new rows, never UPDATEs of history.
- Indexes on all frequent filters: email, role, committee/time, delegate/time, article status/author/category, notification user/time, audit time/entity.
- Pagination on every list (`limit` capped).

## Postgres (production)

The logical schema is identical. DDL deltas: `TEXT PRIMARY KEY` → `uuid PRIMARY KEY DEFAULT gen_random_uuid()`; `INTEGER` booleans → `BOOLEAN`; `strftime(...)` defaults → `now()`; `AUTOINCREMENT`-style → `GENERATED ALWAYS AS IDENTITY` where used; `INSERT ... ON CONFLICT` already Postgres-compatible. Recommended: run Prisma migrate or `psql -f backend/src/schema.sql` after applying the deltas above (a commented Postgres header will be added with the migration PR).

## Backup / restore

SQLite dev: `cp backend/data.sqlite backups/$(date +%F).sqlite` (WAL mode — copy both files or `.backup`). Postgres: `pg_dump --format=custom $DATABASE_URL > backup.dump`, restore with `pg_restore`.
