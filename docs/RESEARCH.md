# Local Codex Research

Recorded on 2026-08-22 from this workstation.

## Evidence

| Check | Result |
| --- | --- |
| `codex --version` | `codex-cli 0.149.0` |
| Installed package | `/home/e/.npm-global/lib/node_modules/@openai/codex` |
| Source checkout | `/home/e/.cache/codex/openai-codex-src` |
| Source remote | `https://github.com/openai/codex.git` |
| Source revision | `d75c85f Separate thread settings from environment configuration (#39597)` |
| License | Apache-2.0 (`LICENSE`, README) |
| Desktop/session | KDE on Wayland (`XDG_CURRENT_DESKTOP=KDE`, `XDG_SESSION_TYPE=wayland`) |
| Android toolchain | Java 26, Android SDK `/opt/android-sdk`, API 37.1, `adb` 37.0.0 |

## Relevant upstream commands

The installed CLI exposes:

```text
codex app-server [--listen stdio://|unix://PATH|ws://IP:PORT]
codex remote-control start
codex remote-control pair
codex remote-control stop
codex --remote ws://host:port --remote-auth-token-env ENV
```

The source places the implementation in `codex-rs/app-server-*` and
`codex-rs/cli/src/remote_control_cmd.rs`. The upstream remote-control daemon
uses Codex's app-server protocol and a pairing flow; it is not a generic PTY
multiplexer for arbitrary local processes. The workbench therefore treats it as
an optional Codex-native integration and adds its own narrow, token-authenticated
session API for the requested multi-process desktop/Android workflow.

## Local support assessment

The workstation can run the CLI directly and has a KDE Wayland session suitable
for a browser-based tiled surface. The wrapper passes `--no-alt-screen` by
default so the output remains inspectable in a browser/phone and still accepts
normal terminal input. A real PTY is used for every process, including Codex,
so interactive prompts, control characters, and terminal resize events are
preserved.

