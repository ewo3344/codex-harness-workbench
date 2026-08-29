#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target="${1:-$root/rollback-test-copy/MODIFIED_FILE}"

mkdir -p "$(dirname "$target")"
cp "$root/BASELINE_FILE" "$target"
cmp -s "$root/BASELINE_FILE" "$target"
printf 'ROLLBACK_OK: %s restored from BASELINE_FILE\n' "$target"
