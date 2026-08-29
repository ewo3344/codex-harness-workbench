# 重建进度日志

## 2026-08-23 — 架构重置与协议基线

完成：

- 复核现有实现：Go daemon 管理 PTY，Web/Android 仅消费终端字节流。
- 将目标架构改为 Codex app-server v2 + Rust daemon + Paseo clients。
- 确定 OMP 仅作为 Rust 原生基础能力的候选来源，排除其插件与 agent runtime。
- 记录 Codex/OMP/Paseo 的许可边界。
- 使用本机 `codex-cli 0.149.0` 生成稳定协议快照：`protocol/codex-app-server-0.149.0/{json,typescript}`。

验证：

```bash
codex --version
codex app-server generate-json-schema --out protocol/codex-app-server-0.149.0/json
codex app-server generate-ts --out protocol/codex-app-server-0.149.0/typescript
```

环境问题：初始环境只有 rustup shim，没有 Rust toolchain；已开始安装 stable，Rust crate 的编译验证待完成。

下一步：完成 Rust toolchain安装；建立 app-server supervisor/JSON-RPC bridge，并验证 initialize、account/read、thread/list；拉取并固定 Paseo 上游源码，确认 Codex provider 的最小改造点。

## 2026-08-23 — Rust bridge 与 Paseo 真实链路

完成：

- 安装 Rust 1.98.0 stable minimal profile，`cargo test --workspace` 通过。
- Rust bridge 成功启动本机 `codex app-server --stdio`，完成 initialize/initialized，并读取 `account/read` 与 `thread/list`；子进程正常退出。
- Rust bridge 增加双向 envelope 分类、交错 notification/server-request 保留队列，以及审批等 server request 的 success/error response 原语；2 个契约测试通过。
- 安装 Paseo CLI 0.5.0，启动隔离的本地 daemon 与 Web UI。
- Paseo Codex diagnostic 正确识别 `codex-cli 0.149.0` 和 6 个可用模型。
- 通过 Paseo 创建真实 Codex agent，使用 `gpt-5.6-luna/low` 完成 turn，日志精确包含 `PASEO_CODEX_READY`。
- 确认 Paseo 上游已经实现 app-server adapter，包括结构化 streaming、reasoning、tool calls、审批、session persistence/import、rewind、MCP、skills 与 model/mode discovery。
- 初始化 Git 仓库，并将 Paseo 固定为 `upstream/paseo` submodule。
- 将 OMP 固定为 `upstream/oh-my-pi` submodule，完成 `pi-walker`、`pi-iso`、`pi-shell` 的首轮依赖边界评估。
- 新增只启用 Codex、关闭插件和语音下载的开发配置及启动脚本。

验证：

```bash
cargo test --workspace
cargo run -p codex-bridge
paseo provider diagnostic codex --host 127.0.0.1:6877 --json
paseo provider models codex --host 127.0.0.1:6877 --json
paseo run --host 127.0.0.1:6877 --provider codex/gpt-5.6-luna --thinking low --cwd /tmp --wait-timeout 2m --json 'Reply exactly: PASEO_CODEX_READY'
```

下一步：在固定 Paseo fork 上落实 Codex-only 构建，先删除运行时 plugin 注册和非 Codex provider；为 Rust bridge 增加并发请求、server-initiated approval 路由和 replay buffer；再替换 Paseo daemon 的进程/终端/文件观察底层。

## 2026-08-24 — 并发 transport 与完成度基线

完成：

- Rust transport 改为独立 reader/writer 任务，可同时处理多个 request，并按数字 id 路由乱序 response。
- notification 与 server-initiated request 进入统一序号广播和 2048 条有界 replay；过期 cursor 明确返回 `reset_required`。
- 新增确定性 fake app-server 测试：两个响应反序返回，中间穿插 `turn/started` 和命令审批，bridge 正确回送审批结果。
- 真实 Codex 集成测试并发执行 `account/read`、`thread/list`、`model/list` 后正常关闭。
- 建立 `docs/FEATURE_MATRIX.md`，将“Codex 桌面版所有功能”拆为逐项证据与完成门槛。
- 修正插件边界：丢弃的是 OMP/Pi agent plugin；Paseo 本地 plugin 默认关闭；Codex app-server 的 plugin/app/marketplace 属于目标功能，不能删除。

验证：

```bash
cargo test --workspace
cargo test -p codex-bridge --test app_server_smoke -- --ignored
```

下一步：给 thread/turn 生命周期增加薄 API；真实验证审批与断线追赶；根据源码审查决定 Paseo fork 的最小 patch；选择 `pi-walker` 或 `pi-iso` 的首个 feature-gated adapter。

## 2026-08-24 — 真实审批与线程生命周期

完成：

- 新增 `HarnessApi` 薄层，覆盖 thread list/read/start/resume/fork/archive/unarchive/delete 与 turn start/steer/interrupt；wire shape 由 0.149.0 协议快照约束。
- 在真实 `codex app-server` + `gpt-5.6-luna` 中以 `read-only` sandbox 和 `on-request` 策略触发命令审批；bridge 以原 request id 回送 `accept`，turn 恢复为 `completed`，写入结果存在。
- 真实验证持久线程 start、首 turn 物化、app-server 重启、read、resume、fork、active/archived list、archive、unarchive 与 delete 的完整往返。
- 记录 app-server 的物化约束：线程在首条用户消息前没有 rollout，不能请求 `thread/read(includeTurns=true)`；测试不再把接口返回与持久化完成混为一谈。

验证：

```bash
./scripts/verify-rust.sh
cargo test -p codex-bridge --test approval_flow -- --ignored --nocapture
cargo test -p codex-bridge --test thread_lifecycle -- --ignored --nocapture
```

下一步：验证 turn steer/interrupt 与 replay reset；接入 Paseo 客户端审批 UI；依据依赖审计选择首个 feature-gated OMP primitive。

## 2026-08-24 — 首个 OMP Rust primitive adapter

完成：

- 在 `crates/omp-primitives` 建立默认关闭的 `omp-walker` feature，以 pinned submodule path dependency 使用 OMP `pi-walker`，没有引入 OMP agent/provider/plugin/runtime。
- 扫描在 Tokio blocking worker 中运行；adapter 支持 gitignore、hidden、`.git`/`node_modules` pruning、深度/数量限制、共享 cache 与 watcher invalidation。
- 默认不启用 feature 时返回明确的 fallback 信号，Paseo 现有文件观察路径不被破坏。
- Rust 1.88 与当前 stable 均通过构建；真实 fixture 证明 ignore/pruning 语义；根 lockfile 已包含实际解析版本。
- 完成 `pi-iso`/`pi-shell` 依赖审计：前者只做实验；后者依赖 nightly `portable_simd`、宿主 `brush-core` patch 且依赖面过大，暂缓。
- 新增 `THIRD_PARTY_NOTICES.md`，保留 `pi-walker` MIT attribution。

验证：

```bash
cargo fmt --package codex-bridge --package omp-primitives -- --check
cargo test --locked --workspace
cargo test --locked -p omp-primitives --features omp-walker
cargo +1.88 check -p omp-primitives --features omp-walker
```

下一步：把 watcher 事件接到 cache invalidation；用真实 Paseo 项目对比扫描延迟、CPU 和 cache 命中，达到门槛后才启用生产 feature。

## 2026-08-24 — 真实 turn steer 与 interrupt

完成：

- 真实 turn 启动后调用 `turn/steer` 注入替代要求，app-server 返回同一 turn id，最终流式回答包含新 marker。
- 另一个超长生成 turn 在 start acknowledgement 后立即调用 `turn/interrupt`；连续三次均以 `interrupted` 完成。
- 最初依赖“模型主动选择 shell 并进入审批”的 interrupt 场景出现一次模型提前结束；测试已去掉该非确定前提，命令审批继续由独立 `approval_flow` 覆盖。
- 两条测试均使用 ephemeral thread 和隔离临时目录，不污染持久 thread 列表。
- 修正后在同一轮真实套件中重新跑过 app-server smoke、桌面 discovery、审批、跨进程 thread 生命周期、steer 与 interrupt，全部通过。

验证：

```bash
cargo test --locked -p codex-bridge --test turn_control -- --ignored --nocapture --test-threads=1
CHW_REAL_CODEX_TESTS=1 ./scripts/verify-rust.sh
```

