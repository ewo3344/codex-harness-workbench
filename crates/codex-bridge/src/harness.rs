use anyhow::{Context, Result};
use serde::Serialize;
use serde_json::{Value, json};

use crate::ConcurrentAppServer;

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ApprovalPolicy {
    Untrusted,
    OnRequest,
    Never,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SandboxMode {
    ReadOnly,
    WorkspaceWrite,
    DangerFullAccess,
}

#[derive(Clone, Debug, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadListOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archived: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search_term: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThreadStartOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_policy: Option<ApprovalPolicy>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sandbox: Option<SandboxMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub developer_instructions: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ephemeral: Option<bool>,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(tag = "type")]
pub enum UserInput {
    #[serde(rename = "text")]
    Text {
        text: String,
        #[serde(rename = "text_elements")]
        text_elements: Vec<Value>,
    },
    #[serde(rename = "image")]
    Image {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
    },
    #[serde(rename = "localImage")]
    LocalImage {
        path: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
    },
    #[serde(rename = "skill")]
    Skill { name: String, path: String },
    #[serde(rename = "mention")]
    Mention { name: String, path: String },
}

impl UserInput {
    pub fn text(text: impl Into<String>) -> Self {
        Self::Text {
            text: text.into(),
            text_elements: Vec::new(),
        }
    }
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TurnStartOptions {
    pub thread_id: String,
    pub input: Vec<UserInput>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_user_message_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_policy: Option<ApprovalPolicy>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub effort: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_schema: Option<Value>,
}

impl TurnStartOptions {
    pub fn text(thread_id: impl Into<String>, text: impl Into<String>) -> Self {
        Self {
            thread_id: thread_id.into(),
            input: vec![UserInput::text(text)],
            client_user_message_id: None,
            cwd: None,
            approval_policy: None,
            model: None,
            effort: None,
            output_schema: None,
        }
    }
}

/// Stable, intentionally thin v2 lifecycle facade.
///
/// Responses stay as JSON values because protocol snapshots are tied to the
/// installed Codex version. This facade owns method names and request shapes;
/// Paseo owns the UI projection of returned threads, turns and items.
pub struct HarnessApi<'a> {
    transport: &'a ConcurrentAppServer,
}

impl<'a> HarnessApi<'a> {
    pub fn new(transport: &'a ConcurrentAppServer) -> Self {
        Self { transport }
    }

    pub async fn list_threads(&self, options: &ThreadListOptions) -> Result<Value> {
        self.request_serialized("thread/list", options).await
    }

    pub async fn read_thread(&self, thread_id: &str, include_turns: bool) -> Result<Value> {
        self.transport
            .request(
                "thread/read",
                json!({"threadId": thread_id, "includeTurns": include_turns}),
            )
            .await
    }

    pub async fn start_thread(&self, options: &ThreadStartOptions) -> Result<Value> {
        self.request_serialized("thread/start", options).await
    }

    pub async fn resume_thread(&self, thread_id: &str) -> Result<Value> {
        self.transport
            .request("thread/resume", json!({"threadId": thread_id}))
            .await
    }

    pub async fn fork_thread(&self, thread_id: &str, last_turn_id: Option<&str>) -> Result<Value> {
        self.transport
            .request(
                "thread/fork",
                json!({"threadId": thread_id, "lastTurnId": last_turn_id}),
            )
            .await
    }

    pub async fn archive_thread(&self, thread_id: &str) -> Result<Value> {
        self.thread_action("thread/archive", thread_id).await
    }

    pub async fn unarchive_thread(&self, thread_id: &str) -> Result<Value> {
        self.thread_action("thread/unarchive", thread_id).await
    }

    pub async fn delete_thread(&self, thread_id: &str) -> Result<Value> {
        self.thread_action("thread/delete", thread_id).await
    }

    pub async fn start_turn(&self, options: &TurnStartOptions) -> Result<Value> {
        self.request_serialized("turn/start", options).await
    }

    pub async fn steer_turn(
        &self,
        thread_id: &str,
        expected_turn_id: &str,
        input: Vec<UserInput>,
    ) -> Result<Value> {
        self.transport
            .request(
                "turn/steer",
                json!({
                    "threadId": thread_id,
                    "expectedTurnId": expected_turn_id,
                    "input": input
                }),
            )
            .await
    }

    pub async fn interrupt_turn(&self, thread_id: &str, turn_id: &str) -> Result<Value> {
        self.transport
            .request(
                "turn/interrupt",
                json!({"threadId": thread_id, "turnId": turn_id}),
            )
            .await
    }

    async fn thread_action(&self, method: &str, thread_id: &str) -> Result<Value> {
        self.transport
            .request(method, json!({"threadId": thread_id}))
            .await
    }

    async fn request_serialized<T: Serialize>(&self, method: &str, params: &T) -> Result<Value> {
        let params = serde_json::to_value(params)
            .with_context(|| format!("serialize {method} parameters"))?;
        self.transport.request(method, params).await
    }
}

#[cfg(test)]
mod tests {
    use serde_json::{Value, json};

    use super::{ApprovalPolicy, SandboxMode, ThreadStartOptions, TurnStartOptions};

    #[test]
    fn serializes_stable_thread_and_turn_wire_shapes() {
        let thread = ThreadStartOptions {
            cwd: Some("/workspace".to_string()),
            approval_policy: Some(ApprovalPolicy::OnRequest),
            sandbox: Some(SandboxMode::WorkspaceWrite),
            ephemeral: Some(true),
            ..ThreadStartOptions::default()
        };
        assert_eq!(
            serde_json::to_value(thread).expect("serialize thread"),
            json!({
                "cwd": "/workspace",
                "approvalPolicy": "on-request",
                "sandbox": "workspace-write",
                "ephemeral": true
            })
        );

        let turn = TurnStartOptions::text("thread-1", "hello");
        let value: Value = serde_json::to_value(turn).expect("serialize turn");
        assert_eq!(value["threadId"], "thread-1");
        assert_eq!(
            value["input"],
            json!([{"type": "text", "text": "hello", "text_elements": []}])
        );
        assert!(value.get("model").is_none());
    }
}
