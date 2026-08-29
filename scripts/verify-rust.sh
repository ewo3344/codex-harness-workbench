#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_dir}"

# Do not use `cargo fmt --all`: pi-walker is a path dependency backed by the
# pinned OMP workspace, and --all would recursively format upstream sources.
cargo fmt --package codex-bridge --package omp-primitives -- --check
cargo test --locked --workspace
cargo test --locked -p omp-primitives --features omp-walker

if [[ "${CHW_REAL_CODEX_TESTS:-0}" == "1" ]]; then
  cargo test --locked -p codex-bridge --test app_server_smoke -- --ignored --nocapture
  cargo test --locked -p codex-bridge --test desktop_discovery -- --ignored --nocapture
  cargo test --locked -p codex-bridge --test approval_flow -- --ignored --nocapture
  cargo test --locked -p codex-bridge --test thread_lifecycle -- --ignored --nocapture
  cargo test --locked -p codex-bridge --test turn_control -- \
    --ignored --nocapture --test-threads=1
fi