发现：0.149.0 已把 `thread/rollback` 标为即将移除，且协议明确它不会恢复本地文件。当时初步建议迁到 `thread/fork(lastTurnId)`；后续按 pinned 源码与 experimental schema 复核，最终改用语义更准确且保留 thread id 的 `thread/revert(beforeTurnId)`。新 Rust 稳定 API 不新增 deprecated wrapper。

下一步：迁移 Paseo rewind 并独立验证文件 diff/revert；在 Paseo Web/移动端验收 steer 与 interrupt 控件。

## 2026-08-24 — Paseo fork 强制 Codex-only

> 历史状态：本节记录当时的收口策略；后续“自定义 API Provider 支持”已将其替换为
> “Codex required + 可选 custom provider”。Codex 仍不可停用或删除。

完成：

- 在 `ProviderSnapshotManager` 新增不可变 published-provider allowlist 与独立 required-provider invariant，并在每次初始/热重载 registry 构建后按最终 provider id 收口。
- 生产 bootstrap 固定只发布且始终启用 `codex`；builtin 重新启用、OMP、ACP/Claude/Codex 派生 provider 和非允许 extra client 都不能从 manager snapshot、definitions 或 clients 绕过，持久化 `codex.enabled=false` 也不能禁用唯一 runtime。
- 保留所有上游 adapter、宽松 provider schema 与历史数据读取，避免现在硬删约 5.8 万行造成长期上游同步冲突。
- 设置页只显示 Codex，删除 Add Provider/ACP catalog、启停开关与删除菜单；旧 ACP 安装/自定义 provider 删除 E2E 改为 Codex-only 负向边界测试。
- provider manager + bootstrap 定向测试 76/76、设置组件测试 5/5、server/app typecheck、server build、daemon Web UI 完整导出、改动文件 lint/format 与 `git diff --check` 全部通过。
- 启动本地构建的 pinned Paseo fork；`provider ls` 真实输出只有 Codex，Codex diagnostic 为 Ready/6 models，OMP 返回 not configured。
- 在隔离持久化配置中显式写入 `codex.enabled=false`，真实 daemon 仍报告 Codex Enabled/Ready，并通过 `gpt-5.6-luna/low` 完成输出精确为 `REQUIRED_CODEX_READY` 的 turn；验证 agent 已删除、workspace 已归档、服务已停止、测试配置已恢复。
- 新 Web bundle 已复制到 daemon 的实际挂载目录；HTTP 200，远端资产与本地导出资产 SHA-256 一致。
- 启动脚本默认运行本地 fork build；只有显式设置 `CHW_USE_GLOBAL_PASEO=1` 才回退到未打 patch 的全局 CLI。

验证：

```bash
cd upstream/paseo
npx vitest run packages/server/src/server/agent/provider-snapshot-manager.test.ts packages/server/src/server/bootstrap.smoke.test.ts
npm run build:server
npm run build:daemon-web-ui
npm run typecheck:server
npm run typecheck --workspace=@getpaseo/app

cd ../..
./scripts/start-harness-workbench.sh
node --disable-warning=DEP0040 upstream/paseo/packages/cli/bin/paseo provider ls --host 127.0.0.1:6877 --json
node --disable-warning=DEP0040 upstream/paseo/packages/cli/bin/paseo run --host 127.0.0.1:6877 --provider codex/gpt-5.6-luna --thinking low --cwd /tmp --wait-timeout 2m --json 'Reply exactly: REQUIRED_CODEX_READY'
```

浏览器 E2E 的 Codex-only 断言已写入，但本机缺 `chromium_headless_shell-1208`；浏览器下载在环境中长时间无进展后终止，因此本轮未执行该 Playwright case。

下一步：为 Codex plugin/app/marketplace 新建独立 vertical slice，不能复用 Paseo local PluginService；随后验证配对、E2EE relay 和 Web/Android/Desktop 多端重连。

## 2026-08-24 — Codex 桌面管理面 discovery

完成：

- initialize 支持显式 capability；桌面 discovery 使用 `experimentalApi: true`，但明确不声明第一方 attestation 能力。
- 新增只读 `DesktopApi`，把浏览 catalog 与 login/config/plugin/MCP 等有状态 mutation 分离。
- 在一个真实 app-server 连接上并发读取 account、rate limits、usage、config layers、models、skills、plugin marketplaces、apps、MCP status、experimental features 与 permission profiles；11 个响应均通过顶层 shape 验证。

验证：

```bash
cargo test --locked -p codex-bridge --test desktop_discovery -- --ignored --nocapture
```

下一步：先在 Paseo protocol 建 capability-gated、只读 Codex Extensions catalog，再分别设计需要确认的安装/卸载、登录与配置写入请求。

## 2026-08-24 — Paseo rewind 迁移与 Codex binary 版本约束

完成：

- 将 Paseo 对话 rewind 从 deprecated `thread/rollback` 迁到 0.149 experimental `thread/revert(beforeTurnId)`；所选 turn 及其后历史被截断，native thread id 保持不变，本地文件修改明确不回滚。
- 从持久化 `thread/read` 投影记录 canonical turn id，同时保留当前 UI/live user message id alias；rewind 后重新 hydrate timeline、runtime info 与 agent persistence。
- transport 新增 typed revert request/response parser、outbound RPC trace，以及 `turn/start.clientUserMessageId`；session、transport、manager 与 rewind 契约测试覆盖首 turn、后续 turn、缺失消息和 legacy 无 turn-id 拒绝路径。
- 发现仓库级 `/home/e/node_modules/.bin/codex` 0.117.0 遮蔽用户级 0.149.0。默认 executable discovery 现在枚举所有 PATH candidate，并选择首个版本不低于 0.149.0 的 binary；显式 runtime command override 保持权威。
- 生成 `protocol/codex-app-server-0.149.0/experimental/{json,typescript}`，将 `ThreadRevertParams/Response` 与 `thread/reverted` 纳入版本化事实源。
- 用真实 0.149 app-server 建立专用 paginated thread：额度失败的 turn 持久化后从 1 turn revert 为 0 turn，response 保持同一 thread id；随后删除测试 thread。

验证：

```bash
cd upstream/paseo
npx vitest run \
  packages/server/src/server/agent/providers/codex/app-server-transport.test.ts \
  packages/server/src/server/agent/providers/codex/rewind.test.ts \
  packages/server/src/executable-resolution/executable-resolution.test.ts \
  packages/server/src/server/agent/providers/codex-app-server-agent.test.ts \
  --maxWorkers=1

npx vitest run \
  packages/server/src/server/agent/agent-manager.test.ts \
  packages/server/src/server/agent/provider-snapshot-manager.test.ts \
  packages/server/src/server/bootstrap.smoke.test.ts \
  packages/app/src/screens/settings/providers-section.test.tsx \
  --maxWorkers=1

codex app-server generate-json-schema --experimental \
  --out protocol/codex-app-server-0.149.0/experimental/json
codex app-server generate-ts --experimental \
  --out protocol/codex-app-server-0.149.0/experimental/typescript
```

结果：Codex 定向套件 181 passed / 6 skipped，跨 manager/bootstrap/UI 套件 249 passed。真实 Paseo 成功模型 turn 的三条 rewind E2E 已开始执行，但本机 ChatGPT/Codex 账户返回 usage limit（2026-08-31 08:16 恢复），因此完整成功双 turn 场景仍待额度恢复后复跑；这不是 app-server 协议或 rewind 实现失败。

下一步：额度恢复后运行 `codex-rewind.real.e2e.test.ts` 三条成功 turn 场景；继续配对、E2EE relay、Web/Android/Desktop 重连与 Codex Extensions 管理面。

## 2026-08-24 — 自定义 Provider 支持

完成：

- 修改 Paseo provider 管理策略，从硬编码 Codex-only 改为"Codex 必需 + 可选自定义 provider"。
- 新增 `getEnabledCustomProviderIds()` 函数，从 `providerOverrides` 中提取显式 `enabled: true` 的自定义 provider。
- bootstrap 时将启用的自定义 provider 添加到 `publishedProviderIds` allowlist，同时保持 Codex 为 `requiredProviderIds`。
- 新增 provider allowlist 日志输出，记录实际发布的 provider 列表。
- 创建 `config/custom-providers.example.json` 配置示例，覆盖 OpenAI-compatible、Anthropic-compatible 和 ACP provider 三种场景。
- 编写完整的 `docs/CUSTOM_PROVIDERS.md` 配置指南，包含常见场景、字段参考、验证步骤、移动端同步说明和架构说明。
- 创建 `docs/CUSTOM_API_PLAN.md` 实施计划，包含自定义 API 和手机远程体验改善的完整路线图。

