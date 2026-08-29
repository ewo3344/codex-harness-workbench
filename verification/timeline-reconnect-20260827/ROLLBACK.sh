#!/usr/bin/env bash
set -euo pipefail

artifact_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target="${1:-$artifact_dir/rollback-test-copy/MODIFIED_FILE}"

mkdir -p "$(dirname "$target")"
cp "$artifact_dir/BASELINE_FILE" "$target"
cmp -s "$artifact_dir/BASELINE_FILE" "$target"
printf 'ROLLBACK_OK: %s restored from BASELINE_FILE\n' "$target"
