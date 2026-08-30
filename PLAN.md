# Codex Harness Workbench 重建计划

**档案**：决策 1–6 仍有效。M1 勾选里的「强制 Codex-only」是当时里程碑，不是当前发行策略。当前剩余工作见 [`docs/tasks.md`](docs/tasks.md)。

最后更新：2026-08-27

## 产品目标

把旧的“远程 PTY 查看器”重建为一个以 Codex 官方 harness 为核心、可从桌面和移动端完整操作的本地优先工作台。目标体验包括线程/回合、流式消息、工具调用、审批、diff、计划、登录、模型与配置、后台终端、断线重连、工作树和远程配对，而不再从终端 ANSI 输出反推状态。

项目工作名改为 **Codex Harness Workbench**。迁移期间保留目录名 `codex-remote-workbench`，避免破坏现有脚本和验证记录；完成可运行的 Paseo 客户端接入后再做一次原子目录改名。

## 已确认的技术决策

1. **Codex harness 是 Codex provider 的唯一 agent runtime。** 启动官方 `codex app-server`，使用 v2 双向 JSON-RPC；不 fork、复制或重写 Codex core。这不是「Paseo 只发布 Codex provider」：claude / copilot / opencode / pi 等已实现 builtin 可发行、可使用；Codex 仍是 required / 默认。不引入 OMP plugin/runtime。
2. **先复用 Paseo daemon，随后替换其基础设施为 Rust。** Paseo 0.5.0 已有成熟的 `CodexAppServerAgentClient`；先保留这一 adapter 获得完整可用链路，再将进程管理、事件存储、文件观察、终端和 relay transport 分模块迁到 Rust，避免一次性重写破坏功能。
3. **只择取 OMP 的底层能力。** 候选为 `pi-shell`、`pi-iso`、`pi-walker` 等 Rust crate。明确排除 OMP/Pi 的 provider、agent loop、prompt、plugin/extension 和 TUI 状态模型，避免出现两个 harness。
4. **Paseo fork 是产品接入面。** 复用其 iOS/Android/Web/Desktop、E2EE relay、配对、worktree、diff/review UI 和现有 Codex app-server adapter；默认关闭 Paseo 本地 plugin，不再继续扩展仓库内旧 Android 客户端。产品 builtin provider（claude / copilot / opencode / pi）与 opt-in 自定义 provider 可使用；Codex 仍 required。OMP/Pi plugin 不引入；Codex 自己通过 app-server 暴露的 `plugin/*`、`app/*`、`marketplace/*` 必须保留并最终做管理面。
5. **协议按 Codex 版本生成。** `protocol/codex-app-server-<version>/` 保存由当前二进制生成的 JSON Schema和 TypeScript 类型。daemon 在启动时记录并校验 Codex 版本，未知版本降级到透明转发而不是错误解析。
6. **许可边界明确。** Codex 为 Apache-2.0，OMP 为 MIT（含第三方 notices），Paseo 为 AGPL-3.0。若复用/修改 Paseo 代码，整个网络服务派生发布路径按 AGPL-3.0 合规；OMP crate 单独保留 attribution/notices。

## 目标架构

```text
Paseo mobile / desktop / web / CLI
                 │ Paseo WebSocket + E2EE relay
                 ▼
        Rust workbench daemon
        ├─ client auth / pairing / replay
        ├─ Paseo ↔ Codex event adapter
        ├─ thread + worktree projections
        ├─ optional OMP Rust primitives
        └─ supervised stdio JSONL
                 ▼
          codex app-server v2
                 ▼
 Codex core / auth / sandbox / tools / MCP / skills
```

关键原则：daemon 保存的是可重放的客户端投影和连接状态，Codex 线程历史仍由 app-server/Codex thread store 负责；审批请求必须保持双向关联，不能被转成普通日志。

## 分阶段实施

### M0 — 基线与协议（进行中）

