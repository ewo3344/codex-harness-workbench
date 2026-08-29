use std::fs;
use std::path::Path;
use std::time::Duration;

use codex_bridge::{
    ApprovalPolicy, ConcurrentAppServer, HarnessApi, MessageKind, SandboxMode, ThreadStartOptions,
    TurnStartOptions, classify_message,
};
use serde_json::json;

#[tokio::test]
#[ignore = "runs a real Codex model turn and approves one elevated command"]
async fn real_turn_pauses_for_command_approval_and_resumes_after_response() {
    let probe_dir = std::env::temp_dir().join(format!("chw-approval-probe-{}", std::process::id()));
    fs::create_dir_all(&probe_dir).expect("create isolated probe directory");
    let probe_file = probe_dir.join("approval-probe.txt");

    let server = ConcurrentAppServer::spawn(Path::new("codex"))
        .await
        .expect("spawn installed codex app-server");
    server.initialize().await.expect("initialize app-server");
    let harness = HarnessApi::new(&server);
    let thread = harness
        .start_thread(&ThreadStartOptions {
            model: Some("gpt-5.6-luna".to_string()),
            cwd: Some(probe_dir.to_string_lossy().into_owned()),
            approval_policy: Some(ApprovalPolicy::OnRequest),
            sandbox: Some(SandboxMode::ReadOnly),
            ephemeral: Some(true),
            ..ThreadStartOptions::default()
        })
        .await
        .expect("start read-only ephemeral thread");
    let thread_id = thread["thread"]["id"]
        .as_str()
        .expect("thread id")
        .to_string();

    let mut subscription = server.subscribe(0);
    let turn = harness
        .start_turn(&TurnStartOptions::text(
            &thread_id,
            "Use the shell tool to run exactly `touch approval-probe.txt` in the current directory. Do not create the file by any other method. After the command succeeds, reply DONE.",
        ))
        .await
        .expect("start approval probe turn");
    let turn_id = turn["turn"]["id"].as_str().expect("turn id").to_string();

    let mut saw_approval = false;
    let completed = tokio::time::timeout(Duration::from_secs(120), async {
        loop {
            let event = subscription
                .live
                .recv()
                .await
                .expect("receive app-server event");
            let method = event.message["method"].as_str().unwrap_or_default();
            if classify_message(&event.message) == MessageKind::ServerRequest
                && method == "item/commandExecution/requestApproval"
            {
                saw_approval = true;
                server
                    .respond(event.message["id"].clone(), json!({"decision": "accept"}))
                    .await
                    .expect("approve elevated command");
            }
            if method == "turn/completed"
                && event.message["params"]["threadId"] == thread_id
                && event.message["params"]["turn"]["id"] == turn_id
            {
                break event.message;
            }
        }
    })
    .await
    .expect("turn completes after approval");

    assert!(
        saw_approval,
        "read-only write must request command approval"
    );
    assert_eq!(completed["params"]["turn"]["status"], "completed");
    assert!(
        probe_file.exists(),
        "approved command must create probe file"
    );

    server.shutdown().await.expect("shutdown app-server");
    fs::remove_dir_all(&probe_dir).expect("remove isolated probe directory");
}
