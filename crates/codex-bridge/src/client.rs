use std::collections::{HashMap, VecDeque};
use std::path::Path;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result, bail};
use serde::Serialize;
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{broadcast, mpsc, oneshot};
use tokio::task::JoinHandle;

use crate::{MessageKind, classify_message};

const DEFAULT_REPLAY_CAPACITY: usize = 2_048;
const OUTBOUND_CAPACITY: usize = 256;
const LIVE_EVENT_CAPACITY: usize = 1_024;

type PendingResponse = oneshot::Sender<std::result::Result<Value, String>>;

#[derive(Clone, Debug, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppServerCapabilities {
    pub experimental_api: bool,
    pub request_attestation: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp_server_openai_form_elicitation: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opt_out_notification_methods: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extensions: Option<Value>,
}

impl AppServerCapabilities {
    /// Opt into public experimental app-server surfaces used by the Codex
    /// desktop experience, without claiming first-party attestation support.
    pub fn desktop_experimental() -> Self {
        Self {
            experimental_api: true,
            request_attestation: false,
            ..Self::default()
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct SequencedMessage {
    pub sequence: u64,
    pub message: Value,
}

pub struct MessageSubscription {
    pub replay: Vec<SequencedMessage>,
    pub live: broadcast::Receiver<SequencedMessage>,
    /// The requested cursor fell behind the bounded replay window. The client
    /// must refresh its thread projection before consuming live events.
    pub reset_required: bool,
    pub latest_sequence: u64,
}

struct MessageBus {
    sequence: AtomicU64,
    replay_capacity: usize,
    replay: Mutex<VecDeque<SequencedMessage>>,
    live: broadcast::Sender<SequencedMessage>,
}

impl MessageBus {
    fn new(replay_capacity: usize) -> Self {
        let (live, _) = broadcast::channel(LIVE_EVENT_CAPACITY);
        Self {
            sequence: AtomicU64::new(0),
            replay_capacity,
            replay: Mutex::new(VecDeque::with_capacity(replay_capacity)),
            live,
        }
    }

    fn publish(&self, message: Value) {
        let event = SequencedMessage {
            sequence: self.sequence.fetch_add(1, Ordering::Relaxed) + 1,
            message,
        };
        {
            let mut replay = self.replay.lock().expect("message replay lock poisoned");
            replay.push_back(event.clone());
            while replay.len() > self.replay_capacity {
                replay.pop_front();
            }
        }
        let _ = self.live.send(event);
    }

    fn subscribe(&self, after_sequence: u64) -> MessageSubscription {
        // Subscribe before copying replay. A caller may receive the same event in
        // both collections, so consumers deduplicate by monotonically increasing
        // sequence. This ordering guarantees that no event is missed.
        let live = self.live.subscribe();
        let replay_guard = self.replay.lock().expect("message replay lock poisoned");
        let oldest_sequence = replay_guard.front().map(|event| event.sequence);
        let latest_sequence = replay_guard
            .back()
            .map(|event| event.sequence)
            .unwrap_or_else(|| self.sequence.load(Ordering::Relaxed));
        let reset_required = oldest_sequence
            .map(|oldest| after_sequence.saturating_add(1) < oldest)
            .unwrap_or(false);
        let replay = replay_guard
            .iter()
            .filter(|event| event.sequence > after_sequence)
            .cloned()
            .collect();
        MessageSubscription {
            replay,
            live,
            reset_required,
            latest_sequence,
        }
    }
}

/// Concurrent Codex app-server transport for daemon/client adapters.
///
/// A dedicated reader continuously routes responses to their request futures
/// while broadcasting notifications and server-initiated requests (approvals,
/// user input, MCP elicitation). This prevents UI latency or one slow request
/// from blocking the harness event stream.
pub struct ConcurrentAppServer {
    child: Child,
    outbound: Option<mpsc::Sender<Value>>,
    next_id: AtomicU64,
    pending: Arc<Mutex<HashMap<u64, PendingResponse>>>,
    messages: Arc<MessageBus>,
    writer_task: JoinHandle<Result<()>>,
    reader_task: JoinHandle<Result<()>>,
}

impl ConcurrentAppServer {
    pub async fn spawn(codex: &Path) -> Result<Self> {
        Self::spawn_with_replay_capacity(codex, DEFAULT_REPLAY_CAPACITY).await
    }

    pub async fn spawn_with_replay_capacity(codex: &Path, replay_capacity: usize) -> Result<Self> {
        Self::spawn_command_with_replay_capacity(codex, &["app-server", "--stdio"], replay_capacity)
            .await
    }

    /// Spawn a JSONL-compatible app-server command. This is primarily a test
    /// seam; production callers should use [`Self::spawn`].
    pub async fn spawn_command(program: &Path, args: &[&str]) -> Result<Self> {
        Self::spawn_command_with_replay_capacity(program, args, DEFAULT_REPLAY_CAPACITY).await
    }

    async fn spawn_command_with_replay_capacity(
        program: &Path,
        args: &[&str],
        replay_capacity: usize,
    ) -> Result<Self> {
        if replay_capacity == 0 {
            bail!("replay capacity must be greater than zero");
        }
        let mut child = Command::new(program)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .kill_on_drop(true)
            .spawn()
            .with_context(|| format!("start {} app-server", program.display()))?;
        let mut stdin = child.stdin.take().context("app-server stdin missing")?;
        let stdout = child.stdout.take().context("app-server stdout missing")?;

        let (outbound, mut outbound_rx) = mpsc::channel::<Value>(OUTBOUND_CAPACITY);
        let writer_task = tokio::spawn(async move {
            while let Some(message) = outbound_rx.recv().await {
                let mut frame = serde_json::to_vec(&message)?;
                frame.push(b'\n');
                stdin
                    .write_all(&frame)
                    .await
                    .context("write app-server frame")?;
                stdin.flush().await.context("flush app-server frame")?;
            }
            stdin.shutdown().await.context("close app-server stdin")
        });

        let pending: Arc<Mutex<HashMap<u64, PendingResponse>>> =
            Arc::new(Mutex::new(HashMap::new()));
        let messages = Arc::new(MessageBus::new(replay_capacity));
        let reader_pending = Arc::clone(&pending);
        let reader_messages = Arc::clone(&messages);
        let reader_task = tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Some(line) = lines.next_line().await.context("read app-server frame")? {
                let message: Value = serde_json::from_str(&line)
                    .with_context(|| format!("invalid app-server JSONL frame: {line}"))?;
                let response_id = match classify_message(&message) {
                    MessageKind::Response => message.get("id").and_then(Value::as_u64),
                    MessageKind::ServerRequest
                    | MessageKind::Notification
                    | MessageKind::Invalid => None,
                };
                let response = response_id.and_then(|id| {
                    reader_pending
                        .lock()
                        .expect("pending response lock poisoned")
                        .remove(&id)
                });
                if let Some(response) = response {
                    let result = if let Some(error) = message.get("error") {
                        Err(error.to_string())
                    } else {
                        message
                            .get("result")
                            .cloned()
                            .ok_or_else(|| "response has no result".to_string())
                    };
                    let _ = response.send(result);
                } else {
                    reader_messages.publish(message);
                }
            }

            let pending = std::mem::take(
                &mut *reader_pending
                    .lock()
                    .expect("pending response lock poisoned"),
            );
            for (_, response) in pending {
                let _ = response.send(Err("app-server exited before responding".to_string()));
            }
            Ok(())
        });

        Ok(Self {
            child,
            outbound: Some(outbound),
            next_id: AtomicU64::new(1),
            pending,
            messages,
            writer_task,
            reader_task,
        })
    }

    pub async fn initialize(&self) -> Result<Value> {
        self.initialize_with_capabilities(&AppServerCapabilities::default())
            .await
    }

    pub async fn initialize_with_capabilities(
        &self,
        capabilities: &AppServerCapabilities,
    ) -> Result<Value> {
        let response = self
            .request(
                "initialize",
                json!({
                    "clientInfo": {
                        "name": "codex-harness-workbench",
                        "title": "Codex Harness Workbench",
                        "version": env!("CARGO_PKG_VERSION")
                    },
                    "capabilities": capabilities
                }),
            )
            .await?;
        self.notify("initialized", json!({})).await?;
        Ok(response)
    }

    pub async fn request(&self, method: &str, params: Value) -> Result<Value> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (response_tx, response_rx) = oneshot::channel();
        self.pending
            .lock()
            .expect("pending response lock poisoned")
            .insert(id, response_tx);
        if let Err(error) = self
            .send(json!({"id": id, "method": method, "params": params}))
            .await
        {
            self.pending
                .lock()
                .expect("pending response lock poisoned")
                .remove(&id);
            return Err(error);
        }
        response_rx
            .await
            .with_context(|| format!("response channel closed for {method}"))?
            .map_err(|error| anyhow::anyhow!("{method} failed: {error}"))
    }

