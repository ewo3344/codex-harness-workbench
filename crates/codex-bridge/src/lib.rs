use serde_json::Value;

mod client;
mod desktop;
mod harness;

pub use client::{
    AppServerCapabilities, ConcurrentAppServer, MessageSubscription, SequencedMessage,
};
pub use desktop::DesktopApi;
pub use harness::{
    ApprovalPolicy, HarnessApi, SandboxMode, ThreadListOptions, ThreadStartOptions,
    TurnStartOptions, UserInput,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageKind {
    Response,
    ServerRequest,
    Notification,
    Invalid,
}

pub fn classify_message(message: &Value) -> MessageKind {
    let has_id = message.get("id").is_some();
    let has_method = message.get("method").and_then(Value::as_str).is_some();
    let has_response = message.get("result").is_some() || message.get("error").is_some();
    match (has_id, has_method, has_response) {
        (true, false, true) => MessageKind::Response,
        (true, true, false) => MessageKind::ServerRequest,
        (false, true, false) => MessageKind::Notification,
        _ => MessageKind::Invalid,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{MessageKind, classify_message};

    #[test]
    fn app_server_envelope_omits_jsonrpc_header() {
        let request = json!({"id": 1, "method": "thread/list", "params": {}});
        assert!(request.get("jsonrpc").is_none());
        assert_eq!(request["method"], "thread/list");
    }

    #[test]
    fn classifies_bidirectional_app_server_envelopes() {
        assert_eq!(
            classify_message(&json!({"id": 1, "result": {}})),
            MessageKind::Response
        );
        assert_eq!(
            classify_message(&json!({
                "id": "approval-1",
                "method": "item/commandExecution/requestApproval",
                "params": {"threadId": "thread-1"}
            })),
            MessageKind::ServerRequest
        );
        assert_eq!(
            classify_message(&json!({"method": "turn/started", "params": {}})),
            MessageKind::Notification
        );
        assert_eq!(
            classify_message(&json!({"wat": true})),
            MessageKind::Invalid
        );
    }
}