验证：

```bash
cd upstream/paseo
npx vitest run packages/server/src/server/bootstrap.smoke.test.ts --maxWorkers=1
npx vitest run packages/server/src/server/agent/provider-snapshot-manager.test.ts --maxWorkers=1
npm run build:server
```

结果：bootstrap smoke 21/21 passed，provider-snapshot-manager 55/55 passed，server build 成功。

架构影响：

- 不违背"Codex 是唯一 agent runtime"的核心原则：Codex 仍是必需且不可禁用的 provider。
- 其他 provider 是可选的辅助能力，通过现有 Paseo adapter（CodexAppServerAgentClient、ACPAgentClient 等）接入。
- 自定义 provider 必须在配置中显式 `enabled: true` 才会被发布，不能通过持久化 `codex.enabled=false` 来绕过 Codex。
- 移动端通过 E2EE relay 同步 provider 列表，但不同步 API keys（安全边界）。

支持的自定义 provider 类型：

1. **extends "codex"**：OpenAI-compatible 端点（OpenRouter、LiteLLM、vLLM、本地 llama.cpp）
2. **extends "claude"**：Anthropic-compatible 端点（Z.AI、Alibaba Cloud Qwen、自建代理）
3. **extends "acp"**：Agent Client Protocol 兼容 agent（Gemini CLI、Hermes、本地 Ollama + ACP wrapper）

配置示例：

```json
{
  "agents": {
    "providers": {
      "my-openai": {
        "extends": "codex",
        "enabled": true,
        "label": "Custom OpenAI API",
        "env": {
          "OPENAI_API_KEY": "sk-...",
          "OPENAI_BASE_URL": "https://api.openai.com"
        },
        "models": [{"id": "gpt-4-turbo", "label": "GPT-4 Turbo", "isDefault": true}]
      }
    }
  }
}
```

下一步：验证自定义 provider 的真实对话、移动端 E2EE relay 配对测试、断线重连场景验证、移动端审批 UI 优化。

## 2026-08-27 — Codex CLI 默认入口与本地 E2EE relay 基线

完成：

- 新工作区在没有已保存 launch target 时默认选择 `codex` terminal profile；用户显式选择 Chat 与失效 profile 回退路径保持不变。
- 默认 Codex profile 使用 `codex --no-alt-screen [prompt]`，使 CLI transcript 保留在 Paseo terminal stream 中，适用于远程控制和桌面 pane/split 视图。
- 没有另建 PTY 协议或路由：新终端继续通过 Paseo `createTerminal`、terminal panel 和 workspace layout 创建；桌面平铺继续复用现有 `SplitContainer`，移动端保持单 pane/tab 行为。
- 新增 `scripts/verify-relay.sh`，强制执行 Paseo 的隔离 relay crypto E2E 与 pairing-offer/daemon relay E2E。测试使用临时 home、workdir、Wrangler Durable Object 和随机端口，不改变 `.paseo-dev` 或默认 `--no-relay` 启动路径。
- Relay wrapper 现在要求 Node.js 22 或更高版本，与 pinned Wrangler relay 测试依赖一致；`RELAY_VALIDATION.md` 已加入文档索引。

验证：

```bash
cd upstream/paseo
npx vitest run packages/app/src/new-workspace-launch/target.test.ts \
  packages/app/src/screens/new-workspace-terminal.test.ts \
  packages/protocol/src/terminal-profiles.test.ts \
  packages/app/src/create-agent-preferences/preferences.test.ts --maxWorkers=1

./scripts/verify-relay.sh
```

结果：Codex CLI 默认入口定向套件 4 files / 101 tests 通过；relay crypto 套件 3 tests、daemon pairing-offer 套件 1 test 通过。relay 本地基线覆盖 crypto、daemon 注册、E2EE offer client 与 relay `ls` 对直连 `ls` 的一致性。Android/iOS 设备未连接，因此 QR/输入配对、双向消息、网络切换、replay overflow 和移动端 UI 验收仍保持未完成。

## 2026-08-27 — Android Relay 会话与 Timeline 重连契约

完成：

- 使用 Java 17 和 Android SDK 构建 Paseo 0.5.0 Debug APK，并安装到一台 Android 16 实体设备。
- 设备通过隔离的本地 Wrangler E2EE relay 完成 pairing offer 注册；持久化 registry 包含 relay endpoint、daemon public key 和 server id。
- 隔离 daemon 记录了 relay `hello`、`helloResumed`，以及来自设备的 `fetch_agents`、`project.list`、`fetch_workspaces` 和 `client_heartbeat` 控制 RPC。一次 relay socket 短暂断开后，同一 session 在约 12 秒内、90 秒 grace window 内恢复；项目与工作区投影也完成了创建和同步。默认开发 daemon 仍保持 `.paseo-dev`、`127.0.0.1:6877` 与 `--no-relay`。
- 修正 `AgentManager.emitLiveTimelineItem()`：未持久化的 live timeline stream event 现在带当前 `epoch`，但仍不带 `seq`，避免客户端把 provisional event 误判为可 replay 的已提交 row。
- 在 coalescing 回归中断言该 event 有 `epoch`、无 `seq`，且 timeline store 仍为空；daemon reconnect contract E2E 因此覆盖该恢复边界。
- 复核 Codex provider 的 command、file-change、approval、request-user-input、turn diff 与 token usage 投影。canonical 和 legacy turn diff 均只在 turn 完成时写入一张最新 diff 卡，避免重复持久化中间快照。

验证：

```bash
cd upstream/paseo
npx vitest run packages/server/src/server/daemon-e2e/timeline-reconnect-contract.e2e.test.ts --bail=1
npx vitest run packages/server/src/server/agent/agent-manager-stream-coalescing.test.ts --bail=1
npm run typecheck --workspace=@getpaseo/server
```

结果：修改前 reconnect contract 为 1/2 通过，缺少 provisional event 的 `epoch`；修改后 reconnect contract 2/2、coalescing 26/26 通过，server typecheck 退出状态为 0。完整 provider suite 连同 reconnect/coalescing 为 175/175；turn diff 定向套件为 canonical/legacy 2/2。

下一步：继续验证 QR 相机/输入配对、多设备、完整双向消息、agent/timeline stream、后台终端、Wi-Fi/4G 或飞行模式切换、replay overflow、审批 UI、iOS 和 hosted TLS relay；不把 Android 控制会话外的场景提前标记为完成。

## 2026-08-27 — E2EE Relay DaemonClient 重连与 Timeline 追赶

完成：

- 在 `relay-transport.e2e.test.ts` 增加真实 E2EE `DaemonClient` 重连用例：终止底层 WebSocket，在断线期间提交一条 timeline row，重连后按保存的 cursor 追赶且断言 `reset`、`staleCursor`、`gap` 均为 false。
- 重连后重新建立 timeline 订阅，断言 provisional live event 保持同一 `epoch`、不带 `seq`，并且只投递一次。
- relay 测试改用模块相对的 Wrangler 入口和 relay 目录，避免从不同工作目录运行时依赖 `npx` 或错误的相对路径。
- `scripts/verify-relay.sh` 现在包含该本地 reconnect/replay 用例；验证仍使用临时 home、workdir、relay 和随机端口。

验证：

```bash
cd upstream/paseo/packages/server
FORCE_RELAY_E2E=1 ../../node_modules/.bin/vitest run src/server/daemon-e2e/relay-transport.e2e.test.ts --maxWorkers=1 -t "E2EE relay client reconnects"

cd ../../..
FORCE_RELAY_E2E=1 upstream/paseo/node_modules/.bin/vitest run upstream/paseo/packages/server/src/server/daemon-e2e/relay-transport.e2e.test.ts --config upstream/paseo/vitest.config.ts --maxWorkers=1 -t "E2EE relay client reconnects"
```

