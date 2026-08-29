#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
COPY_PATH="$ROOT_DIR/rollback-copy/MODIFIED_FILE"

cp "$ROOT_DIR/MODIFIED_FILE" "$COPY_PATH"
patch --silent --reverse "$COPY_PATH" < "$ROOT_DIR/DIFF_FILE"
cmp -s "$COPY_PATH" "$ROOT_DIR/BASELINE_FILE"

echo "ROLLBACK_TEST copy=$COPY_PATH result=PASS restored_hash=$(sha256sum "$COPY_PATH" | awk '{print $1}')"
