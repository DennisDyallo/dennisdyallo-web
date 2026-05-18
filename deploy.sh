#!/bin/bash
set -euo pipefail

SERVICES_DIR="$HOME/services"
SITE_DIR="$SERVICES_DIR/dyallo-se/site"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Building Astro site..."
cd "$SCRIPT_DIR"
bun run build

echo "==> Deploying to $SITE_DIR..."
mkdir -p "$SITE_DIR"
rsync -av --delete "$SCRIPT_DIR/dist/" "$SITE_DIR/"

echo "==> Reloading Caddy..."
docker exec caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || echo "    (Caddy reload skipped — container not running locally)"

echo "==> Done. Deployed dyallo.se"
ls -lh "$SITE_DIR/index.html"
