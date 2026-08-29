use std::env;
use std::path::PathBuf;

use anyhow::Result;
use codex_bridge::ConcurrentAppServer;
use serde_json::json;

#[tokio::main]
async fn main() -> Result<()> {
    let codex = env::var_os("CODEX_BIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("codex"));
    let server = ConcurrentAppServer::spawn(&codex).await?;

    let initialized = server.initialize().await?;
    println!(
        "initialize: {}",
        serde_json::to_string_pretty(&initialized)?
    );

    let account = server.request("account/read", json!({})).await?;
    println!("account/read: {}", serde_json::to_string_pretty(&account)?);

    let threads = server.request("thread/list", json!({"limit": 5})).await?;
    println!("thread/list: {}", serde_json::to_string_pretty(&threads)?);

    server.shutdown().await
}
