use std::path::Path;
use std::time::Duration;

use codex_bridge::{
    ApprovalPolicy, ConcurrentAppServer, HarnessApi, SandboxMode, ThreadStartOptions,
    TurnStartOptions, UserInput,
};

#[tokio::test]
#[ignore = "runs a real Codex turn and steers it while active"]
async fn real_active_turn_accepts_steering_input() {
    let server = ConcurrentAppServer::spawn(Path::new("codex"))
        .await
        .expect("spawn installed codex app-server");
    server.initialize().await.expect("initialize app-server");
    let harness = HarnessApi::new(&server);
    let thread = harness
        .start_thread(&ThreadStartOptions {
            model: Some("gpt-5.6-luna".to_string()),
            cwd: Some(std::env::temp_dir().to_string_lossy().into_owned()),
            approval_policy: Some(ApprovalPolicy::Never),
            sandbox: Some(SandboxMode::ReadOnly),
            ephemeral: Some(true),
            ..ThreadStartOptions::default()
        })
        .await
        .expect("start ephemeral steering thread");
    let thread_id = thread["thread"]["id"]
        .as_str()
        .expect("thread id")
        .to_string();

    let mut subscription = server.subscribe(0);
    let turn = harness
        .start_turn(&TurnStartOptions::text(
            &thread_id,
            "Before answering, carefully consider thirty different names for a test marker, then reply ORIGINAL_MARKER.",
        ))
        .await
        .expect("start steerable turn");
    let turn_id = turn["turn"]["id"].as_str().expect("turn id").to_string();
    let steered = harness
        .steer_turn(
            &thread_id,
            &turn_id,
            vec![UserInput::text(
                "Replace the requested answer. Reply exactly STEER_ACCEPTED.",
            )],
        )
        .await
        .expect("steer active turn");
    assert_eq!(steered["turnId"], turn_id);

    let mut answer = String::new();
    let completed = tokio::time::timeout(Duration::from_secs(120), async {
        loop {
            let event = subscription
                .live
                .recv()
                .await
                .expect("receive app-server event");
            let method = event.message["method"].as_str().unwrap_or_default();
            if method == "item/agentMessage/delta"
                && event.message["params"]["threadId"] == thread_id
                && event.message["params"]["turnId"] == turn_id
            {
                answer.push_str(
                    event.message["params"]["delta"]
                        .as_str()
                        .unwrap_or_default(),
                );
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
    .expect("steered turn completes");

    assert_eq!(completed["params"]["turn"]["status"], "completed");
    assert!(
        answer.contains("STEER_ACCEPTED"),
        "agent output must reflect steering input, got {answer:?}"
    );
    server.shutdown().await.expect("shutdown app-server");
}

#[tokio::test]
#[ignore = "starts a real long-running Codex response and immediately interrupts it"]
async fn real_active_turn_can_be_interrupted() {
    let server = ConcurrentAppServer::spawn(Path::new("codex"))
        .await
        .expect("spawn installed codex app-server");
    server.initialize().await.expect("initialize app-server");
    let harness = HarnessApi::new(&server);
    let thread = harness
        .start_thread(&ThreadStartOptions {
            model: Some("gpt-5.6-luna".to_string()),
            cwd: Some(std::env::temp_dir().to_string_lossy().into_owned()),
            approval_policy: Some(ApprovalPolicy::Never),
            sandbox: Some(SandboxMode::ReadOnly),
            ephemeral: Some(true),
            ..ThreadStartOptions::default()
        })
        .await
        .expect("start read-only interrupt thread");
    let thread_id = thread["thread"]["id"]
        .as_str()
        .expect("thread id")
        .to_string();

    let mut subscription = server.subscribe(0);
    let turn = harness
        .start_turn(&TurnStartOptions::text(
            &thread_id,
            "Without using tools, write fifty thousand numbered lines, one line at a time. Do not summarize or stop early.",
        ))
        .await
        .expect("start interrupt probe turn");
    let turn_id = turn["turn"]["id"].as_str().expect("turn id").to_string();
    harness
        .interrupt_turn(&thread_id, &turn_id)
        .await
        .expect("interrupt active turn immediately after start acknowledgement");

    let completed = tokio::time::timeout(Duration::from_secs(120), async {
        loop {
            let event = subscription
                .live
                .recv()
                .await
                .expect("receive app-server event");
            let method = event.message["method"].as_str().unwrap_or_default();
            if method == "turn/completed"
                && event.message["params"]["threadId"] == thread_id
                && event.message["params"]["turn"]["id"] == turn_id
            {
                break event.message;
            }
        }
    })
    .await
    .expect("interrupted turn completes");

    assert_eq!(completed["params"]["turn"]["status"], "interrupted");
    server.shutdown().await.expect("shutdown app-server");
}