结果：以上两个工作目录命令均为 1/1 通过；完整 `relay-transport.e2e.test.ts` 为 5/5 通过。该证据覆盖本地 E2EE socket 断线、cursor 追赶和 provisional 去重，不覆盖移动网络切换或 replay overflow。

下一步：继续验证 QR 相机/输入配对、多设备、完整双向消息、Wi-Fi/4G 或飞行模式切换、replay overflow、审批 UI、iOS 和 hosted TLS relay。

## 2026-08-27 — Android relay worker 恢复观察

完成：

- 在隔离 relay worker 已停止时冷启动实体 Android；设备从持久化 registry 恢复工作区路由，并在保存的 relay host 未恢复时保持加载状态。
- 恢复 loopback Wrangler relay 后，隔离 daemon 自动恢复 control/data channel，Android 以已持久化 client id 发送新的 relay `hello`。
- Android 随后恢复显示 host 上已有的 agent 与 timeline。该 agent 的 provider 调用返回 `502 Bad Gateway`，因此该证据只覆盖 agent/timeline 投影恢复，不代表成功 assistant 回复或 Android-originated 消息。
- 默认开发 daemon 仍保持 `.paseo-dev`、`127.0.0.1:6877` 和 `--no-relay`；测试继续使用独立 home、daemon `127.0.0.1:6878` 和 relay `127.0.0.1:8789`。

验证：

```bash
systemctl --user is-active chw-device-relay.service
ss -ltnp | rg ':8789\\b'
jq -rc 'select(.msg == "relay_control_connected" or .msg == "relay_data_connected" or .msg == "Client connected via hello") | [.time,.msg,.transport,.clientId,.sessionId,.resumed] | @tsv' /tmp/chw-device-relay-rLvkqD/daemon.log
node upstream/paseo/packages/cli/bin/paseo agent inspect 90595565-6750-4ab9-ac6e-b108ff4a419c --host 127.0.0.1:6878 --json
```

结果：relay service 为 `active`，`127.0.0.1:8789` 有 `workerd` listener；daemon 记录 control/data 连接和 Android `hello`。测试 agent 为 `error`，日志中的上游响应为 `502 Bad Gateway`。不扩大为 QR/输入配对、移动端出站消息、成功双向对话、网络切换、overflow、iOS 或 hosted TLS 的验收。

## 2026-08-27 — Rust Replay Overflow 边界回归

完成：

- 在 `crates/codex-bridge/tests/concurrent_transport.rs` 增加默认 replay 容量的真实 JSONL transport 回归。fake app-server 在已初始化连接上发送 2049 个 `turn/updated` 通知，再回送 request response，确保 reader 已处理完整事件流。
- 测试断言 cursor `0` 触发 `reset_required`，窗口只保留 sequence `2..=2049` 的 2048 条事件；cursor `1` 正好处在可恢复窗口边界，不触发 reset。

验证：

```bash
cargo test -p codex-bridge --test concurrent_transport
cargo test -p codex-bridge
./scripts/verify-rust.sh
```

结果：定向 transport 测试 2/2 通过；完整 `codex-bridge` 测试通过，5 个需要真实 Codex 账户或模型 turn 的集成测试保持 ignored；完整 Rust 门禁还通过 workspace、默认 OMP fallback 和 `omp-walker` feature 测试。该回归证明 Rust bridge 的有界 replay/reset 语义，不替代 Android/iOS 在真实断网、relay 重连后收到 reset 并重新加载完整 transcript 的验收。

下一步：在可用实体设备上执行 QR/输入配对、多设备、完整双向 agent/timeline stream、Wi-Fi/4G 或飞行模式切换、overflow 后客户端完整刷新、审批 UI、iOS 和 hosted TLS relay 验收。

## 2026-08-27 — E2EE Relay 终端字节流契约

完成：

- 在 `relay-transport.e2e.test.ts` 增加真实 E2EE `DaemonClient` 终端回归：通过临时本地 Wrangler relay 创建 terminal、订阅 slot、发送二进制 input/resize frame，并接收二进制 output frame 与终止事件。
- echo 子进程的 input 使用真实 `\r` 提交 PTY 的规范模式行；字面量 `\\r` 不会交给子进程，因此该测试能覆盖终端输入的实际字节路径。
- 用例在发送 input 前等待初始 terminal snapshot。否则 relay 冷启动时，输入可能在 snapshot 尚未完成时到达，输出会被合并进 snapshot 而不再产生独立 live output frame，造成测试误报超时。
- resize 断言落到 daemon terminal state，随后 `kill_terminal_request` 与 `terminal_stream_exit` 验证终止控制面。
- `scripts/verify-relay.sh` 已纳入该隔离用例；它仍使用临时 home、workdir 和随机 loopback relay 端口。

验证：

```bash
cd upstream/paseo
FORCE_RELAY_E2E=1 npx vitest run packages/server/src/server/daemon-e2e/relay-transport.e2e.test.ts -t "E2EE relay client creates" --bail=1
FORCE_RELAY_E2E=1 npx vitest run packages/server/src/server/daemon-e2e/relay-transport.e2e.test.ts --maxWorkers=1
npm run lint -- packages/server/src/server/daemon-e2e/relay-transport.e2e.test.ts
npm run typecheck --workspace=@getpaseo/server
cd ../..
./scripts/verify-relay.sh
```

结果：relay terminal E2E 为 1/1 通过，完整 relay transport suite 为 6/6 通过；wrapper 中 crypto 3/3、pairing 1/1、reconnect 1/1、terminal 1/1 全部通过。目标 lint 为 0 errors、0 warnings，server typecheck 退出状态为 0。该证据覆盖 daemon 与 E2EE relay 的 terminal transport，不替代 Web/Android/Desktop terminal UI、移动端终端可用性、网络切换或多设备验收。

下一步：继续 QR/输入配对、多设备、双向 agent/timeline、设备 terminal UI、网络切换、移动端 replay overflow 完整刷新、iOS 和 hosted TLS relay 验收。

## 2026-08-27 — 已发布 Custom Provider 设置入口

完成：

- Settings > Providers 不再只显示 Codex；它保留 Codex，并显示 provider snapshot 中 `source: "custom"` 的条目。
- 已发布 custom provider 复用既有的 `ProviderDiagnosticSheet`，因此可查看状态、刷新诊断并管理附加模型；内置 provider 即使被显式 override 也不会因这次 UI 改动出现。
- 新增界面回归覆盖 Codex、builtin Claude 与 custom ZAI 同时出现在 snapshot 时，只显示 Codex/ZAI，且点击 ZAI 打开对应 provider 设置。

验证：

```bash
cd upstream/paseo
./node_modules/.bin/vitest run packages/app/src/screens/settings/providers-section.test.tsx --maxWorkers=1
npm run lint -- packages/app/src/screens/settings/providers-section.tsx packages/app/src/screens/settings/providers-section.test.tsx
npm run typecheck --workspace=@getpaseo/app
```

结果：界面测试 5/5 通过；目标 lint 为 0 warnings、0 errors；app typecheck 退出状态为 0。该结果验证 custom provider 的可见性和诊断入口；后续配置生命周期实现见下一节。

下一步：保持 M2 的实体设备配对、双向 relay、网络切换和完整 transcript 刷新验收为最高优先级，同时完成 provider 配置生命周期的真实浏览器验收。

## 2026-08-27 — Custom Provider 配置生命周期与热更新

实现：

- Settings > Providers 已支持新建和编辑 OpenAI-compatible、Anthropic-compatible、ACP 三类 custom provider。
- Custom provider 支持启用、停用和删除；Codex 继续作为 required provider，UI 和 daemon 配置边界均不允许停用或删除 Codex。
- 保存配置后会触发 daemon 配置 reload 和 provider snapshot 刷新；新增、编辑、启停和删除均不依赖 daemon 进程重启。
- JSON 配置文件继续作为高级配置入口，但已不再是 custom provider 管理的唯一方式。

验证状态：真实浏览器 provider 生命周期 E2E 已通过。用例覆盖 OpenAI-compatible provider 的新建、编辑（含留空密钥保留）、停用、重新启用和删除，并覆盖 Anthropic API key、Anthropic auth token、ACP（含带空格参数）配置及删除路径；Codex required 约束、reload 后持久化状态和 daemon 进程稳定性均通过验证。全过程收到 117 个 WebSocket 帧，未发现凭证泄漏（0 次）；移动视口 `390×844` 无横向溢出。完整记录见 `verification/custom-provider-lifecycle-20260827/VERIFICATION.txt`。

