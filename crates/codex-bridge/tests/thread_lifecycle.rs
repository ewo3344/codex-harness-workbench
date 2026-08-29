use std::fs;
use std::path::Path;
use std::time::Duration;

use codex_bridge::{
    ConcurrentAppServer, HarnessApi, ThreadListOptions, ThreadStartOptions, TurnStartOptions,
};

fn contains_thread(response: &serde_json::Value, thread_id: &str) -> bool {
    response["data"]
        .as_array()
        .is_some_and(|threads| threads.iter().any(|thread| thread["id"] == thread_id))
}

#[tokio::test]
#[ignore = "creates, resumes, forks, archives, unarchives, and deletes real Codex threads"]
async fn real_thread_lifecycle_round_trips_through_app_server() {
    let probe_dir =
        std::env::temp_dir().join(format!("chw-thread-lifecycle-{}", std::process::id()));
    fs::create_dir_all(&probe_dir).expect("create isolated probe directory");
    let cwd = probe_dir.to_string_lossy().into_owned();

    let server = ConcurrentAppServer::spawn(Path::new("codex"))
        .await
        .expect("spawn installed codex app-server");
    server.initialize().await.expect("initialize app-server");
    let harness = HarnessApi::new(&server);

    let started = harness
        .start_thread(&ThreadStartOptions {
            model: Some("gpt-5.6-luna".to_string()),
            cwd: Some(cwd.clone()),
            ephemeral: Some(false),
            ..ThreadStartOptions::default()
        })
        .await
        .expect("start persistent thread");
    let thread_id = started["thread"]["id"]
        .as_str()
        .expect("started thread id")
        .to_string();

    let mut subscription = server.subscribe(0);
    let turn = harness
        .start_turn(&TurnStartOptions::text(
            &thread_id,
            "Reply with exactly THREAD_LIFECYCLE_READY and do not use tools.",
        ))
        .await
        .expect("start materializing turn");
    let turn_id = turn["turn"]["id"]
        .as_str()
        .expect("materializing turn id")
        .to_string();
    tokio::time::timeout(Duration::from_secs(120), async {
        loop {
            let event = subscription
                .live
                .recv()
                .await
                .expect("receive app-server event");
            if event.message["method"] == "turn/completed"
                && event.message["params"]["threadId"] == thread_id
                && event.message["params"]["turn"]["id"] == turn_id
            {
                assert_eq!(event.message["params"]["turn"]["status"], "completed");
                break;
            }
        }
    })
    .await
    .expect("materializing turn completes");

    drop(subscription);
    drop(harness);
    server
        .shutdown()
        .await
        .expect("shutdown first app-server instance");

    let server = ConcurrentAppServer::spawn(Path::new("codex"))
        .await
        .expect("restart installed codex app-server");
    server
        .initialize()
        .await
        .expect("initialize restarted app-server");
    let harness = HarnessApi::new(&server);

    let read = harness
        .read_thread(&thread_id, true)
        .await
        .expect("read persistent thread");
    assert_eq!(read["thread"]["id"], thread_id);

    let resumed = harness
        .resume_thread(&thread_id)
        .await
        .expect("resume persistent thread");
    assert_eq!(resumed["thread"]["id"], thread_id);

    let forked = harness
        .fork_thread(&thread_id, None)
        .await
        .expect("fork persistent thread");
    let fork_id = forked["thread"]["id"]
        .as_str()
        .expect("forked thread id")
        .to_string();
    assert_ne!(fork_id, thread_id);
    assert_eq!(forked["thread"]["forkedFromId"], thread_id);

    let list_options = ThreadListOptions {
        limit: Some(100),
        cwd: Some(cwd.clone()),
        ..ThreadListOptions::default()
    };
    let active = harness
        .list_threads(&list_options)
        .await
        .expect("list active probe threads");
    assert!(contains_thread(&active, &thread_id));
    assert!(contains_thread(&active, &fork_id));

    harness
        .archive_thread(&thread_id)
        .await
        .expect("archive original thread");
    let archived = harness
        .list_threads(&ThreadListOptions {
            archived: Some(true),
            ..list_options.clone()
        })
        .await
        .expect("list archived probe threads");
    assert!(contains_thread(&archived, &thread_id));

    let unarchived = harness
        .unarchive_thread(&thread_id)
        .await
        .expect("unarchive original thread");
    assert_eq!(unarchived["thread"]["id"], thread_id);

    harness
        .delete_thread(&fork_id)
        .await
        .expect("delete forked thread");
    harness
        .delete_thread(&thread_id)
        .await
        .expect("delete original thread");
    let after_delete = harness
        .list_threads(&list_options)
        .await
        .expect("list after deleting probe threads");
    assert!(!contains_thread(&after_delete, &thread_id));
    assert!(!contains_thread(&after_delete, &fork_id));

    server.shutdown().await.expect("shutdown app-server");
    fs::remove_dir_all(&probe_dir).expect("remove isolated probe directory");
}
