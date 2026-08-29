#!/bin/sh
set -eu

artifact_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
target=${1:-/home/e/workspace/codex-remote-workbench/upstream/paseo/packages/app/maestro/test-provider-forms-android.sh}

mkdir -p "$(dirname "$target")"
cp "$artifact_dir/original/test-provider-forms-android.before-cancel-check.sh" "$target"