下一步：完成 Android/iOS 真机上的 provider 列表、表单和生命周期验收；补充浏览器错误反馈、配置操作时间和保存成功率指标，并继续并发修改、会话连续性和重复更新稳定性验证。

## 2026-08-28 — Reload 失败原子回滚

完成：

- `DaemonConfigStore.reload()` 现在把持久化配置和 live owner 应用视为同一事务；任一 owner 拒绝新状态时，已应用的 owner、内存配置和上一次成功配置会一起恢复。
- reload 失败会恢复 `config.json` 到最近一次成功应用的持久化快照，避免后续 reload 持续重试已拒绝的配置。
- 新增回归覆盖 owner 已变更后由后续 owner 抛错的回滚顺序，并确认回滚不会发出提交后的变更通知。

验证：

```bash
cd upstream/paseo
npx vitest run packages/server/src/server/daemon-config-store.test.ts packages/server/src/server/agent/mutable-provider-config-owner.test.ts --bail=1
```

结果：`Test Files 2 passed (2)`、`Tests 41 passed (41)`，退出状态为 0；新增 reload 回滚用例确认 live owner、内存 `browserTools.enabled` 和持久化配置均恢复到 reload 前状态。独立基线/修改版复现、哈希、回滚副本和精确输出见 `verification/reload-rollback-20260828/VERIFICATION.txt`；provider 生命周期证据仍见 `verification/custom-provider-lifecycle-20260827/VERIFICATION.txt`。

边界：多客户端并发修改、版本冲突、活跃会话连续性、长时间重复更新压力测试和 reload 失败日志审计仍待完成；reload 失败原子回滚本身已验证。

补充稳定性回归：发现 `onChange` 同步嵌套 patch 会被外层操作末尾的
`lastKnownPersisted` 赋值覆盖，导致后续 reload 把已经应用的嵌套字段误报为外部修改。
现已在 `patch()` 和 `reload()` 应用 live owner 前推进持久化基线，并在失败时恢复旧基线；
`verification/reentrant-config-20260828/VERIFICATION.txt` 的基线/修改版复现分别得到
`override=daemon.autoArchiveAfterMerge` 与 `override=none`，回滚副本恢复基线哈希。

当前仍未提供协议级 `expectedRevision`/CAS；同一 daemon 内的同步 RPC 会串行执行，但多个
客户端基于旧快照提交整段数组时仍可能发生最后写入覆盖。该项与活跃会话连续性、重复更新
压力和失败日志审计一起保留为后续工作。

## 2026-08-27 — Codex CLI 默认新建页浏览器验收

完成：

- 新增 `new-workspace-default-terminal.spec.ts`，以 daemon 默认 terminal profiles 启动真实 Paseo Web 客户端，确认首次进入 New Workspace 时已选中 `Codex CLI` terminal，而非 chat。
- 回归确认 terminal prompt 可编辑、chat 附件控件未出现，launcher menu 的 `codex` 项语义选中且保留 `codex --no-alt-screen` 预设。
- 测试不点击 Launch，因此不依赖真实 Codex 账号或模型；终端实际启动、输入输出、resize 与终止仍由 relay terminal transport E2E 覆盖。

验证：

```bash
cd upstream/paseo
npx playwright test --config packages/app/playwright.config.ts --project=browser \
  packages/app/e2e/browser/new-workspace-default-terminal.spec.ts --workers=1
npm run lint -- packages/app/e2e/browser/new-workspace-default-terminal.spec.ts
npm run typecheck --workspace=@getpaseo/app
```

结果：浏览器 E2E 为 1/1 通过；目标 lint 为 0 errors、0 warnings；app typecheck 退出状态为 0。该结果验证新建页默认 launcher UI，不替代 Web/Desktop/Android 的终端交互、远端连接、设备布局或网络恢复验收。

下一步：将浏览器客户端接入本地 Wrangler relay，继续 QR/输入配对、多设备、双向 agent/timeline、终端 UI、网络切换、iOS 和 hosted TLS relay 验收。

## 2026-08-27 — 真实 Paseo Web Relay 终端与部署重连验收

完成：

- 真实 Paseo Web 通过 packaged daemon 和本地 Wrangler E2EE relay 创建并订阅 terminal；浏览器输入、PTY 输出和 resize 均完成端到端验证。
- 浏览器 WebSocket 观察未发现直连 daemon 的连接；relay wire 中三个被检查的终端明文 `RELAY_WEB_TERMINAL_READY`、`relay-browser-input`、`RELAY_WEB_INPUT:relay-browser-input` 均未出现。该断言仅覆盖这三个探针值，不扩大为全部流量审计。
- 真实 Paseo Web 在受控 relay deployment 期间暂停 stream、保留 running 状态，并在 relay 恢复后无需用户操作继续；该浏览器证据与 Node `DaemonClient` terminal 契约分开记录。
- 新页面默认打开 Codex CLI 的 `1/1 browser E2E` 是独立验证，不计入本节正式 relay deployment 套件的两条用例。
- 新增独立 Linux `relay-browser-e2e` CI job：固定 `paseo-relay` 提交 `3fc41c96c8c63f3a7109e832899cc57d473c4531`、OTP `29.0.3` 与 Elixir `1.20.2`，并执行同一正式命令；普通 browser 分片保持不变。

正式验证：

```bash
PASEO_RELAY_CHECKOUT=/tmp/paseo-relay npm --prefix packages/app run test:e2e:relay-deployment
```

结果：

```text
2 passed (40.4s)
```

同一命令的前一次通过观测为 `2 passed (41.4s)`，对应
`reconnectToastDelayMs=1328`、`reconnectToastVisibleMs=5006`、
`totalReconnectMs=6334`、`relayStartupMs=427`；上方及下方状态采用最终复跑值。

重连观测值：

```text
reconnectToastDelayMs=1331
reconnectToastVisibleMs=5112
totalReconnectMs=6443
relayStartupMs=533
streamPausedWhileDisconnected=true
runningStatePreserved=true
streamResumedWithoutUserAction=true
```

边界：本节验收的是 Web relay terminal 与受控 relay deployment 路径。Android 仍只有既有的部分 relay 控制/恢复证据；Desktop、iOS、hosted TLS relay、Wi-Fi/4G 网络切换、移动 terminal UI、QR/输入配对、多设备和移动 replay overflow 均未完成。

下一步：继续完成 Android/Desktop/iOS 客户端的 terminal 与重连验收，并覆盖 hosted TLS、真实移动网络切换、配对、多设备和移动 replay overflow 后的完整刷新。

## 2026-08-28 — Android Provider 表单验收后端断言

完成：

- 加强 `packages/app/maestro/test-provider-forms-android.sh`：Maestro 取消自定义 provider 表单后，脚本查询隔离 daemon 的 `provider ls --json` 快照，并断言没有写入 provider，只保留必需的 `codex`。
- 将 daemon 与快照查询固定到脚本解析出的 Paseo fork `REPO_ROOT`，从仓库根目录运行时不会误用 registry/cache CLI。
- 将 `provider-after.json` 和命令 stderr 保留到测试产物目录，便于真机失败复盘；继续使用随机端口、临时 `PASEO_HOME` 和退出时清理 `adb reverse`。
- 更新 Android Maestro 契约检查和运行说明，确保表单可达性与取消后的持久化状态都具备可审计证据。

验证：

```bash
cd upstream/paseo
bash packages/app/maestro/test-provider-forms-android.sh --check
bash -n packages/app/maestro/test-provider-forms-android.sh
node packages/app/maestro/check-provider-forms-android.mjs
npx oxfmt --check packages/app/maestro/README.md packages/app/maestro/provider-forms-android.yaml packages/app/maestro/check-provider-forms-android.mjs packages/app/maestro/test-provider-forms-android.sh
npx vitest run packages/app/src/screens/settings/custom-provider-form.test.ts packages/app/src/screens/settings/custom-provider-edit-sheet.test.tsx packages/app/src/screens/settings/providers-section.test.tsx --maxWorkers=1
npm run typecheck --workspace=@getpaseo/app
```

