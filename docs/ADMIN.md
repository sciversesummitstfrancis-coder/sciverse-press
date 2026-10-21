# Admin Centre

The admin role has full operational control. Everything below is enforced
**server-side** — the UI hides controls, but the API is the real boundary.

## Accounts

`GET /admin/accounts` — every account with derived stats (active sessions,
articles written, committees, last seen).

| Action | Endpoint | Notes |
|---|---|---|
| Create | `POST /admin/accounts` | `{ email, name, role, password }` — password ≥ 8 chars |
| Bulk create | `POST /admin/accounts/bulk` | up to 200 rows; existing emails are skipped, not overwritten |
| Edit | `PATCH /admin/accounts/:id` | change `name`, `role`, or reset `password` |
| Delete | `DELETE /admin/accounts/:id` | removes the account and its sessions |

### Safety rails

These are enforced in the API, not just hidden in the UI:

* An admin **cannot delete their own account**.
* An admin **cannot remove their own admin role**.
* The **last remaining admin** cannot be deleted or demoted — the platform
  would otherwise be left with no administrator.
* Resetting a password **revokes every active session** for that user.
* Deleting a user **re-points their articles, revisions, reviews, progress
  events, point awards and announcements** at the acting admin, so published
  pressroom work and the audit trail survive. Notifications and committee
  memberships cascade-delete.
* Every create / edit / delete is written to `audit_logs`.

### Permissions

`admin:accounts` and `admin:committees` are new, **admin-only** permissions
declared in `shared/src/index.ts`. Press, EB, chair, coordinator and organizer
all receive `403` on these routes.

## Committee oversight

`GET /admin/committees` — every committee including archived ones, with
member / delegate / article / session / agenda counts and the last update
time.

| Action | Endpoint |
|---|---|
| Edit any field | `PATCH /admin/committees/:id` |
| Force status / progress | `PATCH /admin/committees/:id` with `status`, `progressPercent`, `currentAgendaItem` |
| Archive / restore | `PATCH /admin/committees/:id` with `archived` |
| Delete | `DELETE /admin/committees/:id` |
| Remove a member | `DELETE /admin/committees/:id/members/:userId` |
| Delete a session | `DELETE /admin/committees/:id/sessions/:sessionId` |
| Delete an agenda item | `DELETE /admin/committees/:id/agenda/:itemId` |

Deleting a committee detaches its articles (they survive) and removes its
delegates (their committee is required, so they cannot dangle). Agenda item
positions are re-packed after a delete so ordering stays contiguous.

Committee **abbreviations must be unique** — a duplicate returns `409`.

## Where the UI lives

* **Desktop** — `/admin` in the app, split into four tabs: Overview, Accounts,
  Committees, Audit log. The Audit log is filterable by action, entity or
  detail text.
* **Mobile** — Profile → **Admin centre** (visible only when the signed-in
  user is an admin). Same two panels: Accounts and Committees.

## Live newsroom ticker

`GET /activity` returns a human-readable stream of everything that just
happened, with each entry enriched with the title of the article, committee,
delegate or account involved. It backs the animated ticker on the desktop
dashboard and the *Live newsroom feed* screen on mobile. Polls every 12–15
seconds and degrades quietly when the backend is unreachable.

## First run

The platform ships **no built-in content**. A fresh database contains exactly
one account:

```
admin@sciverse.local / Sciverse123!
```

Everything else — committees, delegates, articles, points — is created from
the admin UI. Create the rest of the accounts from **Accounts → New account**,
and committees from **Committees → New**.

`npm run seed -w backend` is idempotent: it creates the bootstrap admin if
missing and does nothing else.

## Demo credentials

| Email | Role | Password |
|---|---|---|
| `admin@sciverse.local` | admin | `Sciverse123!` |

Additional accounts are created by the admin — there are no other defaults.