    pub async fn notify(&self, method: &str, params: Value) -> Result<()> {
        self.send(json!({"method": method, "params": params})).await
    }

    pub async fn respond(&self, id: Value, result: Value) -> Result<()> {
        validate_response_id(&id)?;
        self.send(json!({"id": id, "result": result})).await
    }

    pub async fn respond_error(&self, id: Value, code: i64, message: &str) -> Result<()> {
        validate_response_id(&id)?;
        self.send(json!({
            "id": id,
            "error": {"code": code, "message": message}
        }))
        .await
    }

    pub fn subscribe(&self, after_sequence: u64) -> MessageSubscription {
        self.messages.subscribe(after_sequence)
    }

    async fn send(&self, message: Value) -> Result<()> {
        self.outbound
            .as_ref()
            .context("app-server is shutting down")?
            .send(message)
            .await
            .context("app-server writer stopped")
    }

    pub async fn shutdown(mut self) -> Result<()> {
        drop(self.outbound.take());
        self.writer_task.await.context("join app-server writer")??;
        let status = self.child.wait().await.context("wait for app-server")?;
        self.reader_task.await.context("join app-server reader")??;
        if status.success() {
            Ok(())
        } else {
            bail!("app-server exited unsuccessfully: {status}")
        }
    }
}

fn validate_response_id(id: &Value) -> Result<()> {
    if id.is_number() || id.is_string() {
        Ok(())
    } else {
        bail!("app-server response id must be a number or string")
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{AppServerCapabilities, MessageBus};

    #[test]
    fn desktop_capabilities_opt_into_experiments_without_attestation() {
        assert_eq!(
            serde_json::to_value(AppServerCapabilities::desktop_experimental())
                .expect("serialize capabilities"),
            json!({"experimentalApi": true, "requestAttestation": false})
        );
    }

    #[test]
    fn subscription_replays_only_messages_after_cursor_with_bounded_history() {
        let bus = MessageBus::new(2);
        bus.publish(json!({"method": "one"}));
        bus.publish(json!({"method": "two"}));
        bus.publish(json!({"method": "three"}));

        let subscription = bus.subscribe(1);
        assert_eq!(
            subscription
                .replay
                .iter()
                .map(|event| event.sequence)
                .collect::<Vec<_>>(),
            vec![2, 3]
        );
        assert_eq!(subscription.replay[0].message["method"], "two");
        assert_eq!(subscription.replay[1].message["method"], "three");
        assert!(!subscription.reset_required);
        assert_eq!(subscription.latest_sequence, 3);

        let stale_subscription = bus.subscribe(0);
        assert!(stale_subscription.reset_required);
        assert_eq!(stale_subscription.latest_sequence, 3);
    }
}
