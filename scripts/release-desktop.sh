#!/usr/bin/env bash
# Build, sign and publish a desktop update.
#
# Produces the three artefacts the Tauri updater needs:
#   * Linux   -> AppImage + .tar.gz  (updater artifact)
#   * Windows -> NSIS installer + .nsis.zip (updater artifact)
#   * macOS   -> .app.tar.gz          (updater artifact)
#
# and writes `latest.json`, the static manifest the app polls. Upload that
# file and the artefacts to the GitHub release and every installed copy
# picks the update up on its next check — no uninstall required.
#
# Requirements:
#   - Rust toolchain, Node 20+
#   - The updater signing key (see docs/DESKTOP_BUILD.md)
#   - TAURI_SIGNING_PRIVATE_KEY / TAURI_SIGNING_PRIVATE_KEY_PASSWORD exported
#     (or TAURI_SIGNING_PRIVATE_KEY_PATH pointing at the key file)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP="$ROOT/desktop"
VERSION="${1:-$(node -p "require('$DESKTOP/package.json').version")}"
OUT="$ROOT/dist-desktop"
RELEASE="$OUT/release"

echo "==> Version $VERSION"

# ---------------------------------------------------------------- signing ---
if [ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ] && [ -z "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" ]; then
  KEY="${TAURI_SIGNING_KEY_PATH:-$HOME/.tauri/sciverse-updater.key}"
  if [ -f "$KEY" ]; then
    export TAURI_SIGNING_PRIVATE_KEY_PATH="$KEY"
    echo "==> Using signing key $KEY"
  else
    echo "!! No updater signing key found."
    echo "   Generate one with:"
    echo "     npx tauri signer generate -w ~/.tauri/sciverse-updater.key"
    echo "   then set TAURI_SIGNING_PRIVATE_KEY_PATH (or TAURI_SIGNING_PRIVATE_KEY)."
    exit 1
  fi
fi

# The bundler reads the key *contents* from TAURI_SIGNING_PRIVATE_KEY, while
# the `signer sign` command reads the path. Provide both so either works.
if [ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ] && [ -n "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" ]; then
  TAURI_SIGNING_PRIVATE_KEY="$(cat "$TAURI_SIGNING_PRIVATE_KEY_PATH")"
  export TAURI_SIGNING_PRIVATE_KEY
fi

mkdir -p "$RELEASE"
rm -f "$RELEASE"/latest.json

# ------------------------------------------------------------------ build ---
build_platform() {
  local label="$1"; shift
  echo "==> Building $label"
  (cd "$DESKTOP" && npx tauri build "$@") || {
    echo "!! $label build failed — continuing so the other platforms still publish." >&2
    return 0
  }
}

# Linux (AppImage + deb + rpm). The v2 updater artefact is the AppImage itself.
build_platform "Linux" --bundles appimage,deb,rpm

# Windows (NSIS). The v2 updater artefact is the installer in nsis-updater/.
build_platform "Windows" --target x86_64-pc-windows-msvc --runner cargo-xwin --bundles nsis

# macOS must be built on macOS — run this script from a Mac for the .app.
if [ "$(uname -s)" = "Darwin" ]; then
  build_platform "macOS" --target universal-apple-darwin --bundles app,dmg
fi

# --------------------------------------------------------------- collect ---
echo "==> Collecting updater artefacts"
BUNDLE="$DESKTOP/src-tauri/target/release/bundle"
WIN_BUNDLE="$DESKTOP/src-tauri/target/x86_64-pc-windows-msvc/release/bundle"

collect() {
  local src="$1"
  [ -e "$src" ] || return 0
  cp "$src" "$RELEASE"/ 2>/dev/null || true
  [ -e "$src.sig" ] && cp "$src.sig" "$RELEASE"/ 2>/dev/null || true
  echo "  + $(basename "$src")"
}

# Linux: the signed AppImage.
for f in "$BUNDLE"/appimage/*.AppImage; do
  [ -e "$f" ] && collect "$f"
done
# Windows: the signed NSIS installer (the updater runs it directly).
for f in "$WIN_BUNDLE"/nsis-updater/*.exe "$WIN_BUNDLE"/nsis/*.exe; do
  [ -e "$f" ] && collect "$f"
done
# macOS: the signed .app.tar.gz.
for f in "$BUNDLE"/macos/*.app.tar.gz; do
  [ -e "$f" ] && collect "$f"
done

# --------------------------------------------------------------- manifest ---
echo "==> Writing the update manifest"
node "$ROOT/scripts/make-updater-manifest.mjs" "$RELEASE" "$VERSION" "$RELEASE"

echo
echo "==> Release contents"
ls -lh "$RELEASE"
echo
echo "==> latest.json"
cat "$RELEASE/latest.json"
echo
echo "Next steps:"
echo "  1. Create a GitHub release tagged v$VERSION"
echo "  2. Upload every file in $RELEASE (including latest.json)"
echo "  3. Installed apps pick it up on their next update check — no reinstall."
