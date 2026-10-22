#!/usr/bin/env bash
# Publish a release to GitHub: create it if needed, upload every asset, and
# make it public.
#
# Usage:
#   scripts/publish-github-release.sh <version> [owner/repo]
#
# The token is read from the environment:
#   export GH_TOKEN=ghp_xxxxxxxxxxxx      (or GITHUB_TOKEN)
#
# It needs `contents: write` on the repository.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:-$(node -p "require('$ROOT/desktop/package.json').version")}"
REPO="${2:-$(node -p "require('$ROOT/release.config.json').githubRepo")}"
TAG="v$VERSION"
FOLDER="$ROOT/dist-release/SciversePress-v$VERSION"

TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [ -z "$TOKEN" ]; then
  echo "!! No token found. Export one first:"
  echo "     export GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx"
  echo "   Create one at: https://github.com/settings/tokens"
  echo "   Scope: 'Contents: Read and write' on $REPO"
  exit 1
fi

[ -d "$FOLDER" ] || { echo "!! $FOLDER does not exist — run scripts/make-release-folder.sh first."; exit 1; }

API="https://api.github.com/repos/$REPO"
AUTH=(-H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json")

echo "==> Repository  $REPO"
echo "==> Tag         $TAG"
echo "==> Folder      $FOLDER"

# ------------------------------------------------------------------ checks ---
echo
echo "==> Verifying the release folder"
PUB=$(node -p "require('$ROOT/desktop/src-tauri/tauri.conf.json').plugins.updater.pubkey")
node "$ROOT/scripts/verify-release-folder.mjs" "$FOLDER" "$PUB" | tail -3

# ------------------------------------------------------------------ upload ---
echo
echo "==> Finding or creating the release"
RELEASE_ID=$(curl -s "${AUTH[@]}" "$API/releases/tags/$TAG" | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  try { const j=JSON.parse(s); console.log(j.id ?? ''); } catch { console.log(''); }
});")
if [ -z "$RELEASE_ID" ]; then
  echo "    creating a new draft release"
  RELEASE_ID=$(curl -s -X POST "${AUTH[@]}" "$API/releases" \
    -d "{\"tag_name\":\"$TAG\",\"name\":\"Sciverse Press $TAG\",\"body\":\"See README.md for what each file is.\",\"draft\":true}" \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).id ?? '')}catch{console.log('')}})")
else
  echo "    found existing release id $RELEASE_ID"
fi
[ -n "$RELEASE_ID" ] || { echo "!! Could not create or find the release."; exit 1; }

# Remove any asset with the same name (so re-runs replace rather than fail).
UPLOAD_URL=$(curl -s "${AUTH[@]}" "$API/releases/$RELEASE_ID" | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).upload_url)}catch{console.log('')}})")
# The upload_url carries a URI template suffix — strip it before appending ?name=
UPLOAD_BASE="${UPLOAD_URL%\{*\}}"
[ -n "$UPLOAD_BASE" ] || { echo "!! Could not read the upload URL."; exit 1; }

echo
echo "==> Uploading assets"
for f in "$FOLDER"/*; do
  name="$(basename "$f")"
  [ -f "$f" ] || continue
  existing=$(curl -s "${AUTH[@]}" "$API/releases/$RELEASE_ID/assets" | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  try {
    const a=JSON.parse(s).find(x=>x.name===process.argv[1]);
    console.log(a?a.id:'');
  } catch { console.log(''); }
});" "$name")
  if [ -n "$existing" ]; then
    echo "    replacing $name"
    curl -s -o /dev/null -X DELETE "${AUTH[@]}" "$API/releases/assets/$existing"
  fi
  # GitHub's asset endpoint stores the request body verbatim — it does not
  # parse multipart forms here. Send the raw bytes and name the asset with
  # the ?name= query parameter, otherwise the multipart envelope ends up
  # inside the published file.
  code=$(curl -s --max-time 900 -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/octet-stream" \
    --data-binary "@$f" \
    "$UPLOAD_BASE?name=$name")
  if [ "$code" = "201" ]; then
    echo "    + $name"
  else
    echo "    ! $name -> HTTP $code"
    exit 1
  fi
done

# ----------------------------------------------------------------- publish ---
echo
echo "==> Publishing the release"
curl -s -o /dev/null -X PATCH "${AUTH[@]}" "$API/releases/$RELEASE_ID" \
  -d '{"draft":false,"prerelease":false}'

echo
echo "==> Done"
curl -s "${AUTH[@]}" "$API/releases/$RELEASE_ID" | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  const r=JSON.parse(s);
  console.log('  url      :', r.html_url);
  console.log('  tag      :', r.tag_name);
  console.log('  draft    :', r.draft);
  console.log('  assets   :', (r.assets||[]).length);
  for (const a of r.assets||[]) console.log('    -', a.name, '(' + Math.round(a.size/1048576*10)/10 + ' MB)');
});"
