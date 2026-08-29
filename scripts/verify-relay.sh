#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
paseo_dir="${project_dir}/upstream/paseo"

command -v node >/dev/null || {
  echo "node is required" >&2
  exit 1
}

node_version="$(node --version)"
node_major="${node_version#v}"
node_major="${node_major%%.*}"
if [[ ! "${node_major}" =~ ^[0-9]+$ ]] || ((node_major < 22)); then
  echo "Node.js 22 or newer is required by the pinned Wrangler relay tests; found ${node_version}" >&2
  exit 1
fi

if [[ ! -x "${paseo_dir}/node_modules/.bin/vitest" ]] || \
  [[ ! -x "${paseo_dir}/node_modules/.bin/wrangler" ]]; then
  echo "the pinned Paseo relay test dependencies are not installed" >&2
  echo "run: cd ${paseo_dir} && npm install" >&2
  exit 1
fi

cd "${paseo_dir}"

# Node 25+ skips these E2E suites by default. Each suite creates its own
# temporary daemon home, work directory, local Wrangler relay, and ports.
export FORCE_RELAY_E2E=1

echo "Running isolated Paseo relay crypto E2E..."
./node_modules/.bin/vitest run packages/relay/src/e2e.test.ts --maxWorkers=1

echo "Running isolated Paseo daemon pairing-offer relay E2E..."
./node_modules/.bin/vitest run packages/cli/tests/e2e/relay-host.test.ts --maxWorkers=1

echo "Running isolated Paseo daemon E2EE reconnect and timeline replay E2E..."
./node_modules/.bin/vitest run \
  packages/server/src/server/daemon-e2e/relay-transport.e2e.test.ts \
  -t "E2EE relay client reconnects" \
  --maxWorkers=1

echo "Running isolated Paseo daemon E2EE terminal stream E2E..."
./node_modules/.bin/vitest run \
  packages/server/src/server/daemon-e2e/relay-transport.e2e.test.ts \
  -t "E2EE relay client creates" \
  --maxWorkers=1
