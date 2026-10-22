# Sciverse Summit — Press & Committee Management Platform

Monorepo: **desktop** (Vite + React + TS, Tauri 2-ready) · **mobile** (Expo/React Native) · **backend** (Fastify + SQLite, Postgres-compatible schema) · **shared** (Zod contracts, RBAC, API client, design tokens).

The existing `sciverse-summit/` marketing site is untouched; this platform lives in `sciverse-press-platform/`.

## Quick start (Fedora)

```bash
cd sciverse-press-platform
./scripts/launch.sh        # installs, seeds, starts backend :4000 + desktop :5173
```

Manual:
```bash
npm install --prefix shared && npm run build --prefix shared
npm install --prefix backend && npm run seed --prefix backend   # demo accounts, dev only
PORT=4000 npm start --prefix backend
npm install --prefix desktop && npm run dev --prefix desktop    # http://localhost:5173
```

Demo logins (seeded in dev only, password `Sciverse123!`):
`admin@sciverse.local`, `coord@sciverse.local`, `eb@sciverse.local`, `chair@sciverse.local`, `press@sciverse.local`, `org@sciverse.local`.

The same six accounts are **seeded inside the Android APK itself**, so the app
signs in instantly and works with the laptop switched off.

## Docs

- `ARCHITECTURE.md` — modules, data flow, realtime, offline strategy
- `docs/API.md` — REST contract + OpenAPI (`GET /openapi.json`)
- `docs/DATABASE.md` — schema, migrations, Postgres path, backup
- `docs/SECURITY.md` — auth, uploads, headers, audit
- `docs/TESTING.md` — what is tested and how to run it
- `docs/ANDROID_BUILD.md` — APK/AAB instructions
- `docs/DESKTOP_BUILD.md` — Tauri desktop installers (Linux/Windows/macOS)
- `docs/ADMIN.md` — admin powers, safety rails and the account/committee API
- `docs/UPDATES.md` — auto-update system (desktop signer + mobile OTA)
- `docs/GITHUB_RELEASE.md` — how to publish a release to GitHub
- `.env.example` — all configuration

## Verified working (2026-10-20)

- `shared`: build + 3 unit tests pass
- `backend`: build + **13 API integration tests pass** (auth/RBAC, article lifecycle incl. 409 conflict, committees/points/rankings/audit/analytics, attachments, plus the new admin account/committee suite: create, edit, reset, delete, bulk import, last-admin protection, self-delete protection, article re-assignment, committee oversight and cascade delete)
- `desktop`: production build passes + **4 component tests pass** (command palette open/close/filters/navigates); live browser verification confirmed admin login, the Accounts and Committees tabs, the committee editor drawer, and the ⌘K palette
- `mobile`: **standalone release APK built and verified** — `dist/SciversePress-v1.2.0-release.apk`, versionCode 4, 73 MB, package `com.sciverse.press`, ABIs arm64-v8a/armeabi-v7a/x86/x86_64, embedded JS bundle, signed (debug keystore). TypeScript typecheck passes.
- `mobile` (v1.2.0): the app is **local-first and fully offline** — it carries its own SQLite database (`expo-sqlite`). Sign-in is verified on the device, so there is **no server URL, no localhost and no network call** in the normal path. The **Admin centre runs on-device too** (create/delete accounts, change roles, create/patch/delete committees, live activity feed). The REST backend stays optional and is only contacted if a server URL is explicitly configured. The seed is self-healing, so an install from an older build repairs itself on next launch.
- `desktop`: **native Tauri 2 installers built and verified** (2026-10-20) — see below.

### Accounts on a device

The **Admin centre** (mobile: Profile → Admin centre) runs entirely on the
device, so a fresh install is usable with no server at all:

* All six demo accounts are seeded locally (`admin`, `coord`, `eb`, `chair`,
  `press`, `org` @ `sciverse.local`, password `Sciverse123!`) so every role can
  be tried
* The admin can create further accounts (email, name, role, password), change
  roles, delete accounts, and create/edit/delete committees
* The desktop app and the backend keep their own copies of the same model; the
  mobile app syncs with a server only when one is explicitly configured

### Admin powers

