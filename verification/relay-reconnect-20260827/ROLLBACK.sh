#!/usr/bin/env bash
set -euo pipefail

artifact_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target_dir="${1:-${artifact_dir}/rollback-tree}"
target_file="${target_dir}/relay-transport.e2e.test.ts"

mkdir -p "${target_dir}"
cp "${artifact_dir}/baseline-tree/relay-transport.e2e.test.ts" "${target_file}"
sha256sum "${target_file}"
