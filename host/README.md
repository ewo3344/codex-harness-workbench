# Host daemon

The host keeps one PTY per local development process and exposes the metadata
and terminal stream to the browser and Android client. Commands are passed to
`exec.Command`; no shell interpolation is performed by the daemon.

## Run

```bash
CRW_TOKEN='choose-a-long-token' go run . \
  --addr 0.0.0.0:8787 \
  --cwd /home/e/workspace
```

When `CRW_TOKEN` is omitted, a random token is printed once to stderr. The
browser accepts it through `?token=...` or its connection form. The Android
client sends it as an `Authorization: Bearer` header.

## Session semantics

- Creating a session with an empty `command` starts the configured Codex binary.
- A Codex command automatically receives `--no-alt-screen` unless already
  present, preserving scrollback in the tiled surface.
- `POST /.../:id/stop` terminates a process but keeps its final session record.
- `DELETE /.../:id` terminates and removes the record.
- `output?cursor=N` returns bounded chunks and a cursor. If the cursor fell out
  of the ring buffer, `reset:true` asks clients to replace their local buffer.
- WebSocket clients receive a `snapshot` followed by `output` and `status`
  events; they may send `input`, `resize`, `signal`, or `ping` messages.

The listener can bind on a LAN/public interface, but the deployment URL used by
Android should be HTTPS/WSS through a reverse proxy or private tunnel. The
daemon's bearer token is the application credential; rotate it by restarting
the process with a new `CRW_TOKEN`.

