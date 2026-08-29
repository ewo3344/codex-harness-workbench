# Codex Harness Workbench - 实施摘要

修订日期：2026-08-29
文档性质：实现和验证摘要，不是 release 说明

## 当前状态

阶段 1 的 Rust bridge 与 Codex 基础链路已完成。阶段 2 的 Web relay terminal
路径已验收，Android/iOS、Desktop relay、hosted TLS 和部分高级场景仍在验证。
阶段 3 的 provider 配置 UI、daemon reload 与 snapshot 生命周期已实现；移动真机
和协议级并发冲突的最终客户端验收仍待完成。协议级 revision/CAS 接线已提交到
Paseo `84acf5a`；stale expectedRevision 会被拒绝，匹配 revision 的写入会成功。
权威进度见 STATUS.md 与 docs/PROGRESS.md。

## Provider 逻辑

当前实现位于 upstream/paseo/packages/server/src/server/bootstrap.ts 和
packages/server/src/server/agent/provider-snapshot-manager.ts：

- Codex 始终加入 publishedProviderIds，并作为 requiredProviderIds。
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
- Desktop browser-tabs 路径已通过真实 Electron 验证；relay-terminal reconnect case
  仍有 renderer 生命周期失败日志，不能标记完成。

### Android/iOS

- Android Maestro provider-form 契约脚本已准备；当前无在线设备。
- Android relay 控制面曾观察到 offer 注册和 session resume，但扫码/手动配对、多设备、
  网络切换、聊天/审批/terminal UI 和 iOS 仍待真实客户端验证。
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

根 Cargo.toml 没有顶层 version；crates/codex-bridge 和 crates/omp-primitives
当前均为 0.1.0。Paseo package 为 0.5.0，当前 gitlink 为
84acf5a65897a0c8cece2d0bdb323fe73edd03a4，公共上游基线为
b5f583221436056e1fee2a3179d568a4c5ce85b9。父仓库没有可用 release 历史；版本规则
见 docs/VERSION_CONTROL.md。父 CI 只会检出父提交记录的 gitlink，不能看到子模块
未提交工作区；Paseo 自身 CI 位于 upstream/paseo/.github/workflows/ci.yml。

## 后续工作

1. Android/iOS 实机 provider、配对、网络和完整 transcript 验收。
2. Desktop relay reconnect 的 renderer 生命周期修复与 E2E。
3. 协议级 expectedRevision/CAS 的客户端压力验收、活跃会话连续性、重复 reload 压力和失败日志审计。
4. 用户提供 fork 后，将 Paseo revision 推送到可访问 remote，再让父 CI 验证同一 revision。
