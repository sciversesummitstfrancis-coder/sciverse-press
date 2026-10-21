#!/usr/bin/env bash
# Point the release at your GitHub repository.
#
# Updates:
#   * release.config.json                     -> githubRepo
#   * desktop/src-tauri/tauri.conf.json       -> plugins.updater.endpoints[0]
#
# Usage: scripts/set-release-repo.sh owner/repo
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="${1:-}"
[ -n "$REPO" ] || { echo "usage: $0 owner/repo"; exit 2; }
case "$REPO" in
  */*) ;;
  *) echo "The repository must be in the form owner/repo"; exit 2 ;;
esac

# release.config.json
node -e "
const fs=require('fs');
const p='$ROOT/release.config.json';
const c=JSON.parse(fs.readFileSync(p,'utf8'));
c.githubRepo='$REPO';
c.homepage='https://github.com/$REPO';
c.supportUrl='https://github.com/$REPO/issues';
fs.writeFileSync(p, JSON.stringify(c,null,2)+'\n');
console.log('release.config.json -> '+c.githubRepo);
"

# tauri.conf.json (the endpoint baked into the shipped app)
node -e "
const fs=require('fs');
const p='$ROOT/desktop/src-tauri/tauri.conf.json';
const c=JSON.parse(fs.readFileSync(p,'utf8'));
c.plugins.updater.endpoints=[
  'https://github.com/$REPO/releases/latest/download/latest.json'
];
fs.writeFileSync(p, JSON.stringify(c,null,2)+'\n');
console.log('tauri.conf.json    -> '+c.plugins.updater.endpoints[0]);
"

echo
echo "Done. Now:"
echo "  1. Rebuild the desktop app so the new endpoint is baked in:"
echo "       cd desktop && npx tauri build"
echo "  2. Regenerate the release folder:"
echo "       scripts/make-release-folder.sh"
