#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$ROOT/rollback-test-copy/MODIFIED_FILE"
cp "$ROOT/BASELINE_FILE" "$TARGET"
cmp -s "$ROOT/BASELINE_FILE" "$TARGET"
printf 'ROLLBACK_OK: %s restored from BASELINE_FILE\n' "$TARGET"
