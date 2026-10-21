# Update System

Both clients can update **without the user uninstalling anything**.

| Client | Mechanism | What updates | Reinstall needed? |
|---|---|---|---|
| Desktop (Tauri) | `tauri-plugin-updater` | The whole native binary | **No** — signed, verified, installed in place |
| Android | `expo-updates` (OTA) | The JavaScript bundle + assets | **No** — the APK is untouched |
| Android (native changes) | new APK | Native code | Yes — this is an Android platform rule |

---

## Desktop (Linux / Windows / macOS)

### How it works

1. The app polls a **release manifest** (`latest.json`) at the URL configured
   in `src-tauri/tauri.conf.json` → `plugins.updater.endpoints`.
2. If the manifest advertises a newer version, the app downloads the
   artefact for the user's platform.
3. The download is **verified with a minisign signature** against the public
   key baked into `tauri.conf.json`. An unsigned or tampered download is
   rejected and nothing is installed.
4. The new binary replaces the old one in place and the app restarts.

The user's account, settings and data are untouched — the updater only swaps
the program files.

### Where the user sees it

**Profile → Updates**. The app also checks automatically a few seconds after
launch, so a new version surfaces without the user doing anything.

### Signing keys

```bash
cd desktop
npx tauri signer generate -w ~/.tauri/sciverse-updater.key
```

This writes:

| File | Purpose |
|---|---|
| `~/.tauri/sciverse-updater.key` | **Private key — never commit or share it.** |
| `~/.tauri/sciverse-updater.key.pub` | Public key → goes in `tauri.conf.json` |

The public key is already configured in `tauri.conf.json`:

```json
"plugins": {
  "updater": {
    "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6…",
    "endpoints": ["https://github.com/sciverse-summit/sciverse-press/releases/latest/download/latest.json"],
    "windows": { "installMode": "passive" }
  }
}
```

> **If you lose the private key you can never publish an update to the
> machines that already have the app installed.** Back it up somewhere safe
> (password manager, encrypted secret store). `.gitignore` already excludes
> `*.key`.

### Publishing an update

```bash
# 1. bump the version
#    mobile/app.json  → "version" + "versionCode"
#    desktop/package.json and desktop/src-tauri/tauri.conf.json → "version"

# 2. build, sign and generate the manifest
scripts/release-desktop.sh 1.0.2

# 3. upload everything in dist-desktop/release/ to a GitHub release tagged v1.0.2
```

`release-desktop.sh` produces, for each platform:

| Platform | Artefact the updater installs | Signature |
|---|---|---|
| Linux | `*.AppImage` | `*.AppImage.sig` |
| Windows | `bundle/nsis-updater/*.exe` | `*.exe.sig` |
| macOS | `*.app.tar.gz` | `*.app.tar.gz.sig` |

plus `latest.json`, the manifest the app polls:

```json
{
  "version": "1.0.2",
  "notes": "Sciverse Press 1.0.2",
  "pub_date": "2026-10-21T12:00:00.000Z",
  "platforms": {
    "linux-x86_64":   { "signature": "…", "url": "…" },
    "windows-x86_64": { "signature": "…", "url": "…" },
    "darwin-x86_64":  { "signature": "…", "url": "…" }
  }
}
```

The platform keys are exactly what the updater looks up
(`<target>-<arch>`, e.g. `linux-x86_64`, `windows-x86_64`, `darwin-aarch64`).

Upload `latest.json` to the **latest** release so the
`releases/latest/download/latest.json` URL resolves.

### Verifying a release before you ship it

```bash
PUB=$(python3 -c "import json;print(json.load(open('desktop/src-tauri/tauri.conf.json'))['plugins']['updater']['pubkey'])")
python3 scripts/verify-updater-signature.py \
  "dist-desktop/release/Sciverse Press_1.0.2_amd64.AppImage" \
  "dist-desktop/release/Sciverse Press_1.0.2_amd64.AppImage.sig" \
  "$PUB" "1.0.2"
```

It re-implements the same checks the updater performs — Ed25519 over the
BLAKE2b-512 hash of the file, key-id match, and the `version:` field inside
the signature's trusted comment (which is what blocks a downgrade). A
tampered file or a mismatched version is rejected.

### Hosting the manifest anywhere else

The endpoint is just a URL. Point it at your own server, an S3 bucket, a CDN
or a self-hosted manifest service — anything that returns the JSON above
over HTTPS. Only HTTPS is accepted in production builds.

