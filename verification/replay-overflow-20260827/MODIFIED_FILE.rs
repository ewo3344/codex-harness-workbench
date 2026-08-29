use std::path::Path;

use codex_bridge::{ConcurrentAppServer, MessageKind, classify_message};
use serde_json::{Value, json};

const FAKE_APP_SERVER: &str = r#"
import json
import sys

def receive():
    line = sys.stdin.readline()
    if not line:
        raise EOFError()
    return json.loads(line)

def send(message):
    sys.stdout.write(json.dumps(message, separators=(",", ":")) + "\n")
    sys.stdout.flush()

initialize = receive()
send({"id": initialize["id"], "result": {
    "codexHome": "/fake/.codex",
    "platformFamily": "unix",
    "platformOs": "linux",
    "userAgent": "fake-app-server"
}})
receive() # initialized

first = receive()
second = receive()
send({"method": "turn/started", "params": {"turn": {"id": "turn-1"}}})
send({"id": "approval-1", "method": "item/commandExecution/requestApproval", "params": {
    "threadId": "thread-1", "turnId": "turn-1", "itemId": "item-1"
}})
send({"id": second["id"], "result": {"method": second["method"]}})
send({"id": first["id"], "result": {"method": first["method"]}})

approval = receive()
if approval != {"id": "approval-1", "result": {"decision": "accept"}}:
    raise RuntimeError("unexpected approval response: " + repr(approval))
"#;

const REPLAY_OVERFLOW_APP_SERVER: &str = r#"
import json
import sys

def receive():
    line = sys.stdin.readline()
    if not line:
        raise EOFError()
    return json.loads(line)

def send(message):
    sys.stdout.write(json.dumps(message, separators=(",", ":")) + "\n")
    sys.stdout.flush()

initialize = receive()
send({"id": initialize["id"], "result": {
    "codexHome": "/fake/.codex",
    "platformFamily": "unix",
    "platformOs": "linux",
    "userAgent": "fake-app-server"
}})
receive() # initialized

emit = receive()
for index in range(2049):
    send({"method": "turn/updated", "params": {"index": index}})
send({"id": emit["id"], "result": {"emitted": 2049}})

while sys.stdin.readline():
    pass
"#;

#[tokio::test]
async fn routes_out_of_order_responses_and_replays_interleaved_server_messages() {
    let server =
        ConcurrentAppServer::spawn_command(Path::new("python3"), &["-u", "-c", FAKE_APP_SERVER])
            .await
            .expect("spawn fake app-server");
    server.initialize().await.expect("initialize fake server");

    let (first, second) = tokio::join!(
        server.request("thread/list", json!({})),
        server.request("model/list", json!({})),
    );
    assert_eq!(first.expect("first response")["method"], "thread/list");
    assert_eq!(second.expect("second response")["method"], "model/list");

    let subscription = server.subscribe(0);
    assert!(!subscription.reset_required);
    assert_eq!(subscription.replay.len(), 2);
    assert_eq!(subscription.replay[0].message["method"], "turn/started");
    assert_eq!(
        classify_message(&subscription.replay[1].message),
        MessageKind::ServerRequest
    );
    let approval_id: Value = subscription.replay[1].message["id"].clone();
    server
        .respond(approval_id, json!({"decision": "accept"}))
        .await
        .expect("respond to approval");

    server.shutdown().await.expect("shutdown fake server");
}

#[tokio::test]
async fn default_replay_buffer_requires_reset_after_2048_events() {
    let server = ConcurrentAppServer::spawn_command(
        Path::new("python3"),
        &["-u", "-c", REPLAY_OVERFLOW_APP_SERVER],
    )
    .await
    .expect("spawn overflow app-server");
    server
        .initialize()
        .await
        .expect("initialize overflow app-server");

    let emitted = server
        .request("test/emit-replay-overflow", json!({}))
        .await
        .expect("emit replay events");
    assert_eq!(emitted, json!({"emitted": 2049}));

    let stale = server.subscribe(0);
    assert!(stale.reset_required);
    assert_eq!(stale.latest_sequence, 2049);
    assert_eq!(stale.replay.len(), 2048);
    assert_eq!(stale.replay[0].sequence, 2);
    assert_eq!(stale.replay[0].message["params"]["index"], 1);
    assert_eq!(stale.replay[2047].sequence, 2049);
    assert_eq!(stale.replay[2047].message["params"]["index"], 2048);

    let at_window_start = server.subscribe(1);
    assert!(!at_window_start.reset_required);
    assert_eq!(at_window_start.replay.len(), 2048);
    assert_eq!(at_window_start.replay[0].sequence, 2);

    server
        .shutdown()
        .await
        .expect("shutdown overflow app-server");
}
