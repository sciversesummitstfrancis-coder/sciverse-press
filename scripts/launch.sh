#!/usr/bin/env bash
# Launch backend + desktop for Fedora development.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
set -a; [ -f "$ROOT/.env" ] && . "$ROOT/.env"; set +a
export PORT="${PORT:-4000}"
(cd "$ROOT/shared" && npm install --no-audit --no-fund && npm run build)
(cd "$ROOT/backend" && npm install --no-audit --no-fund && npm run build)
(cd "$ROOT/backend" && npm run seed || true)
(node "$ROOT/backend/dist/server.js" & echo $! > /tmp/sp-backend.pid)
(cd "$ROOT/desktop" && npm install --no-audit --no-fund && npm run dev -- --host)
