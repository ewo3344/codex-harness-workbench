#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
paseo_home="${CHW_PASEO_HOME:-${project_dir}/.paseo-dev}"
listen="${CHW_LISTEN:-127.0.0.1:6877}"

command -v codex >/dev/null || {
  echo "codex is required on PATH" >&2
  exit 1
}

local_paseo_cli="${project_dir}/upstream/paseo/packages/cli/bin/paseo"
local_paseo_dist="${project_dir}/upstream/paseo/packages/cli/dist/index.js"
local_server_dist="${project_dir}/upstream/paseo/packages/server/dist/scripts/supervisor-entrypoint.js"
if [[ -n "${CHW_PASEO_CLI:-}" ]]; then
  paseo_command=("${CHW_PASEO_CLI}")
elif [[ "${CHW_USE_GLOBAL_PASEO:-0}" == "1" ]]; then
  command -v paseo >/dev/null || {
    echo "CHW_USE_GLOBAL_PASEO=1 requires paseo on PATH" >&2
    exit 1
  }
  paseo_command=(paseo)
elif [[ -f "${local_paseo_dist}" && -f "${local_server_dist}" ]]; then
  command -v node >/dev/null || {
    echo "node is required to run the pinned Paseo fork" >&2
    exit 1
  }
  paseo_command=(node --disable-warning=DEP0040 "${local_paseo_cli}")
else
  echo "the pinned Paseo fork is not built" >&2
  echo "run: cd ${project_dir}/upstream/paseo && npm install && npm run build:server" >&2
  echo "or explicitly set CHW_USE_GLOBAL_PASEO=1 for the unpatched upstream CLI" >&2
  exit 1
fi

mkdir -p "${paseo_home}"
config_file="${paseo_home}/config.json"
if [[ ! -e "${config_file}" ]]; then
  cp "${project_dir}/config/paseo.dev.json" "${config_file}"
  chmod 600 "${config_file}"
fi

exec "${paseo_command[@]}" start \
  --foreground \
  --no-relay \
  --no-mcp \
  --web-ui \
  --listen "${listen}" \
  --home "${paseo_home}"
