# Publishing a release to GitHub

Everything is automated. One command builds a folder that is ready to upload.

## 1. Set your repository (once)

```jsonc
// release.config.json
{
  "githubRepo": "yourname/sciverse-press",   // <- change this
  "productName": "Sciverse Press",
  "homepage": "https://github.com/yourname/sciverse-press",
  "supportUrl": "https://github.com/yourname/sciverse-press/issues"
}
```

> **Important:** the update endpoint is baked into the shipped app, in
> `desktop/src-tauri/tauri.conf.json` → `plugins.updater.endpoints[0]`.
> Change it to your repo and **rebuild the desktop app**, otherwise installed
> copies will poll the old URL and never see your release.
> The release script warns you if the two disagree.

## 2. Build the release folder

```bash
scripts/make-release-folder.sh              # uses release.config.json
scripts/make-release-folder.sh 1.0.2 myname/sciverse-press   # or override
```

Output: `dist-release/SciversePress-v<version>/`

```
SciversePress-v1.0.1-linux-x86_64.AppImage        100 MB  portable Linux
SciversePress-v1.0.1-linux-x86_64.AppImage.sig     448 B  its signature
SciversePress-v1.0.1-linux-amd64.deb             3.1 MB  Debian / Ubuntu
SciversePress-v1.0.1-linux-x86_64.rpm            3.1 MB  Fedora / RHEL
SciversePress-v1.0.1-windows-x64-setup.exe       3.3 MB  Windows installer
SciversePress-v1.0.1-windows-x64-setup.exe.sig   444 B  its signature
SciversePress-v1.0.1-windows-x64.exe              12 MB  Windows portable
SciversePress-v1.0.1-android.apk                 58 MB  Android
latest.json                                      1.4 KB  update manifest
SHA256SUMS.txt                                    949 B  checksums
README.md                                         1.5 KB  what each file is
```

## 3. Check it before uploading

```bash
PUB=$(python3 -c "import json;print(json.load(open('desktop/src-tauri/tauri.conf.json'))['plugins']['updater']['pubkey'])")
node scripts/verify-release-folder.mjs dist-release/SciversePress-v1.0.1 "$PUB"
```

It verifies the manifest, the minisign signatures, the checksums and the file
types. It must print **"All checks passed"**.

## 4. Create the GitHub release

```bash
gh release create v1.0.1 dist-release/SciversePress-v1.0.1/* \
  --title "Sciverse Press v1.0.1" \
  --notes "See README.md for what each file is."
```

Or do it by hand: **Releases → Draft a new release → tag `v1.0.1` → upload
every file from the folder**.

> Upload **all** of them, including `latest.json` and the two `.sig` files.
> `latest.json` is what the installed app polls, and the `.sig` files are
> what it checks before installing anything.

## 5. How the auto-update reaches users

The app's updater polls

```
https://github.com/<owner>/<repo>/releases/latest/download/latest.json
```

which GitHub resolves to the newest published release. When it sees a higher
version it downloads the matching artefact, **verifies the minisign
signature** against the public key baked into the app, and installs it in
place. Nobody uninstalls anything.

The manifest looks like this:

```json
{
  "version": "1.0.1",
  "notes": "Sciverse Press 1.0.1",
  "pub_date": "2026-10-21T15:05:00.000Z",
  "platforms": {
    "linux-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJp…",
      "url": "https://github.com/yourname/sciverse-press/releases/download/v1.0.1/SciversePress-v1.0.1-linux-x86_64.AppImage"
    },
    "windows-x86_64": {
      "signature": "…",
      "url": "https://github.com/yourname/sciverse-press/releases/download/v1.0.1/SciversePress-v1.0.1-windows-x64-setup.exe"
    }
  }
}
```

Only the AppImage (Linux) and the NSIS installer (Windows) are updater
artefacts. The `.deb`, `.rpm` and the portable `.exe` are there for people to
install by hand; the updater replaces the AppImage / runs the installer.

## 6. The next release

```bash
# bump versions
#   desktop/package.json + desktop/src-tauri/tauri.conf.json  -> version
#   mobile/app.json                                          -> version + versionCode
#   mobile/app.json                                          -> runtimeVersion (only if native code changed)

# rebuild the apps (see docs/DESKTOP_BUILD.md and docs/ANDROID_BUILD.md)
scripts/release-desktop.sh 1.0.2          # rebuilds, signs, regenerates the manifest
scripts/make-release-folder.sh 1.0.2      # assembles the folder
node scripts/verify-release-folder.mjs dist-release/SciversePress-v1.0.2 "$PUB"
gh release create v1.0.2 dist-release/SciversePress-v1.0.2/*
```

## Where things live

| Thing | Where |
|---|---|
| Public key (safe to publish) | `desktop/src-tauri/tauri.conf.json` → `plugins.updater.pubkey` |
| Private key (**never commit**) | `~/.tauri/sciverse-updater.key` |
| Release config | `release.config.json` |
| Release folder builder | `scripts/make-release-folder.sh` |
| Release folder checker | `scripts/verify-release-folder.mjs` |
| Signature checker | `scripts/verify-updater-signature.py` |
| Full updater docs | `docs/UPDATES.md` |
