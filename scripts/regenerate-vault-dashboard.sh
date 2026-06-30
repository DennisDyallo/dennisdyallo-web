#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d "$HOME/Documents/Sunthings_AppStorage_EU_e2e" ]; then
  echo "Vault not found at $HOME/Documents/Sunthings_AppStorage_EU_e2e" >&2
  exit 1
fi

./deploy.sh