```json
"endpoints": [
  "https://updates.sciverse.press/{{target}}/{{arch}}/{{current_version}}"
]
```

`{{target}}`, `{{arch}}` and `{{current_version}}` are substituted, so the
server can decide per-platform whether an update exists.

### Platform notes

* **Linux** — the update replaces the AppImage. Users who installed the
  `.deb`/`.rpm` get the update applied to the installed copy too, but it is
  cleaner to publish all three formats.
* **Windows** — `installMode: "passive"` shows a small progress window and
  installs without interaction. The artefact the updater installs is the
  installer from `bundle/nsis-updater/`, not the one in `bundle/nsis/`.
* **macOS** — the updater replaces the `.app`; the app must be re-launched
  afterwards (the plugin does this automatically).

### Version numbers

`version` in `tauri.conf.json` is what the updater compares against the
manifest, so it must be bumped for every published release. The desktop and
the mobile app run on separate version trains:

| Where | Version |
|---|---|
| `desktop/package.json`, `desktop/src-tauri/tauri.conf.json` | `1.0.1` |
| `mobile/app.json` `version` / `versionCode` | `1.2.0` / `4` |
| `mobile/app.json` `runtimeVersion` | `1.1.0` (see the OTA section) |

---

## Android (over-the-air)

### How it works

`expo-updates` is enabled in the APK (`expo.modules.updates.ENABLED=true` in
`android/app/src/main/AndroidManifest.xml`). The app checks the update server
for a newer **JavaScript bundle** and swaps it in on the next launch. The
installed APK is never modified and never needs reinstalling.

### Publishing an OTA update

```bash
node scripts/publish-mobile-update.mjs
```

This runs `expo export`, writes an Expo Updates protocol v1 `manifest.json`,
and stages everything in `mobile/dist/updates/`. Each asset in the manifest
carries its own SHA-256 so the client can verify what it downloaded.

Then serve it:

```bash
node scripts/updates-server.mjs --dir mobile/dist/updates --port 4001
```

Or copy `mobile/dist/updates/` to any static host / CDN.

The server implements the parts of the Expo Updates protocol the client
needs: `GET /manifest` (with runtime-version matching), `GET /assets/*` for
the bundle and assets, and the `expo-server-defined-headers` the client
stores for later requests.

```json
{
  "id": "upd-1a15ee41057",
  "createdAt": "2026-10-21T14:36:07.127Z",
  "runtimeVersion": "1.1.0",
  "launchAsset": {
    "type": "js",
    "url": "_expo/static/js/android/index-2537c521242eb55e89dca6cc6f80c1b1.hbc",
    "hash": "U78QsiNqPzitgvhxtUc5vbdX2c3LdwAg1moShEvSm24=",
    "hashAlgorithm": "sha256",
    "mimeType": "application/javascript"
  },
  "assets": [ { "type": "asset", "url": "assets/…", "hash": "…", "hashAlgorithm": "sha256" } ],
  "metadata": { "version": "1.1.0" }
}
```

### Pointing the app at a server

The update URL is baked into the APK at build time
(`expo.updates.url` in `mobile/app.json`, mirrored into the Android
manifest). Expo SDK 51 cannot change it at runtime, so point it at your
server before building the APK:

```json
"updates": {
  "enabled": true,
  "checkAutomatically": "ON_LOAD",
  "fallbackToCacheTimeout": 0,
  "url": "https://updates.sciverse.press/manifest"
}
```

### Where the user sees it

**Profile → Check for app updates**. The app also checks once shortly after
launch and shows the result. The current runtime version and whether the app
is running the bundled build or a downloaded update are shown underneath.

### Limits

* OTA updates can only change **JavaScript and assets**. Anything in the
  native layer (a new permission, a new native module, a changed
  `AndroidManifest.xml`) needs a new APK — that is an Android rule, not a
  limitation of this setup.
* `runtimeVersion` is `1.1.0`. Bump it whenever native code changes, so
  stale OTA bundles are never served to an incompatible binary.
* The app is local-first: an OTA update replaces the UI, while the on-device
  SQLite database is left alone, so no user data is lost during an update.

---

## Signing the desktop artefact manually

If you already have a build and just want the signed updater files:

```bash
cd desktop
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/sciverse-updater.key)"
npx tauri signer sign -f "src-tauri/target/release/bundle/appimage/Sciverse Press_1.0.1_amd64.AppImage"
```

This writes `*.sig` next to the artefact.
