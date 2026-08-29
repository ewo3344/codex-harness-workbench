use anyhow::Result;
use serde_json::{Value, json};

use crate::ConcurrentAppServer;

/// Read-only discovery facade for Codex desktop management surfaces.
///
/// Mutation methods (login, config writes, plugin install, MCP OAuth) remain
/// separate so a UI cannot turn a catalog refresh into an implicit state
/// change. Experimental calls require initialization with the corresponding
/// app-server capability.
pub struct DesktopApi<'a> {
    transport: &'a ConcurrentAppServer,
}

impl<'a> DesktopApi<'a> {
    pub fn new(transport: &'a ConcurrentAppServer) -> Self {
        Self { transport }
    }

    pub async fn read_account(&self, refresh_token: bool) -> Result<Value> {
        self.transport
            .request("account/read", json!({"refreshToken": refresh_token}))
            .await
    }

    pub async fn read_rate_limits(&self) -> Result<Value> {
        self.transport
            .request("account/rateLimits/read", json!({}))
            .await
    }

    pub async fn read_usage(&self, thread_id: Option<&str>) -> Result<Value> {
        self.transport
            .request("account/usage/read", json!({"threadId": thread_id}))
            .await
    }

    pub async fn read_config(&self, cwd: Option<&str>, include_layers: bool) -> Result<Value> {
        self.transport
            .request(
                "config/read",
                json!({"cwd": cwd, "includeLayers": include_layers}),
            )
            .await
    }

    pub async fn list_models(&self, include_hidden: bool) -> Result<Value> {
        self.transport
            .request(
                "model/list",
                json!({"cursor": null, "limit": null, "includeHidden": include_hidden}),
            )
            .await
    }

    pub async fn list_skills(&self, cwds: &[String], force_reload: bool) -> Result<Value> {
        self.transport
            .request(
                "skills/list",
                json!({"cwds": cwds, "forceReload": force_reload}),
            )
            .await
    }

    pub async fn list_plugins(&self, cwds: &[String], force_refetch: bool) -> Result<Value> {
        self.transport
            .request(
                "plugin/list",
                json!({
                    "cwds": cwds,
                    "marketplaceKinds": null,
                    "forceRefetch": force_refetch
                }),
            )
            .await
    }

    pub async fn list_apps(&self, thread_id: Option<&str>) -> Result<Value> {
        self.transport
            .request(
                "app/list",
                json!({
                    "cursor": null,
                    "limit": null,
                    "threadId": thread_id,
                    "forceRefetch": false
                }),
            )
            .await
    }

    pub async fn list_mcp_servers(&self, thread_id: Option<&str>) -> Result<Value> {
        self.transport
            .request(
                "mcpServerStatus/list",
                json!({
                    "cursor": null,
                    "limit": null,
                    "detail": "toolsAndAuthOnly",
                    "threadId": thread_id
                }),
            )
            .await
    }

    pub async fn list_experimental_features(&self, thread_id: Option<&str>) -> Result<Value> {
        self.transport
            .request(
                "experimentalFeature/list",
                json!({"cursor": null, "limit": null, "threadId": thread_id}),
            )
            .await
    }

    pub async fn list_permission_profiles(&self, cwd: Option<&str>) -> Result<Value> {
        self.transport
            .request(
                "permissionProfile/list",
                json!({"cursor": null, "limit": null, "cwd": cwd}),
            )
            .await
    }
}
