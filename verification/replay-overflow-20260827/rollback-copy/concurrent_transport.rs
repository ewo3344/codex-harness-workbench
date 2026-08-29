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
