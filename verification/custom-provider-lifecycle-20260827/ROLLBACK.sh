#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:?usage: ROLLBACK.sh PATH_TO_DISPOSABLE_MODIFIED_COPY}"

if [[ ! -f "$TARGET" ]]; then
  printf 'ROLLBACK_ERROR: target is not an existing file: %s\n' "$TARGET" >&2
  exit 2
fi

if [[ "$TARGET" -ef "$ROOT/MODIFIED_FILE" || "$TARGET" -ef "$ROOT/BASELINE_FILE" ]]; then
  printf 'ROLLBACK_ERROR: target must be a disposable copy: %s\n' "$TARGET" >&2
  exit 2
fi

modified_sha="$(sha256sum "$ROOT/MODIFIED_FILE" | awk '{print $1}')"
target_sha="$(sha256sum "$TARGET" | awk '{print $1}')"
if [[ "$target_sha" != "$modified_sha" ]]; then
  printf 'ROLLBACK_ERROR: target is not a byte-for-byte MODIFIED_FILE copy: %s\n' "$TARGET" >&2
  exit 3
fi

printf 'ROLLBACK_PRE_SHA256=%s\n' "$target_sha"
cp "$ROOT/BASELINE_FILE" "$TARGET"
cmp -s "$ROOT/BASELINE_FILE" "$TARGET"
printf 'ROLLBACK_POST_SHA256=%s\n' "$(sha256sum "$TARGET" | awk '{print $1}')"
printf 'ROLLBACK_OK: %s restored from BASELINE_FILE\n' "$TARGET"