结果：Android provider 契约 2/2、格式检查通过；共享 Provider 定向测试 `Test Files 3 passed (3)`、`Tests 23 passed (23)`；app typecheck 退出状态为 0。当前 `adb devices -l` 无设备，Maestro/agent-device/Android emulator 均不可用，故真机表单运行仍待设备恢复。

下一步：设备可用后执行 `PASEO_MAESTRO_SERIAL=<serial> bash packages/app/maestro/test-provider-forms-android.sh`，核验截图、logcat、`provider-after.json` 以及实际 Android Settings 交互。

## 2026-08-29 — G0–G2 保全与版本文档勘误，配置 CAS 单测

完成：

- 在仓库外归档 `upstream/paseo` 工作区（不含可重建的 `node_modules`），再提交子模块剩余源码与测试。Paseo HEAD 为 `84acf5a`，祖先为 `b5f5832`；未向 `getpaseo/paseo` 推送。
- 父仓库提交记录 gitlink `84acf5a65897a0c8cece2d0bdb323fe73edd03a4` 与 G2 勘误。`git ls-files` 不含 `paseo-dev`；未添加 parent remote。
- 删除 VERSION_* 文档中虚构的「已发布」v0.5.0 / v0.6.0-alpha.1 记录；`scripts/release.sh` 不再静默改根 `version`，也不再调用缺失 helper；父 CI 只调用 `upstream/paseo/package.json` 中存在的 npm 脚本。
- Daemon config store 对 stale `expectedRevision` 拒绝写入、对匹配 revision 接受写入；对应 vitest 覆盖 shipped store 与 `paseo-config-file` 路径。

验证：

```bash
git -C upstream/paseo status --short --untracked-files=all
git -C upstream/paseo log --oneline -3
git log --oneline
git ls-files | grep -c paseo-dev
git submodule status
bash -n scripts/release.sh
grep -rn "已发布\|v0\.6\.0-alpha" docs/VERSION_*.md
cd upstream/paseo
npx vitest run packages/server/src/server/daemon-config-store.test.ts packages/server/src/utils/paseo-config-file.test.ts --maxWorkers=1
adb devices -l
command -v maestro
```

结果：Paseo 工作树干净；`84acf5a` / `e9ff317` / `b5f5832`。父仓库 `f0dd191` 记录 gitlink 与勘误，`paseo-dev` 计数为 0。`bash -n scripts/release.sh` 退出 0；VERSION_* 无虚构发布记录；四个缺失 helper 名在 `scripts/` 与 `.github/` 中无引用；`ci.yml` 的 `npm run lint` / `build:server`（及 release.sh 的 `build:daemon-web-ui`）均存在于 `package.json`。vitest 连续两次均为 `Test Files 2 passed (2)`、`Tests 49 passed (49)`。`adb devices -l` 显示 `10AE6J03LC001JL`，但 `maestro` 不在 PATH。

边界：未创建 GitHub fork，未向 Paseo `origin` 推送。Android Maestro 真机 provider 生命周期、QR/手动配对、多设备、完整聊天投递、Wi-Fi/4G 切换、replay overflow 恢复、iOS 配对、hosted TLS relay 仍为待验。未改 `config/paseo.dev.json` 打开 relay。未改 STATUS.md / MASTER_PLAN.md。

下一步：用户提供 fork 地址后再推送 `codex-harness-workbench`；安装 Maestro 后用 `PASEO_MAESTRO_SERIAL=10AE6J03LC001JL bash packages/app/maestro/test-provider-forms-android.sh` 跑真机表单。

## 2026-08-29 — NEXT_GOALS_R2 H2 文档勘误；H1/H3 待授权

完成：

- `STATUS.md` 去掉无 tag 支撑的「当前版本：v0.5.0 (Alpha)」，改为「无发布 tag（pre-tag）」；预计 Alpha 发布日期仍为 2026-09-10。
- `docs/IMPLEMENTATION_SUMMARY.md` 将「当前无在线设备」改为设备 `10AE6J03LC001JL`（V2352A）已接入、Maestro 未安装。
- `docs/NEXT_GOALS.md` 增加状态头：G0–G2 已完成，后续见 `docs/NEXT_GOALS_R2.md`。

待验：

- H1 远端备份：`gh` 已登录 `ewo3344`，协议为 SSH，但 `ssh -T git@github.com` 为 `Permission denied (publickey)`；token 无 `workflow` / `admin:public_key`；父仓库无 remote、无用户选定的仓库名与可见性。未推送、未生成密钥、未 refresh scope。
- H3 Android Maestro 真机脚本：`adb devices -l` 显示 `10AE6J03LC001JL`，`maestro` 不在 PATH；未安装 Maestro，未运行 `test-provider-forms-android.sh`。

验证：

```bash
grep -n "v0\.5\.0" STATUS.md
grep -n "当前无在线设备" docs/IMPLEMENTATION_SUMMARY.md
sed -n '1,8p' docs/NEXT_GOALS.md
gh auth status
ssh -T git@github.com
git remote -v
git -C upstream/paseo remote -v
git -C upstream/paseo branch --show-current
adb devices -l
command -v maestro
git tag -l
git ls-files | grep -c paseo-dev
```

结果：STATUS.md 无 `v0.5.0`；IMPLEMENTATION_SUMMARY.md 无「当前无在线设备」；NEXT_GOALS.md 状态头指向 NEXT_GOALS_R2.md。SSH `Permission denied (publickey)`；Paseo `origin` 仍为 `https://github.com/getpaseo/paseo.git`，无 `fork` remote。`maestro` 不在 PATH。`git tag` 为空；`paseo-dev` 计数为 0。

边界：未向 `getpaseo/paseo` 推送。未改 `config/paseo.dev.json` 打开 relay。未把 RELAY_VALIDATION 未证明项标为完成。未安装 Maestro、未 `gh auth refresh`。H4 产品剩余项未做。

下一步：用户选定父仓库名与可见性并完成 SSH 密钥或 `workflow` scope 后执行 H1；批准安装 Maestro 后执行 H3。

## 2026-08-29 — NEXT_GOALS_R3 J1 公开远端；J2 Maestro 真机待验

完成：

- 将 `gh` git 协议切到 HTTPS 并配置 `gh auth git-credential`。父仓库公开仓 `https://github.com/ewo3344/codex-harness-workbench.git` 已创建并推送 `main`。
- 为 `ewo3344` 创建 `getpaseo/paseo` fork；仅向 `fork` 推送 `codex-harness-workbench`（`84acf5a`）。本地检出该分支并跟踪 `fork/codex-harness-workbench`，`main` 回到 `origin/main`（`b5f5832`）。
- 安装 Maestro：来源 `https://get.maestro.mobile.dev`（`curl -fsSL | bash`），版本 `2.9.0`，二进制 `$HOME/.maestro/bin/maestro`。

待验：

- J2 Android 真机 provider 表单：设备 `10AE6J03LC001JL` 在线，已运行 shipped `test-provider-forms-android.sh`。隔离 daemon 以 `--no-relay` 启动且 `/api/health` 为 ok，但 Maestro 安装 driver APK 时 `INSTALL_FAILED_ABORTED: User rejected permissions`；随后 `adb install -r -g` 同样失败。无 `provider-after.json`，取消后仅 `codex` 的断言未跑成。不是 `--check` 通过，也不是模拟器替代。

验证：

```bash
gh auth status
git remote -v
git log origin/main --oneline -1
git -C upstream/paseo remote -v
git -C upstream/paseo branch --show-current
git -C upstream/paseo rev-parse --abbrev-ref '@{upstream}'
git -C upstream/paseo status --short
git ls-files | grep -c paseo-dev
adb devices -l
$HOME/.maestro/bin/maestro --version
PASEO_MAESTRO_SERIAL=10AE6J03LC001JL bash packages/app/maestro/test-provider-forms-android.sh
```

结果：token scopes 含 `workflow`；父 `origin` 为 `ewo3344/codex-harness-workbench`；Paseo `origin` 仍为 `getpaseo/paseo`，`fork` 为 `ewo3344/paseo`；当前分支 `codex-harness-workbench` 跟踪 `fork/codex-harness-workbench`。`paseo-dev` 计数 0。Maestro `2.9.0`。真机脚本因 USB 安装权限被拒退出 1。

