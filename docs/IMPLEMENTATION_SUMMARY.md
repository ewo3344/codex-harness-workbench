# Codex Harness Workbench - 实施摘要

**档案**：实现摘要快照，不是当前必读。权威剩余工作 [`docs/tasks.md`](tasks.md)，现状 [`STATUS.md`](../STATUS.md)。live gitlink 以 `git submodule status` 为准，不要用下文旧 SHA。

修订日期：2026-08-30
文档性质：实现和验证摘要，不是 release 说明

## 当前状态

Rust bridge 与 Codex 基础链路完成。Web relay terminal 已验收；T8（配对/iOS/hosted TLS 等）未证明。Provider UI、reload、CAS（T5）已落地；Android T7 真机表单 cancel 通过。T9 desktop reconnect 未完成。T10 会话连续性与 reload 失败日志未验。T11 真实模型 turn 等额度。

## Provider 逻辑

当前实现位于 upstream/paseo/packages/server/src/server/bootstrap.ts 和
packages/server/src/server/agent/provider-snapshot-manager.ts：

- 产品 builtin（claude / copilot / opencode / pi / Codex）加入 publishedProviderIds；Codex 是 requiredProviderIds。`omp` 不发行。
- 开发模式可额外发布 mock；显式注入的测试 client 只用于内部契约。
- 启用 custom provider 必须同时具有 enabled=true 和 extends 字段，且由
  ProviderSnapshotManager 在构建 registry 时动态纳入。
- reload 会原子地应用 provider 配置；失败时保留旧 snapshot 和 client。
- Codex 的 required 约束在 daemon 和 Settings UI 两侧生效，不能通过配置停用或删除。
- provider client view 会剥离 API key 等凭证；relay/移动端只接收允许同步的元数据。

旧文档曾描述一个已删除的启用 provider helper；当前代码不再提供该 API，文档和
脚本均以 ProviderSnapshotManager 的现行逻辑为准。

## 已实现的产品路径

### Rust bridge

- Codex app-server 0.149.0 的 initialize、并发 JSON-RPC、乱序 response 路由。
- server-initiated approval、thread start/resume/fork/archive/unarchive/delete。
- turn start/steer/interrupt，以及 experimental thread/revert rewind。
- 有界 replay buffer 与过期 cursor 的 reset_required 语义。
- OMP pi-walker 仅在 omp-walker feature 下启用，默认关闭。

### Paseo Web/Desktop

- Codex required provider 和 OpenAI-compatible、Anthropic-compatible、ACP custom
  provider 的配置、启停、编辑和删除。
- Settings 保存后的 daemon reload、snapshot 刷新和进程连续性。
- 新建 workspace 默认 Codex CLI terminal，并保留 no-alt-screen 参数。
- Web + packaged daemon + 本地 Wrangler E2EE relay terminal 的创建、订阅、输入/输出、
  resize 和终止。
- Desktop browser-tabs 路径已通过真实 Electron 验证；relay-terminal reconnect
  在 2026-08-30 仍不能标记完成。Linux Wayland 上 ozone/Vulkan 与推测性
  reload 会弄死 renderer；host runtime 可达之后 `new-workspace-launch-menu`
  仍无法从 Electron CDP 打开。见 `docs/PROGRESS.md` 当日 K3.1 与
  `packages/desktop/e2e/relay-terminal-reconnect.e2e.mjs`。

### Android/iOS

- Android T7：真机 provider 表单 cancel 通过（adb 半手动）。Maestro 操作系（阻碍 A）未修。
- Android relay 控制面曾观察到 offer 注册和 session resume；扫码/多设备/网络切换/聊天/iOS 仍待验（T8）。
- API keys 不同步到移动端。

## 可复现验证

以下命令在 2026-08-29 的 pinned Paseo revision 上运行：

~~~bash
cd upstream/paseo
npx vitest run packages/server/src/server/bootstrap.smoke.test.ts packages/server/src/server/agent/provider-snapshot-manager.test.ts --maxWorkers=1
# Test Files 2 passed; Tests 77 passed
npm run build:server
npm run format:check
npm run lint
cd ../..
cargo test --workspace --locked
cargo fmt --all -- --check
./scripts/verify-custom-providers.sh
~~~

verify-custom-providers.sh 使用临时目录解析示例配置，不写入 .paseo-dev。
真实 Codex turn、设备和 hosted relay 的未完成项必须保留为待验。

## 配置示例和文档

- config/custom-providers.example.json：Codex、OpenAI-compatible、Anthropic-compatible
  和 ACP 示例。
- docs/CUSTOM_PROVIDERS.md：字段、凭证边界和 Settings 生命周期。
- docs/CUSTOM_API_PLAN.md：实施路线和验收门槛。
- docs/FEATURE_MATRIX.md：按能力记录证据。
- docs/RELAY_VALIDATION.md：relay 已验证路径和缺口。

## 版本与子模块

根 Cargo.toml 没有顶层 version；crates 为 0.1.0，Paseo package 0.5.0。live gitlink
以 `git submodule status` 为准。版本规则见 VERSION_CONTROL.md。

## 后续工作

以 [`docs/tasks.md`](tasks.md) 为准：T8 relay 未证明项、T9 desktop reconnect、T10 配置面残件、T11 真实模型 turn。Paseo fork 已是 `ewo3344/paseo` 的 `codex-harness-workbench`；不要推 `getpaseo/paseo`。