- [x] 盘点旧 Go host、浏览器 UI、Android 客户端和验证资料。
- [x] 确认旧方案是 PTY 黑盒，不能覆盖桌面版语义。
- [x] 核对官方 app-server 是推荐的完整 harness 接入面。
- [x] 核对 OMP Rust crates 与 MIT 许可、Paseo 功能面与 AGPL-3.0 许可。
- [x] 从本机 `codex-cli 0.149.0` 生成稳定 API，以及包含 `thread/revert` 的 experimental JSON Schema 与 TypeScript 快照。
- [x] 建立 Git 基线，并以 submodule 固定 Paseo 上游 revision。
- [ ] 把旧实现移动到 `legacy/`（等新客户端覆盖 worktree/diff/终端与移动端回归后执行）。

### M1 — Rust Codex bridge

- [x] 实现 `codex app-server --stdio` 子进程监管和 initialize/initialized 握手原型。
- [x] 实现并发 request-id 路由、notification 广播、server request（审批/输入）回传原语。
- [x] 提供 thread list/read/start/resume/fork/archive/unarchive/delete 与 turn start/steer/interrupt 的薄 API；真实验证线程主生命周期。
- [x] 真实验证运行中 turn steer、active-turn interrupt 与 app-server 重启后 resume。
- [x] 把 Paseo rewind 从已弃用的 `thread/rollback` 迁到 experimental `thread/revert(beforeTurnId)`；保留同一 thread id，文件撤销继续作为独立 diff/revert 能力。
- [x] 支持事件序号、有限 replay buffer 和过期 cursor reset 信号。
- [x] 增加 JSONL/乱序响应/交错审批契约测试及真实 app-server 集成测试。
- [x] 在真实只读 sandbox 中接收命令审批、回送 decision 并验证 turn 恢复完成。
- [x] 支持 capability-aware initialize；真实并发读取账号、额度、用量、配置、模型、skills、Codex plugins/apps、MCP、实验功能与 permission profiles。

### M2 — Paseo fork 与精简

- [x] 固定 Paseo 上游 revision，定位 daemon WebSocket 协议和 provider adapter 接口。
- [x] 验证 Paseo 现有 Codex provider 可通过 app-server 创建会话并完成一次真实 turn。
- [x] 建立 Codex-only 运行配置：只启用 Codex，关闭 Paseo 本地 plugins、其他 providers、语音模型自动下载。
- [x] 决定源码裁剪边界：当前保留 adapter 源码，以最终 provider allowlist 强制 Codex-only，降低上游同步冲突；不删除 Codex 原生 plugin/app/marketplace 能力。
- [x] 在 Paseo fork 的最终 provider snapshot 边界强制只发布且始终启用 `codex`；真实 daemon 在持久化 `codex.enabled=false` 时仍只返回可用 Codex，OMP/ACP/配置热重载不能绕过。
- [x] 设置 UI 只显示 Codex，移除 provider 安装 catalog、启停开关与删除入口，同时保留 wire/schema 和历史配置读取兼容。
- [x] **支持自定义 API provider**：放宽 Codex-only 限制为"Codex 必需 + 可选自定义"；用户可在配置中添加 OpenAI-compatible、Anthropic-compatible 或 ACP provider，并通过 `enabled: true` 显式启用。
- [x] **撤销产品 Codex-only 发行**：builtin claude / copilot / opencode / pi 可发行、可使用；Codex 仍 required（`enabled=false` 时仍可用）；自定义仍 opt-in；不引入 OMP plugin/runtime；Paseo 本地 plugin 仍默认关闭。
- [x] 映射 command/file-change/approval/request-user-input/diff/token-usage；turn diff 只在完成时落一张最新快照卡，provisional live event 保持 epoch/no-seq 重连语义。
- [x] 在实体 Android 16 设备上验证 E2EE relay offer 注册、控制 RPC、短暂会话恢复和 relay worker 重启后的 agent/timeline 恢复；live timeline 重连事件携带 epoch 且不伪造 replay seq。
- [x] 在本地 Wrangler relay 中用真实 Paseo `DaemonClient` 验证 E2EE 断线自动重连、canonical timeline cursor catch-up，以及 provisional/live 事件不重复。
- [x] 在本地 Wrangler relay 中用真实 E2EE `DaemonClient` 验证终端创建、订阅、二进制输入/输出、resize 与终止。
- [x] 在真实 Paseo Web、packaged daemon 和本地 Wrangler E2EE relay 中完成浏览器 terminal E2E：创建与订阅、浏览器输入、PTY 输出和 resize 均通过；浏览器未直连 daemon WebSocket，relay wire 中未出现三个被检查的终端明文。
- [x] 在真实 Paseo Web 和 packaged daemon 中验证 relay deployment 期间的流式会话恢复：断线时 stream 暂停、running 状态保留，并在无需用户操作的情况下继续。
- [x] 增加独立 Linux `relay-browser-e2e` CI 门禁，固定 Elixir relay 提交与 Erlang/Elixir 版本，并执行同一套 Web terminal 和 deployment reconnect 规格。
- [x] 在 Paseo Web 客户端验证新建工作区首次渲染默认选择 `Codex CLI` terminal，并保留 `--no-alt-screen` launcher 预设；该默认入口由独立 `1/1 browser E2E` 覆盖。
- [ ] 验证 QR 相机/输入配对、多设备、完整双向对话、Wi-Fi/4G 切换、移动端 terminal UI、移动端 replay overflow、iOS 和 hosted TLS relay。
- [ ] 用现成 Paseo Android/Desktop/iOS 客户端完成端到端测试；Paseo Web 仅上述 relay terminal 与受控 relay deployment 范围已验收。

