use std::path::Path;

use codex_bridge::{ConcurrentAppServer, HarnessApi, ThreadStartOptions};
use serde_json::json;

#[tokio::test]
#[ignore = "requires the installed Codex CLI and local account state"]
async fn real_app_server_initializes_and_serves_account_and_threads() {
    let server = ConcurrentAppServer::spawn(Path::new("codex"))
        .await
        .expect("spawn installed codex app-server");

    let initialized = server.initialize().await.expect("initialize app-server");
    assert_eq!(initialized["platformFamily"], "unix");
    assert!(initialized["codexHome"].as_str().is_some());

    let (account, threads, models) = tokio::join!(
        server.request("account/read", json!({})),
        server.request("thread/list", json!({"limit": 1})),
        server.request("model/list", json!({"limit": 1})),
    );
    let account = account.expect("read account concurrently");
    assert!(account.get("requiresOpenaiAuth").is_some());

    let threads = threads.expect("list threads concurrently");
    assert!(threads["data"].as_array().is_some());

    let models = models.expect("list models concurrently");
    assert!(models["data"].as_array().is_some());

    let harness = HarnessApi::new(&server);
    let started = harness
        .start_thread(&ThreadStartOptions {
            cwd: Some("/tmp".to_string()),
            ephemeral: Some(true),
            ..ThreadStartOptions::default()
        })
        .await
        .expect("start ephemeral thread");
    let thread_id = started["thread"]["id"]
        .as_str()
        .expect("thread/start returns thread id");
    let read = harness
        .read_thread(thread_id, false)
        .await
        .expect("read ephemeral thread");
    assert_eq!(read["thread"]["id"], thread_id);

    server.shutdown().await.expect("shutdown app-server");
}
