#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST_DIR="$ROOT/host"
ADDR="${CRW_ADDR:-127.0.0.1:8787}"
CWD="${CRW_WORKSPACE:-$HOME/workspace}"

if [[ ! -d "$CWD" ]]; then
  CWD="$HOME"
fi

exec go run "$HOST_DIR" --addr "$ADDR" --cwd "$CWD" "$@"
