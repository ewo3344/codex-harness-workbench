#!/usr/bin/env bash
set -euo pipefail

artifact_dir="$(cd "$(dirname "$0")" && pwd)"
target="${1:?usage: ROLLBACK.sh /path/to/concurrent_transport.rs}"

cp "$artifact_dir/BASELINE_FILE.rs" "$target"