The admin can **create and delete accounts** (including bulk import, role
changes and password resets) and **oversee every committee** — edit any field,
force status and progress, archive, delete, and manage rosters, sessions and
agenda items. All of it is enforced **server-side** under the new
`admin:accounts` / `admin:committees` permissions, with hard safety rails
(you cannot delete yourself, demote yourself, or remove the last admin).
See `docs/ADMIN.md`.

### New features

* **Command palette** (`Ctrl`/`Cmd` + `K`, or `/`) — fuzzy search across
  committees, articles and delegates, plus navigation and quick actions.
* **Live newsroom ticker** — an animated, self-refreshing feed of everything
  happening across the summit, on the desktop dashboard and the mobile
  *Live newsroom feed* screen.
* **Runtime-configurable server address** — the packaged desktop and mobile
  apps point at a real backend instead of a dev proxy, and the address is
  editable from the login screen.

### Auto-update — no uninstall needed

Both clients can update in place:

* **Desktop** — the Tauri updater plugin polls a release manifest, downloads
  the platform artefact, **verifies its minisign signature** against the
  public key baked into the app, and installs it over the old copy. The app
  restarts itself. Users never uninstall or re-download anything.
* **Android** — `expo-updates` swaps the JavaScript bundle on the device; the
  installed APK is untouched. (Native changes still need a new APK — that is
  an Android rule.)

```bash
# publish a desktop update (builds, signs, writes latest.json)
scripts/release-desktop.sh 1.0.2

# publish an Android OTA update
node scripts/publish-mobile-update.mjs
node scripts/updates-server.mjs --dir mobile/dist/updates
```

The signing key lives in `~/.tauri/sciverse-updater.key` (git-ignored, never
committed). Losing it means you can never publish an update to machines that
already have the app. See `docs/UPDATES.md`.

### Desktop installers (Tauri 2)

Built as real native desktop apps (Rust + Wry shell around the same React frontend), in `dist-desktop/`:

| Artifact | Platform | Size |
|---|---|---|
| `SciversePress-v1.0.1-linux-x86_64.AppImage` | Linux x64 (portable, single file) | 99 MB |
| `SciversePress-v1.0.1-linux-amd64.deb` | Debian / Ubuntu | 3.1 MB |
| `SciversePress-v1.0.1-linux-x86_64.rpm` | Fedora / RHEL | 3.1 MB |
| `SciversePress-v1.0.1-windows-x64-setup.exe` | Windows x64 (NSIS installer) | 2.2 MB |
| `SciversePress-v1.0.1-windows-x64.exe` | Windows x64 (portable binary) | 8.7 MB |

```bash
# Linux
chmod +x dist-desktop/SciversePress-v1.0.1-linux-x86_64.AppImage
./dist-desktop/SciversePress-v1.0.1-linux-x86_64.AppImage

# or install as a package
sudo dpkg -i dist-desktop/SciversePress-v1.0.1-linux-amd64.deb
sudo rpm -i dist-desktop/SciversePress-v1.0.1-linux-x86_64.rpm
```

The Windows `.exe` was cross-compiled from Linux with `cargo-xwin`; the macOS
`.dmg`/`.app` must be built on a Mac (`.github/workflows/build-desktop.yml`
does this automatically, or run `scripts/build-desktop.sh` on the Mac).

The packaged app talks to the backend directly (no dev proxy) and the server
address is editable from the login screen, so one binary works on any network.
Backend CORS now allows the `tauri://localhost` / `http://tauri.localhost`
origins used by the packaged app.

Known limitations: Windows and macOS binaries are **unsigned** (macOS will need
right-click → Open, or Apple notarisation); Postgres not installed locally so
dev runs on SQLite with an identical logical schema — set `DATABASE_PATH` and
apply `backend/src/schema.sql` (Postgres dialect notes in `docs/DATABASE.md`)
for production.

### Building the Android APK

```bash
# The app ships with its own database — no server required:
scripts/build-android.sh
# → dist/SciversePress-v1.1.0-release.apk   (adb install -r <file>)

# Optional: point it at a backend for live data + sync
EXPO_PUBLIC_API_URL=http://192.168.1.8:4000 scripts/build-android.sh
```

Requires **JDK 17** (not 21+) and the Android SDK. The server URL can also be
changed at runtime from the login screen, so one APK works on any network.
