#!/usr/bin/env bash
set -euo pipefail

artifact_dir="$(cd "$(dirname "$0")" && pwd)"
target_dir="${1:?usage: ROLLBACK.sh /path/to/settings-directory}"

cp "$artifact_dir/BASELINE/providers-section.tsx" "$target_dir/providers-section.tsx"
cp "$artifact_dir/BASELINE/providers-section.test.tsx" "$target_dir/providers-section.test.tsx"
