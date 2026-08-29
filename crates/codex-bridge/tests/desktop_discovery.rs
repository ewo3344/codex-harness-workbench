use std::path::Path;
use std::time::Duration;

use codex_bridge::{AppServerCapabilities, ConcurrentAppServer, DesktopApi};

#[tokio::test]
#[ignore = "reads real Codex account, config, model, extension, MCP, and capability catalogs"]
async fn real_desktop_discovery_surfaces_have_stable_top_level_shapes() {
    let server = ConcurrentAppServer::spawn(Path::new("codex"))
        .await
        .expect("spawn installed codex app-server");
    server
        .initialize_with_capabilities(&AppServerCapabilities::desktop_experimental())
        .await
        .expect("initialize experimental desktop capabilities");
    let desktop = DesktopApi::new(&server);
    let cwd = std::env::current_dir()
        .expect("current directory")
        .to_string_lossy()
        .into_owned();
    let cwds = vec![cwd.clone()];

    let responses = tokio::time::timeout(Duration::from_secs(90), async {
        tokio::join!(
            desktop.read_account(false),
            desktop.read_rate_limits(),
            desktop.read_usage(None),
            desktop.read_config(Some(&cwd), true),
            desktop.list_models(false),
            desktop.list_skills(&cwds, false),
            desktop.list_plugins(&cwds, false),
            desktop.list_apps(None),
            desktop.list_mcp_servers(None),
            desktop.list_experimental_features(None),
            desktop.list_permission_profiles(Some(&cwd)),
        )
    })
    .await
    .expect("desktop discovery requests complete");

    let account = responses.0.expect("account/read");
    let rate_limits = responses.1.expect("account/rateLimits/read");
    let usage = responses.2.expect("account/usage/read");
    let config = responses.3.expect("config/read");
    let models = responses.4.expect("model/list");
    let skills = responses.5.expect("skills/list");
    let plugins = responses.6.expect("plugin/list");
    let apps = responses.7.expect("app/list");
    let mcp = responses.8.expect("mcpServerStatus/list");
    let features = responses.9.expect("experimentalFeature/list");
    let profiles = responses.10.expect("permissionProfile/list");

    assert!(account.get("requiresOpenaiAuth").is_some());
    assert!(rate_limits.get("rateLimits").is_some());
    assert!(usage.get("summary").is_some());
    assert!(config.get("config").is_some());
    assert!(models["data"].is_array());
    assert!(skills["data"].is_array());
    assert!(plugins["marketplaces"].is_array());
    assert!(apps["data"].is_array());
    assert!(mcp["data"].is_array());
    assert!(features["data"].is_array());
    assert!(profiles["data"].is_array());

    server.shutdown().await.expect("shutdown app-server");
}