边界：未向 `getpaseo/paseo` 推送。未改 `config/paseo.dev.json` 打开 relay。未把 RELAY_VALIDATION 未证明项标为完成。J3 未做。

下一步：在设备上点允许 Maestro driver APK 安装后重跑 J2；K3 按 MASTER_PLAN 剩余项。

## 2026-08-29 — NEXT_GOALS_R4 K1 配置并发：CAS 拒绝同 provider 覆盖

完成：

- 探针 `k1-gap-probe.test.ts` 基线为 **1 failed / 2 passed**。失败用例：两客户端各改同一 provider 的不同字段且省略 revision 时，后写入把 A 的 `label: "Alpha renamed by A"` 还原为 `"Alpha"`，B 的 `description` 生效。另两例通过：不同 key 新增互不丢失；省略 revision 绕过 CAS。
- 将三例整理合入 `daemon-config-store.test.ts` 后删除探针。同 provider 用例改为双方携带同一 snapshot 的 `expectedRevision`：先写成功，后写抛 `DaemonConfigRevisionConflictError`，A 的字段保留。未做 per-provider deep-merge，也未把 provider map 改成整表替换。
- `useDaemonConfig.patchConfig` 已把上次读取的 revision 传给 `patchDaemonConfig`；冲突时抛 `DaemonConfigConflictError`（提示 reload 后重试）。Providers 保存路径把该错误显示在表单/操作错误上并保持用户输入。协议层 `expectedRevision` 仍为 optional。

验证：

```bash
test ! -f packages/server/src/server/k1-gap-probe.test.ts
npx vitest run packages/server/src/server/daemon-config-store.test.ts \
  packages/server/src/utils/paseo-config-file.test.ts --maxWorkers=1
npx vitest run packages/app/src/hooks/use-daemon-config.test.tsx --maxWorkers=1
npm run typecheck --workspace=@getpaseo/app
npm run lint -- packages/server/src/server/daemon-config-store.test.ts \
  packages/app/src/hooks/use-daemon-config.ts \
  packages/app/src/hooks/use-daemon-config.test.tsx \
  packages/app/src/screens/settings/providers-section.tsx
```

结果：探针文件已删除。store + config-file 连续两次均为 `Test Files 2 passed (2)`、`Tests 52 passed (52)`（基线 49，新增 3 例且同 provider 用例由失败转为通过）。hook 测试 3 passed。app typecheck / lint / oxfmt 退出 0。

边界：未把 `expectedRevision` 改为 required。未改 Codex required / 审批 / API key 语义。未开 relay。K2 Maestro 真机、K3 Desktop reconnect、K4 rewind E2E 未做。

下一步：用户在手机上点允许 driver 安装后跑 K2；然后 K3。

## 2026-08-29 — NEXT_GOALS_R4 K2 Android Maestro 真机待验

完成（安装与 harness，非表单断言）：

- 从 `~/.maestro/lib/maestro-client.jar` 抽出 `maestro-app.apk` / `maestro-server.apk`，`adb install -r`（无 `-t`）。设备 `10AE6J03LC001JL` 上 `dev.mobile.maestro` 与 `dev.mobile.maestro.test` 已装上。
- 选择 **(c) Metro**：`sh.paseo.debug` 是 Expo DevLauncher，`launchApp` 在 Metro 不可达时卡在 `DevLauncherActivity`。未做 release APK（a），也未把 flow 步骤挪到 `launchApp` 之前（b）。
- harness 增加 Metro `8081` 的 `adb reverse`、`--no-reinstall-driver`；flow 使用 `clearState: false`、`stopApp: false`；`android-dev-client.yaml` 打开 `exp+voice-mobile://expo-development-client/?url=http://127.0.0.1:8081`，BACK 关掉 Expo tools overlay。
- 会话结束后 `pm list packages` 仍有两个 Maestro 包，未再弹 Vivo 安装框。

待验：

- 已跑 shipped `test-provider-forms-android.sh`（隔离 `PASEO_HOME`、随机端口、`--no-relay`）。无 `provider-after.json`，取消后仅 `codex` 的断言未跑成。
- 失败为 `DeviceServerDiedException` / gRPC `UNAVAILABLE`（`launchApp` 期间 Maestro device server 套接字关闭）。不是 120s `DEADLINE_EXCEEDED`。`--check` 通过不算真机通过。

验证：

```bash
export PATH="$HOME/.maestro/bin:$PATH"
adb -s 10AE6J03LC001JL shell pm list packages | grep -i maestro
bash packages/app/maestro/test-provider-forms-android.sh --check
PASEO_MAESTRO_SERIAL=10AE6J03LC001JL \
PASEO_MAESTRO_ARTIFACTS_DIR=/tmp/grok-goal-92fae40bca6f/implementer/android-run4 \
bash packages/app/maestro/test-provider-forms-android.sh
```

结果：两个 Maestro 包仍在。`--check`：`provider-forms-android contract: OK`。run4 `SCRIPT_EXIT=1`，`provider-after.json MISSING`；Maestro log：`Device server died during 'launchApp'`。Driver 安装本身已通过。

边界：未向 `getpaseo/paseo` 推送。未改 `config/paseo.dev.json` 打开 relay。未把 `expectedRevision` 改为 required。未声称 QR/配对/完整聊天/iOS/hosted TLS relay 已完成。

下一步：K3 Desktop relay-terminal reconnect。K2 需在 Maestro `launchApp` 不再弄死 Vivo device server 后重跑 shipped 脚本。

## 2026-08-29 — NEXT_GOALS_R4 K2 诊断修正：交互挂死，非安装、非杀进程、非 app

推翻两个假设（证据，不改 harness 安装路径）：

1. **不是 Vivo 杀进程。** 三个包（`sh.paseo.debug`、`dev.mobile.maestro`、`dev.mobile.maestro.test`）doze 白名单无效。失败为 **`120002ms since last byte` 且连接仍 open**——操作挂住，不是 device server 死亡。先前把 `DeviceServerDiedException` 当成「Vivo 杀了 driver」是误诊。
2. **不是 app 的问题。** 不含 `launchApp` 的 flow 中 **`assertVisible` COMPLETED，紧接的 `tap` 挂 120s**。只读通、交互挂 → UIAutomator **`waitForIdle` 不返回**。关闭设备三项动画后更糟（`viewHierarchy` 也 **UNAVAILABLE**）。因此路线 **(a) release build 不解决此问题**。

J2 / K2 仍为 **待验**：没有 `provider-after.json`，取消后仅 `codex` 的断言从未跑成。阻塞已从「再点一次安装框」精确到 **「Maestro driver 在 Android 16 上的交互操作不可用」**。安装与 `--no-reinstall-driver` 仍成立，不再当作 blocker。Driver 未因本轮诊断被重装或从 harness 拿掉。

下一步优先级（本轮先做 1）：(1) 换 Maestro 版本（2.9.0 与 Android 16 兼容性存疑）；(2) 若仍不行，评估直接 uiautomator/Appium，或该 flow 降级模拟器并标注 **非真机**；(3) 向 Maestro 上游报告 `DEADLINE_EXCEEDED` + 连接 open 的特征。

版本试验（2.9.0 已是 GitHub 最新，故试上一稳定版 **2.8.0**；从 `cli-2.8.0` 源码 `installDist`，Java 17，未覆盖 `~/.maestro` 的 2.9.0）：

- 最小 flow（无 `launchApp`）：`assertVisible` COMPLETED，`tapOn` COMPLETED，exit 0。
- shipped `test-provider-forms-android.sh`（serial `10AE6J03LC001JL`，隔离 `PASEO_HOME`，随机端口，`--no-relay`）：仍无 `provider-after.json`。`launchApp` 失败为 **`120002ms since last byte`**、`DEADLINE_EXCEEDED`、**连接仍 open**（`open=[[remote_addr=/127.0.0.1:46645]]`）。
- 会话后两个 Maestro 包仍在。`--no-reinstall-driver` 未改。`--check` 不算真机通过。

J2 / K2 仍 **待验**。2.8.0 证明只读+点按可以完成，但 shipped 路径的 `launchApp` 仍是 Android 16 上 120s 挂死；不是「再点一次安装框」。

下一步（2.8.0 未打通 shipped 真机）：评估直接 uiautomator/Appium，或该 flow 降级模拟器并明确标注 **非真机**；向上游报告 `DEADLINE_EXCEEDED` + 连接 open（`120002ms since last byte`）。

