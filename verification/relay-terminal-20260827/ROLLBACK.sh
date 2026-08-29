#!/usr/bin/env bash
set -euo pipefail

artifact_dir="$(cd "$(dirname "$0")" && pwd)"
target="${1:?usage: ROLLBACK.sh /path/to/relay-transport.e2e.test.ts}"

cp "$artifact_dir/BASELINE_FILE.ts" "$target"