### M3 — OMP Rust primitives

- [x] 完成 path-dependency 构建审计：`pi-walker`/`pi-iso` 可用 Rust 1.88；`pi-shell` 因 nightly `portable_simd`、vendored patch 与巨型依赖面暂缓。
- [x] 建立默认关闭的 `omp-walker` adapter、cache invalidation 边界、契约测试和第三方 notice。
- [ ] 对真实 Paseo 项目 benchmark `pi-walker` 与现有扫描路径，再决定生产默认值；对 `pi-iso` 只做实验 probe。
- [x] 不引入 OMP plugin loader、provider registry、agent-core、prompt 或 session format。

### M4 — 桌面版功能对齐

- [ ] 项目/工作区与多线程并行。
- [ ] 结构化 transcript、reasoning/plan、工具调用和图片附件。
- [ ] inline diff、review comment、revert/commit/PR/worktree。
- [ ] ChatGPT 登录、账号状态、额度、模型和 reasoning 配置。
- [ ] sandbox/approval 配置、MCP、skills、apps、实验能力提示。
- [ ] 后台终端、命令输入/resize/terminate、通知与任务完成状态。
- [ ] 本地/局域网/relay 三种连接模式和安全审计。

### M5 — 切换与清理

- [ ] 冻结旧 Go/Android API，仅提供迁移说明。
- [ ] 完成数据/配置迁移和回滚演练。
- [ ] 移除旧 PTY UI 的默认入口，保留必要的通用终端能力。
- [ ] 重命名目录/仓库，更新服务名、包名和文档链接。
- [ ] 逐项功能验收后发布首个 alpha。

## 当前风险

- Paseo Codex provider 已确认直接使用 app-server，但账号、Codex plugin/app/marketplace、后台终端等桌面能力尚未全部暴露到产品 UI；以 `docs/FEATURE_MATRIX.md` 逐项收口。
- app-server 实验 API 无兼容保证；`thread/revert` 必须 capability-gated，并由最低 Codex 版本、生成的 experimental schema 与真实协议 smoke 共同约束。
- Paseo 默认发现会跳过低于 0.149.0 的旧 Codex binary；显式 command override 仍由操作者负责兼容性。当前成功模型 turn 的完整 rewind E2E 因本机账户额度耗尽待复跑。
- OMP Rust crates 的独立发布/API 稳定性需验证，不能把整个 monorepo 当隐式运行时依赖。
- “Codex 桌面版所有功能”包含第一方私有能力的可能性；验收范围以 app-server 公开稳定/实验 schema 实际暴露的能力为上限，并明确记录缺口。

## 每次开发后的记录格式

在 `docs/PROGRESS.md` 追加日期、完成事项、验证命令、遗留问题和下一步。只有通过真实 app-server 或真实 Paseo 客户端验证的项目才能从“进行中”改为“完成”。