## 2026-08-29 — NEXT_GOALS_R4 K2：2.8.0 固定路径 + adb 启动/点 8081，仍待验

完成（harness，非表单断言）：

- Maestro **2.8.0** 重建到固定路径 `$HOME/.maestro-2.8.0/`（未覆盖 `~/.maestro` 的 2.9.0）。构建：`git clone --depth 1 --branch cli-2.8.0`，`JAVA_HOME=/usr/lib/jvm/java-17-openjdk`，Gradle 8.14.3 `:maestro-cli:installDist -x test`，复制 `bin/`+`lib/`。harness 在该 binary 存在时把它 prepend 到 PATH。
- flow 去掉 Maestro `launchApp` / `stopApp` / `clearState`。`clearState: true` 会 `pm clear` 杀掉 device server（YAML 注释已记）；`stopApp` 同类，未再用。harness 用 `adb shell am start -n sh.paseo.debug/.MainActivity`（无 `am force-stop` / `pm clear`）。
- DevLauncher 不自动连，`expo-dev-launcher://` 不加载 bundle。`http://localhost:8081` 仍要点，但改由 harness `adb shell input tap`（uiautomator dump 取 bounds）。依据：2.8.0 对该行 `tapOn` **已点到** `(496, 798)`（TextView `clickable=false`，bounds `[238,764][755,832]`），行上出现 fetch 转圈，随后 post-tap `viewHierarchy` 挂 **120002ms**、连接仍 open。
- `--no-reinstall-driver` 未改。会话后 `dev.mobile.maestro` 与 `dev.mobile.maestro.test` 仍在。

动画缩放（本轮 2.8.0 真机结果包含此状态，未改回 1）：实测 `window_animation_scale=0`、`transition_animation_scale=0`、`animator_duration_scale=1.25`。用户记得三项都设成 0；第三项当时不是 0。Reanimated 日志有 reduced-motion 警告。

待验：

- shipped `test-provider-forms-android.sh`（serial `10AE6J03LC001JL`，隔离 `PASEO_HOME`，随机端口，`--no-relay`，Metro 8081 已在跑）。无 `provider-after.json`，取消后仅 `codex` 的断言未跑成。`--check` 不算真机通过。
- 去掉 `launchApp` 后：`assertVisible DEVELOPMENT SERVERS` COMPLETED；Maestro `tapOn http://localhost:8081` 点到后挂。
- 改 adb 点 8081 后：bundle 曾成功（Metro `Android Bundled`），app 到 welcome。Maestro `tapOn id: welcome-direct-connection` **COMPLETED**，下一步 `add-host-modal` 的 `viewHierarchy` 为 **UNAVAILABLE**（`Command failed (tcp:…): closed`，约 20s），failure 截图为黑屏。不是 `--check`，也不是模拟器。

这条「2.8.0 固定路径 + adb 启动 + adb 点 8081 + Maestro 跑剩余 assert/tap」已失败。下一步才是直接 uiautomator/Appium，或该 flow 降级模拟器并标注 **非真机**。J2 / K2 仍 **待验**。

验证：

```bash
$HOME/.maestro-2.8.0/bin/maestro --version   # 2.8.0
$HOME/.maestro/bin/maestro --version         # 2.9.0，未被覆盖
bash packages/app/maestro/test-provider-forms-android.sh --check
PASEO_MAESTRO_SERIAL=10AE6J03LC001JL bash packages/app/maestro/test-provider-forms-android.sh
adb -s 10AE6J03LC001JL shell pm list packages | grep -i maestro
adb -s 10AE6J03LC001JL shell settings get global window_animation_scale
adb -s 10AE6J03LC001JL shell settings get global transition_animation_scale
adb -s 10AE6J03LC001JL shell settings get global animator_duration_scale
```

边界：未向 `getpaseo/paseo` 推送。未改 `config/paseo.dev.json` 打开 relay。未把 `expectedRevision` 改为 required。未声称 J2 通过。未改动画缩放。未做 uiautomator/Appium 重写，也未降级模拟器。

## 2026-08-29 — NEXT_GOALS_R4 K2：半手动真机验收（UI 自动化仍未打通）

完成（harness，非表单断言）：

- `test-provider-forms-android.sh` 增加 `PASEO_MAESTRO_MANUAL=1`：起隔离 daemon、`adb reverse`、`pm enable` + `am start` 启动 app，然后暂停等操作者回车（无 TTY 则等 `$OUT_DIR/continue`），**跳过 Maestro**。之后仍跑既有 `provider ls --json` + `verify_cancel_did_not_persist_provider`。断言函数与调用块本身未改。
- `--check`：`provider-forms-android contract: OK`。README 已写半手动步骤。`--no-reinstall-driver` 未改。
- Maestro **2.8.0** 固定路径 `$HOME/.maestro-2.8.0/` 完好（194 个 jar，mtime 19:48）；`~/.maestro` 的 **2.9.0** 未被覆盖。会话后 `dev.mobile.maestro` 与 `dev.mobile.maestro.test` 仍在。

半手动跑（进行中，未收断言）：

- artifacts `$HOME/.maestro-2.8.0/android-run-k2-manual`。隔离 daemon `127.0.0.1:33969`、`--no-relay`。暂停截图 `manual-paused.png` 为 welcome（Direct connection / 扫描二维码 / 设置）。无 TTY，脚本等 `continue` 文件。**未创建 continue**（空取消会假通过）。无 `provider-after.json`。

`add-host-modal` 单独记录（排除「该机型 app modal 缺陷」）：

- 暂停时 dump 有 `welcome-direct-connection` / `welcome-screen`，**没有** `add-host-modal`。
- 非 Maestro：`adb shell input tap 630 1542`（Direct connection bounds `[84,1447][1176,1637]`）。随后 `uiautomator dump` **完整**（含 `</hierarchy>`），`resource-id="add-host-modal"`，截图 `add-host-modal-probe.png` 可见 Host / 端口 / 使用 SSL / 密码 / 取消 / 连接。
- **不是** 该机型上 app 打不开 modal。先前 Maestro `tapOn welcome-direct-connection` COMPLETED 后下一步 dump `UNAVAILABLE` / 黑屏，仍是 Maestro/UIAutomator 交互后 dump 挂死。手指未亲自点；adb tap 与手指同类。

Gradle 残留（失败的 2.8.0 rebuild 曾在 `/home/e` 跑 gradle）：

- `/home/e` 无 `settings.gradle*` / `build.gradle*` / `gradlew` / `build/`。只有正常 `~/.gradle` 缓存（daemon 8.14.3 等）。**不用清**。不要删 `~/.gradle`。

动画三项要恢复成 1（混合 `0 / 0 / 1.25` 会干扰后续判断）。实测 `adb settings put global … 1` 与 `cmd settings put global --user 0 … 1` 均 exit 0，读回仍是 `window_animation_scale=0`、`transition_animation_scale=0`、`animator_duration_scale=1.25`。Vivo 忽略 adb 写入。需在手机开发者选项里手动设。

待验：J2 / K2 仍 **待验**。没有 `provider-after.json`，取消后仅 `codex` 的断言从未跑成。这是半手动真机验收，UI 自动化仍未打通。`--check` 不算真机通过。只有半手动也失败（操作者完成 Settings → Providers → 自定义表单 → 取消后仍无有效 cancel 快照），才转 uiautomator/Appium 或标注 **非真机** 的模拟器。

验证：

```bash
bash packages/app/maestro/test-provider-forms-android.sh --check
$HOME/.maestro-2.8.0/bin/maestro --version   # 2.8.0
$HOME/.maestro/bin/maestro --version         # 2.9.0
ls "$HOME/.maestro-2.8.0/lib"/*.jar | wc -l  # 194
adb -s 10AE6J03LC001JL shell settings get global window_animation_scale
adb -s 10AE6J03LC001JL shell settings get global transition_animation_scale
adb -s 10AE6J03LC001JL shell settings get global animator_duration_scale
```

边界：未向 `getpaseo/paseo` 推送。未改 `config/paseo.dev.json` 打开 relay。未把 `expectedRevision` 改为 required。未声称 J2 通过。未创建 `continue`。未做 uiautomator/Appium 重写，也未降级模拟器。
