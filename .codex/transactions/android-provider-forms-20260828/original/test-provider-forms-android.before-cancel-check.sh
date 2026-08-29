#!/usr/bin/env bash
# Android Maestro harness for the shared Settings > Providers form surface.
#
# The harness starts a daemon in a fresh temporary PASEO_HOME and never calls
# the worktree dev scripts, so it cannot reuse the developer's .paseo-dev or
# .dev/paseo-home state. The Android app reaches that daemon through adb reverse.
#
# Usage:
#   bash packages/app/maestro/test-provider-forms-android.sh
#
# Optional environment:
#   PASEO_MAESTRO_APP_ID=sh.paseo.debug
#   PASEO_MAESTRO_SERIAL=<adb serial>
#   PASEO_MAESTRO_PORT=<host port>
#   PASEO_MAESTRO_ARTIFACTS_DIR=/tmp/paseo-provider-forms-android-run
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
FLOW_TEMPLATE="$REPO_ROOT/packages/app/maestro/provider-forms-android.yaml"
FLOW_TEMPLATE_DIR="$REPO_ROOT/packages/app/maestro/flows"
CLIENT_EXPORTS="$REPO_ROOT/packages/client/dist/daemon-client.js"
SERVER_RUNNER="$REPO_ROOT/packages/server/dist/scripts/supervisor-entrypoint.js"
OUT_DIR="${PASEO_MAESTRO_ARTIFACTS_DIR:-$(mktemp -d /tmp/paseo-provider-forms-android-XXXXXX)}"
PASEO_HOME="$OUT_DIR/paseo-home"
DAEMON_PID=""
LOGCAT_PID=""
PORT_REVERSED=0
ADB=(adb)

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

choose_port() {
  node --input-type=module <<'NODE'
import net from "node:net";

const server = net.createServer();
server.unref();
server.listen({ host: "127.0.0.1", port: 0 }, () => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to allocate a local TCP port");
  }
  process.stdout.write(String(address.port));
  server.close();
});
NODE
}

render_flow() {
  local source="$1"
  local target="$2"
  mkdir -p "$(dirname "$target")"
  perl -0pe '
    s/\$\{PASEO_MAESTRO_APP_ID\}/$ENV{PASEO_MAESTRO_APP_ID}/g;
    s/\$\{PASEO_MAESTRO_DIRECT_ENDPOINT\}/$ENV{PASEO_MAESTRO_DIRECT_ENDPOINT}/g;
  ' "$source" > "$target"
}

