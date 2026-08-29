#!/bin/sh
set -eu

artifact_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
target_root=${1:-/home/e/workspace/codex-remote-workbench/upstream/paseo}
target_dir="$target_root/packages/app/src/screens/settings"

mkdir -p "$target_dir"
cp "$artifact_dir/original/custom-provider-form.before-metadata.ts" \
  "$target_dir/custom-provider-form.ts"
cp "$artifact_dir/original/custom-provider-form.before-metadata.test.ts" \
  "$target_dir/custom-provider-form.test.ts"
