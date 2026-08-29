# E2EE Relay Validation

Last updated: 2026-08-27.

## Purpose

This verification proves the local relay transport baseline without changing the
normal development daemon. It starts a local Wrangler Durable Object relay on a
random loopback port, creates temporary daemon and workspace directories, and
removes its child processes on completion.

It covers:

- Relay cryptography and encrypted frame exchange.
- Daemon relay registration using a generated pairing offer.
- An E2EE client connection through the offer URL.
- E2EE `DaemonClient` reconnect after a real socket termination, with committed
  timeline cursor catch-up and exactly-once provisional live delivery.
- E2EE terminal creation, subscription, input/output streaming, resize, and
  termination through the relay.
- Relay `paseo ls --json` output matching the direct daemon connection.

The script does not run a mobile device. A separate Android observation is
recorded below; the observation and local reconnect test do not prove QR camera
behavior, manually entered codes, multi-device pairing, full chat delivery,
network switching, replay overflow recovery, iOS pairing, or hosted TLS relay
deployment. Those remain Stage 2 device-acceptance work.

## Run

From the repository root:

```bash
./scripts/verify-relay.sh
```

The script runs these commands from `upstream/paseo`:

```bash
FORCE_RELAY_E2E=1 ./node_modules/.bin/vitest run packages/relay/src/e2e.test.ts --maxWorkers=1
FORCE_RELAY_E2E=1 ./node_modules/.bin/vitest run packages/cli/tests/e2e/relay-host.test.ts --maxWorkers=1
FORCE_RELAY_E2E=1 ./node_modules/.bin/vitest run packages/server/src/server/daemon-e2e/relay-transport.e2e.test.ts --maxWorkers=1 -t "E2EE relay client reconnects"
FORCE_RELAY_E2E=1 ./node_modules/.bin/vitest run packages/server/src/server/daemon-e2e/relay-transport.e2e.test.ts --maxWorkers=1 -t "E2EE relay client creates"
```

The reconnect case starts its own local Wrangler relay and captures the
`DaemonClient` WebSocket factory. It terminates the first client socket, appends
one committed row while disconnected, then checks `direction: "after"` from the
saved cursor. It asserts `reset: false`, `staleCursor: false`, and `gap: false`.
After reconnect it resubscribes and verifies that the provisional event from
before the disconnect and a new live timeline event are each delivered exactly
once; both retain the epoch and omit a committed sequence number. This is a
Paseo timeline contract, separate from the Rust bridge's `reset_required`
overflow signal.

`FORCE_RELAY_E2E=1` is required on Node 25 and later because Paseo guards the
local Wrangler suites by default on those versions.

The terminal case creates a deterministic Node echo process, subscribes, and
waits for the initial snapshot before writing a carriage-return-terminated input
line. Waiting for the snapshot ensures the following output is a live encrypted
binary frame instead of being folded into an in-flight initial snapshot. It then
sends a binary resize frame and checks the daemon terminal state before
terminating the process and observing its exit event. It validates the relay
terminal transport, not a mobile terminal UI.

## Isolation Contract

The regular entry point, `scripts/start-harness-workbench.sh`, intentionally
keeps relay disabled. It continues to use `.paseo-dev`, loopback port `6877`,
and `--no-relay` for everyday development.

The relay suites instead provide their own temporary `PASEO_HOME`, temporary
working directory, `PASEO_RELAY_ENABLED=true`, and local relay endpoint. Do
not enable relay in `config/paseo.dev.json` merely to run this verification.

## Prerequisites

Install the pinned Paseo workspace dependencies once:

```bash
cd upstream/paseo
npm install
```

The wrapper checks for the local Vitest and Wrangler binaries before running.

## Android Device Observation

The Android acceptance run used a USB-connected Android 16 device and the
`sh.paseo.debug` 0.5.0 Debug APK. The APK was built with Android SDK tools and
Java 17, then connected to an isolated daemon with relay enabled; the normal
development daemon remained on `.paseo-dev`, loopback port `6877`, and
`--no-relay`.

The device persisted its relay endpoint, daemon public key, and server id. The
isolated daemon logged relay `hello`, `helloResumed`, and the device control
requests `fetch_agents`, `project.list`, `fetch_workspaces`, and
`client_heartbeat`. After a relay socket disconnect, the same session resumed
within about 12 seconds and inside the 90-second reconnect grace window. The
device also created and received projections for a project and workspace.

In a later recovery check, the local relay worker was absent while the device
was cold-started. Android restored its cached workspace route and waited for
the saved relay host. After the isolated worker returned, the daemon restored
its control and data channels, Android sent a new relay `hello`, and the app
rendered the existing agent and its timeline. The observed provider result was
an inbound `502` error, so this confirms timeline recovery rather than a
successful assistant response or Android-originated send. Pairing offer
contents are intentionally not recorded.
