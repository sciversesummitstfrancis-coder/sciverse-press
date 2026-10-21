# Testing

```bash
npm test --prefix shared     # RBAC matrix, transitions, validation (3 tests)
npm test --prefix backend    # API integration vs in-memory DB (5 tests, 2 files):
                             #  auth+Rbac · article lifecycle+409 conflict ·
                             #  committees/points/rankings/idempotency/audit/analytics ·
                             #  attachments (exe + magic-byte rejection, download
                             #  visibility) · analytics filter parameterization
npm run build --prefix desktop  # typecheck + production bundle
```

Also verified live (2026-10-16): seeded server boot, press login, EB progress update, deduped press notification (`unread: 1`), analytics payload keys, article full lifecycle through HTTP.
`desktop/e2e/smoke.spec.ts` holds the Playwright journey (login → submit article → committee progress → rankings) for CI with browsers installed.
Every critical bug fix must add a regression test in `backend/test/`.
