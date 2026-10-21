#!/usr/bin/env bash
# Assemble a GitHub-ready release folder.
#
# Creates `dist-release/SciversePress-v<version>/` containing every installer
# in a flat, predictable layout, the minisign signatures the auto-updater
# needs, the `latest.json` update manifest, a checksum file and a README
# describing each file.
#
# Upload the *contents* of that folder to a GitHub release tagged v<version>
# and the in-app updater will find it.
#
# Usage:
#   scripts/make-release-folder.sh [version] [owner/repo]
#
#   scripts/make-release-folder.sh 1.0.1
#   scripts/make-release-folder.sh 1.0.1 myname/sciverse-press
#
# The owner/repo is used to build the download URLs in `latest.json`, so it
# must match where you actually publish the release.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:-$(node -p "require('$ROOT/desktop/package.json').version")}"
# Where the release will be published. Used to build the download URLs inside
# latest.json, so the repo here must match the one you upload to.
REPO="${2:-$(node -p "require('$ROOT/release.config.json').githubRepo")}"
OUT="$ROOT/dist-release/SciversePress-v$VERSION"

echo "==> Version  $VERSION"
echo "==> Repo     $REPO"

rm -rf "$OUT"
mkdir -p "$OUT"

copy() {
  local src="$1" dest="$2"
  if [ -e "$src" ]; then
    cp "$src" "$OUT/$dest"
    echo "  + $dest"
  fi
}

# ---------------------------------------------------------------- desktop ---
LINUX_BUNDLE="$ROOT/desktop/src-tauri/target/release/bundle"
WIN_BUNDLE="$ROOT/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle"

copy "$LINUX_BUNDLE/appimage/Sciverse Press_$VERSION"_amd64.AppImage \
      "SciversePress-v$VERSION-linux-x86_64.AppImage"
copy "$LINUX_BUNDLE/appimage/Sciverse Press_$VERSION"_amd64.AppImage.sig \
      "SciversePress-v$VERSION-linux-x86_64.AppImage.sig"
copy "$LINUX_BUNDLE/deb/Sciverse Press_$VERSION"_amd64.deb \
      "SciversePress-v$VERSION-linux-amd64.deb"
copy "$LINUX_BUNDLE/rpm/Sciverse Press-$VERSION"-1.x86_64.rpm \
      "SciversePress-v$VERSION-linux-x86_64.rpm"
copy "$WIN_BUNDLE/nsis/Sciverse Press_$VERSION"_x64-setup.exe \
      "SciversePress-v$VERSION-windows-x64-setup.exe"
copy "$WIN_BUNDLE/nsis/Sciverse Press_$VERSION"_x64-setup.exe.sig \
      "SciversePress-v$VERSION-windows-x64-setup.exe.sig"
copy "$ROOT/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/app.exe" \
      "SciversePress-v$VERSION-windows-x64.exe"

# ----------------------------------------------------------------- mobile ---
copy "$ROOT/mobile/android/app/build/outputs/apk/release/app-release.apk" \
      "SciversePress-v$VERSION-android.apk"

# ---------------------------------------------------------------- manifest ---
echo "==> Writing the update manifest"
node "$ROOT/scripts/make-updater-manifest.mjs" "$OUT" "$VERSION" "$OUT" \
  --base-url "https://github.com/$REPO/releases/download/v$VERSION"

# The endpoint baked into the app must match where we are publishing, or the
# installed app will poll the wrong URL and never see this release.
BAKED=$(node -p "require('$ROOT/desktop/src-tauri/tauri.conf.json').plugins.updater.endpoints[0]" 2>/dev/null || echo "")
if ! printf '%s' "$BAKED" | grep -q "$REPO"; then
  echo
  echo "!! WARNING: the update endpoint baked into the app does not match this repo."
  echo "   app      : $BAKED"
  echo "   release  : https://github.com/$REPO/releases/download/v$VERSION"
  echo
  echo "   Update desktop/src-tauri/tauri.conf.json -> plugins.updater.endpoints[0]"
  echo "   to point at $REPO, then rebuild the desktop app."
  echo "   Installed copies will keep polling the old URL until they are rebuilt."
fi

# -------------------------------------------------------------- checksums ---
echo "==> Checksums"
(cd "$OUT" && sha256sum ./* 2>/dev/null | grep -v "SHA256SUMS" > SHA256SUMS.txt)
cat "$OUT/SHA256SUMS.txt"

# ------------------------------------------------------------------ readme ---
cat > "$OUT/README.md" <<EOF
# Sciverse Press v$VERSION

Release artefacts for the Sciverse Summit Press & Committee Management
Platform. Upload every file in this folder to a GitHub release tagged
\`v$VERSION\`.

## Installers

| File | Platform | How to install |
|---|---|---|
| \`SciversePress-v$VERSION-linux-x86_64.AppImage\` | Linux x64 | \`chmod +x\` then run it — no install needed |
| \`SciversePress-v$VERSION-linux-amd64.deb\` | Debian / Ubuntu | \`sudo dpkg -i <file>\` |
| \`SciversePress-v$VERSION-linux-x86_64.rpm\` | Fedora / RHEL | \`sudo rpm -i <file>\` |
| \`SciversePress-v$VERSION-windows-x64-setup.exe\` | Windows x64 | run the installer |
| \`SciversePress-v$VERSION-windows-x64.exe\` | Windows x64 | portable — run it directly, no install |
| \`SciversePress-v$VERSION-android.apk\` | Android | \`adb install <file>\` |

## Auto-update

\`latest.json\` is the manifest the installed app polls. The \`.sig\` files
are minisign signatures the app checks before installing anything — an
unsigned or modified download is rejected.

| File | Purpose |
|---|---|
| \`latest.json\` | update manifest (version + per-platform URL and signature) |
| \`*.AppImage.sig\` | signature of the Linux updater artefact |
| \`*-setup.exe.sig\` | signature of the Windows updater artefact |

Because the manifest is served from the *latest* release, a user who already
has the app installed receives the update without uninstalling anything.

## Checksums

\`SHA256SUMS.txt\` lists the SHA-256 of every file. Verify with:

\`\`\`bash
sha256sum -c SHA256SUMS.txt
\`\`\`
EOF

echo
echo "==> Release folder ready: $OUT"
ls -lh "$OUT"
