#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-$ROOT/rollback-copy/MODIFIED_FILE}"
mkdir -p "$(dirname "$TARGET")"

# Exercise rollback against a disposable target while preserving the live
# modified fixture for inspection.
cp "$ROOT/MODIFIED_FILE" "$TARGET"
cmp -s "$ROOT/MODIFIED_FILE" "$TARGET"
cp "$ROOT/BASELINE_FILE" "$TARGET"
cmp -s "$ROOT/BASELINE_FILE" "$TARGET"
printf 'ROLLBACK_OK: %s restored from BASELINE_FILE\n' "$TARGET"
