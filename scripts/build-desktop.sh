#!/usr/bin/env bash
# Build the Sciverse Press desktop app for the CURRENT host OS.
#
#   Linux   -> AppImage + .deb + .rpm
#   Windows -> .exe (NSIS installer)
#   macOS   -> .app + .dmg
#
# Requirements:
#   - Node.js 20+
#   - Rust toolchain: https://rustup.rs
#   - Linux:   webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel
#              build-essential curl wget file libssl-dev
#              (Fedora: dnf install webkit2gtk4.1-devel libappindicator-gtk3-devel
#                        librsvg2-devel openssl-devel nsis)
#   - Windows: nothing extra (MSVC toolchain is auto-installed by cargo-xwin)
#   - macOS:   Xcode Command Line Tools: xcode-select --install
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP="$ROOT/desktop"
VERSION="$(node -p "require('$DESKTOP/package.json').version")"
OUT="$ROOT/dist-desktop"
mkdir -p "$OUT"

if [ ! -d "$DESKTOP/node_modules" ]; then
  echo "==> Installing workspace dependencies"
  (cd "$ROOT" && npm install --workspaces)
fi

echo "==> Building frontend"
(cd "$DESKTOP" && npm run build)

echo "==> Building Tauri app for $(uname -s)"
(cd "$DESKTOP" && npx tauri build)

echo
echo "==> Bundles produced:"
find "$DESKTOP/src-tauri/target/release/bundle" -type f \
  \( -name '*.AppImage' -o -name '*.deb' -o -name '*.rpm' -o -name '*.exe' -o -name '*.msi' -o -name '*.dmg' \) \
  -exec ls -lh {} \;

echo
echo "==> Copying to $OUT"
find "$DESKTOP/src-tauri/target/release/bundle" -type f \
  \( -name '*.AppImage' -o -name '*.deb' -o -name '*.rpm' -o -name '*.exe' -o -name '*.msi' -o -name '*.dmg' \) \
  -exec cp {} "$OUT"/ \;

echo
echo "==> SHA-256 checksums"
(cd "$OUT" && sha256sum ./* 2>/dev/null || true)
