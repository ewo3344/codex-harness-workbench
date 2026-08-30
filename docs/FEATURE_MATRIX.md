# Codex 桌面体验功能矩阵

最后核对：2026-08-27，Codex CLI 0.149.0，Paseo 0.5.0。

状态定义：

- **已验证**：在本机用真实 Codex/Paseo 端到端验证过。
- **已有待验**：上游源码存在完整映射，但本项目尚未做对应 UI/断线/移动端验收。
- **部分**：只覆盖部分语义或使用 Paseo 自己的替代实现。
- **缺口**：公开 app-server 有能力，但 Paseo 产品面尚未接出，或本项目尚未实现。
- **边界外**：第一方桌面应用未通过公开协议暴露，无法声称复刻。

| 能力 | Codex app-server 事实源 | Paseo/本项目证据 | 状态 | 完成门槛 |
| --- | --- | --- | --- | --- |
| 启动 harness、握手、版本信息 | `initialize` / `initialized` | Rust bridge 真实集成测试 | 已验证 | 已完成 |
| 并发 JSON-RPC、乱序响应 | 所有 request/response | Rust 后台 reader/writer、request-id 路由；假 server 乱序测试 | 已验证 | 已完成 |
| 服务端请求（审批、用户输入） | `item/*/requestApproval`、`item/tool/requestUserInput`、MCP elicitation | Rust 已在真实只读 sandbox 接收命令审批、回送 `accept` 并恢复 turn；Paseo 注册对应 handler | 部分 | 用真实文件审批、问题表单分别跑一遍，并在移动/Web UI 验收三类交互 |
| 事件重连与追赶 | thread persistence + notifications | Rust 默认 2048 条 replay 窗口已通过 2049 条 JSONL 事件回归，过期 cursor 明确得到 `reset_required`；Paseo E2EE `DaemonClient` 已验证断线后 canonical timeline cursor catch-up、provisional/live 无重复 | 部分 | 运行中断开真实客户端，溢出 replay，再恢复完整 transcript |
| 线程列表与读取 | `thread/list`、`thread/read` | Rust 真实测试；Paseo import/list 实现 | 已验证 | 已完成基础读取；仍需分页/归档 UI 验收 |
| 新建/恢复/分叉/归档/rewind | `thread/start/resume/fork/archive/unarchive`；experimental `thread/revert(beforeTurnId)`；`thread/rollback` 已弃用 | Rust 已真实验证生命周期；Paseo 已改用同 ID revert，并有 transport/session/manager 测试；真实 0.149 smoke 验证 1 turn→revert→0 turn，且文件语义由协议明确不变 | 部分 | 账户额度恢复后复跑 Paseo 成功双 turn rewind E2E；再验分页、独立文件 revert 与客户端 UI |
| 回合开始、steer、中断 | `turn/start/steer/interrupt` | Rust 真实验证 steer 改变最终回答；turn start acknowledgement 后立即 interrupt，状态稳定为 `interrupted`；Paseo adapter 已实现 | 已验证 | bridge 基本控制路径完成；仍随 Web/移动端做交互验收 |
| 流式回答 | `item/agentMessage/delta` 与 item lifecycle | Paseo adapter 映射；真实回复 `PASEO_CODEX_READY` | 已验证 | 已完成文本基本路径 |
| reasoning 与计划 | reasoning delta、`turn/plan/updated`、plan item | Paseo adapter 有 reasoning/plan timeline 与 plan approval | 已有待验 | Web/移动端流式渲染、计划批准后实现 |
| 命令、文件修改、工具调用 | command/fileChange/MCP/web/subagent items | Paseo tool-call mapper 与 timeline 映射 | 已有待验 | 每类 item 的 started/delta/completed 及失败态截图/测试 |
| inline diff 与 review | fileChange、review/start + Paseo Git diff/revert | 两边都有部分能力；Codex chat rollback 明确不还原本地文件 | 部分 | 逐文件 diff、评论、revert、review 结果、工作树状态一致性 |
| 图片/音频/skill/mention 输入 | `UserInput` union | Paseo 处理图片临时文件与输出图片 | 部分 | 图片附件真实 turn；音频和 mention/skill 分别验收 |
| 模型发现与 reasoning 选项 | `model/list` | Paseo diagnostic 识别 6 个模型；Rust 并发真实测试 | 已验证 | 已完成发现；模型切换仍需 UI 验收 |
| sandbox/approval 模式 | thread/turn params、permission profiles | Rust 已验证 read-only + on-request 命令提升，并真实列出 permission profiles；Paseo 有 auto/auto-review/full-access presets | 部分 | workspace-write、full-access、拒绝/取消与 reviewer 全覆盖 |
| ChatGPT 登录/登出/账号 | `account/read/login/*/logout` | Rust 验证 account/read；Paseo provider 未完整暴露登录 UI | 部分 | 在客户端完成登录、取消、登出、凭证状态变化 |
| 额度、rate limits、usage | `account/rateLimits/read`、`account/usage/read` 与 usage notifications | Rust 真实并发读取账号级 rate limits/usage；Paseo 映射 thread token usage，账号额度 UI 未确认 | 部分 | 账号级额度/重置时间与线程用量 UI |
| Codex 配置 | `config/read/value/write/batchWrite`、requirements | Rust 真实读取含 layers 的项目有效配置；Paseo 用 config/read 发现默认模型/effort | 部分 | 安全的配置编辑、校验、reload 与错误反馈 |
| MCP 状态、OAuth、资源与调用 | `mcpServer*` APIs/events | Rust 真实列出 MCP status；Paseo 支持 MCP 注入和 Codex tool mapping | 部分 | 保留 Codex 原生 MCP 管理；OAuth/重连/elicitation 验收 |
| Skills | `skills/list/config/write/extraRoots` | Rust 真实列出 cwd skills；Paseo 映射为 slash commands | 部分 | 启停、额外根、刷新和移动端调用 |
| Codex plugins/apps/marketplace | `plugin/*`、`app/*`、`marketplace/*` | experimental capability 握手后，Rust 真实读取 plugin marketplaces 与 apps catalog；Paseo 本地 plugin 是另一套系统 | 缺口 | 新建 Codex 专用管理面；不得与 OMP/Paseo plugin 混淆 |
| 后台终端 | `thread/backgroundTerminals/*`、`command/exec/*` | Paseo 有独立 terminal；本地 E2EE relay 已回归创建、订阅、二进制输入/输出、resize、terminate | 部分 | 列表、attach、客户端 UI、设备和重连验收 |
| 多项目、多工作区、多 agent | Codex threads + Paseo project/workspace/agent manager | Paseo 已实现；产品 snapshot 发行 claude / copilot / opencode / pi / Codex（Codex required）；多 agent 路径仍待验 | 已有待验 | 多仓库、多 worktree、并行 Codex 任务与资源限制 |
| commit/PR/merge/preview | 主要由 Paseo Git/forge/service proxy 提供 | Paseo 产品已实现 | 已有待验 | 本地 repo 真实分支→diff→commit→PR（可在测试 forge mock） |
| 本地 Web 与局域网直连 | Paseo WebSocket | pinned Paseo fork 在 127.0.0.1:6877 启动；产品 builtin 可发行；持久化 `codex.enabled=false` 时 Codex 仍启用，并通过 CLI 完成真实 turn | 已验证 | LAN TLS/鉴权仍需安全验收 |
| 手机配对与 E2EE relay | Paseo relay/pairing | 本地 Wrangler crypto/offer/CLI 基线、E2EE `DaemonClient` 重连与 terminal stream 契约已验证；实体 Android 已验证控制面 relay 会话 | 已有待验 | Android/iOS 配对、断网重连、relay 零知识检查 |
| 桌面包装与多窗口 | Paseo Electron | 上游已有 | 已有待验 | Linux 实包启动、多窗口、daemon 生命周期 |
| Voice/realtime | Codex realtime APIs；Paseo 自有 STT/TTS | 开发配置为避免大模型下载而关闭 | 缺口 | 决定采用 Codex realtime 还是 Paseo voice，再做端到端 |
| 第一方 attestation/私有 UI | app-server 仅公开部分 attestation hook | 无第一方签发能力或私有桌面源码 | 边界外 | 只能使用公开协议；任何无法合法获得的第一方能力必须标为不支持 |

## 验收原则

“Paseo 源码里有一个 case”只能证明接入方向，不等于完成。每行必须有覆盖该行完整范围的真实进程、协议测试、持久化状态或实际客户端证据，才能改成“已验证”。

OMP/Pi 的 agent loop、provider、prompt 和 plugin 不参与上述任何状态；这些语义全部以 Codex app-server 为准。OMP 仅允许出现在文件扫描、隔离或普通终端等基础设施后端。Paseo 本地 plugin 默认关闭，但 Codex 自己的 `plugin/*`、`app/*`、`marketplace/*` 是桌面功能范围，不能因“丢掉 OMP 插件”而一起删除。