cleanup() {
  if [ -n "$LOGCAT_PID" ]; then
    kill "$LOGCAT_PID" >/dev/null 2>&1 || true
  fi
  if [ "$PORT_REVERSED" -eq 1 ]; then
    "${ADB[@]}" reverse --remove "tcp:${PASEO_MAESTRO_PORT}" >/dev/null 2>&1 || true
  fi
  if [ -n "$DAEMON_PID" ]; then
    kill -TERM "$DAEMON_PID" >/dev/null 2>&1 || true
    wait "$DAEMON_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

if [ "${1:-}" = "--check" ]; then
  require_command node
  node "$REPO_ROOT/packages/app/maestro/check-provider-forms-android.mjs"
  exit 0
fi
if [ "$#" -ne 0 ]; then
  echo "Usage: $0 [--check]" >&2
  exit 2
fi

require_command adb
require_command curl
require_command maestro
require_command node
require_command perl
require_command npx

if [ ! -f "$CLIENT_EXPORTS" ] || [ ! -f "$SERVER_RUNNER" ]; then
  echo "Missing packaged daemon artifacts. Run: npm run build:server" >&2
  exit 1
fi

if [ -z "${PASEO_MAESTRO_PORT:-}" ]; then
  export PASEO_MAESTRO_PORT="$(choose_port)"
fi
if ! [[ "$PASEO_MAESTRO_PORT" =~ ^[0-9]+$ ]]; then
  echo "PASEO_MAESTRO_PORT must be a numeric TCP port" >&2
  exit 1
fi

export PASEO_MAESTRO_APP_ID="${PASEO_MAESTRO_APP_ID:-sh.paseo.debug}"
export PASEO_MAESTRO_DIRECT_ENDPOINT="127.0.0.1:${PASEO_MAESTRO_PORT}"

if [ -n "${PASEO_MAESTRO_SERIAL:-}" ]; then
  ADB+=(-s "$PASEO_MAESTRO_SERIAL")
fi

if ! "${ADB[@]}" get-state 2>/dev/null | grep -qx "device"; then
  echo "No usable Android device. Set PASEO_MAESTRO_SERIAL when more than one device is attached." >&2
  exit 1
fi

mkdir -p "$OUT_DIR" "$PASEO_HOME"
FLOW="$OUT_DIR/provider-forms-android.rendered.yaml"
render_flow "$FLOW_TEMPLATE" "$FLOW"
render_flow "$FLOW_TEMPLATE_DIR/android-dev-client.yaml" "$OUT_DIR/flows/android-dev-client.yaml"
render_flow "$FLOW_TEMPLATE_DIR/connect-direct-if-welcome.yaml" "$OUT_DIR/flows/connect-direct-if-welcome.yaml"

echo "=== Android Provider Forms Harness ==="
echo "Artifacts: $OUT_DIR"
echo "Isolated PASEO_HOME: $PASEO_HOME"
echo "Android direct endpoint: $PASEO_MAESTRO_DIRECT_ENDPOINT"
echo "App id: $PASEO_MAESTRO_APP_ID"

echo "Starting isolated daemon..."
PASEO_HOME="$PASEO_HOME" \
PASEO_LISTEN="$PASEO_MAESTRO_DIRECT_ENDPOINT" \
PASEO_RELAY_ENABLED=false \
PASEO_LOCAL_SPEECH_AUTO_DOWNLOAD=0 \
PASEO_DICTATION_ENABLED=0 \
PASEO_VOICE_MODE_ENABLED=0 \
CI=true \
npx paseo daemon start --home "$PASEO_HOME" --port "$PASEO_MAESTRO_PORT" --foreground --no-relay --no-mcp --no-inject-mcp \
  >"$OUT_DIR/daemon.log" 2>&1 &
DAEMON_PID="$!"

for _ in $(seq 1 150); do
  if curl --fail --silent --show-error --max-time 1 \
    "http://127.0.0.1:${PASEO_MAESTRO_PORT}/api/health" >"$OUT_DIR/health.json"; then
    break
  fi
  sleep 0.2
done
if ! grep -q '"ok"' "$OUT_DIR/health.json" 2>/dev/null; then
  echo "Isolated daemon did not become healthy. Log: $OUT_DIR/daemon.log" >&2
  exit 1
fi

echo "Preparing Android port reverse..."
"${ADB[@]}" reverse "tcp:${PASEO_MAESTRO_PORT}" "tcp:${PASEO_MAESTRO_PORT}" >/dev/null
PORT_REVERSED=1

echo "Capturing Android logcat..."
"${ADB[@]}" logcat -c || true
"${ADB[@]}" logcat -v time >"$OUT_DIR/logcat.txt" &
LOGCAT_PID="$!"

echo "Running Maestro provider form flow..."
MAESTRO_ARGS=(test "$FLOW")
if [ -n "${PASEO_MAESTRO_SERIAL:-}" ]; then
  MAESTRO_ARGS+=(--udid "$PASEO_MAESTRO_SERIAL")
fi
set +e
(cd "$OUT_DIR" && maestro "${MAESTRO_ARGS[@]}") 2>&1 | tee "$OUT_DIR/maestro.log"
MAESTRO_STATUS=${PIPESTATUS[0]}
set -e

if [ "$MAESTRO_STATUS" -ne 0 ]; then
  "${ADB[@]}" exec-out screencap -p >"$OUT_DIR/failure-state.png" 2>/dev/null || true
  echo "Maestro failed. Artifacts: $OUT_DIR" >&2
  exit "$MAESTRO_STATUS"
fi

"${ADB[@]}" exec-out screencap -p >"$OUT_DIR/final-state.png" 2>/dev/null || true
echo "PASS: Android provider list and OpenAI-compatible, Anthropic-compatible, and ACP forms are reachable."

echo "Artifacts: $OUT_DIR"
