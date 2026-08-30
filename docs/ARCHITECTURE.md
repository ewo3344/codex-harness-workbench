# Codex Harness Workbench 架构

最后更新：2026-08-24。

## 当前可运行形态

```text
Paseo Web / CLI
       │ Paseo protocol
       ▼
Paseo TypeScript daemon
       │ CodexAppServerAgentClient + JSONL
       ▼
codex app-server 0.149.0
```

这条路径已经完成真实 Codex turn。Rust `codex-bridge` 目前是并行建设的替代
daemon 内核，不会在尚未达到协议等价时强行替换可运行路径。

## 目标形态

```text
Paseo Web / Android / iOS / Desktop / CLI
                    │ authenticated Paseo protocol / E2EE relay
                    ▼
             Rust workbench daemon
             ├─ client pairing、cursor、replay
             ├─ Codex event projection
             ├─ thread/worktree/file projections
             ├─ generic terminal transport
             └─ feature-gated OMP primitives
                    │ supervised JSONL
                    ▼
             codex app-server v2
                    ▼
     Codex auth / agent loop / tools / sandbox / MCP / skills
```

迁移采用 strangler seam：保持 Paseo protocol 与现有客户端不变，每迁入一块 Rust
能力，就用同一真实 app-server 场景和 Paseo 客户端做差分验收；未通过的能力继续走
TypeScript daemon。

## 唯一事实源

| 语义 | 所有者 |
| --- | --- |
| agent loop、prompt、模型调用、tool lifecycle | Codex core/app-server |
| 登录、账号、额度、Codex config、MCP、skills、Codex plugins/apps | Codex app-server |
| thread/turn/item 持久历史 | Codex thread store；daemon 只保存客户端投影/cursor |
| 客户端、配对、relay、worktree/diff 产品体验 | Paseo fork |
| stdio 监管、并发 request 路由、replay、基础设施后端 | Rust daemon |
| 文件扫描/隔离等可替换 primitive | 明确 feature 后的 OMP Rust crate |

Pi/OMP 不再提供第二套 *Codex* agent loop。产品可发行 Paseo 已实现的其他 builtin
provider（claude / copilot / opencode / pi）；Codex 仍是 required / 默认。
这里的“用 Pi/OMP”作为基础设施严格指复用其经过验证的 Rust primitive，
不引入 OMP plugin/runtime。否则 Codex 与 Pi 会争夺 session、tool、approval
和 prompt 的事实源，无法实现可信的桌面等价体验。

## 不可破坏的安全约束

1. Codex command/file approval 是双向 server request；必须保留原 request id，不能降级为日志或普通 notification。
2. Agent 命令始终由 Codex sandbox 执行。OMP `pi-shell` 即使未来可编译，也只能服务普通用户终端/项目脚本。
3. replay cursor 过期必须要求客户端刷新 thread projection，不能静默漏事件。
4. 未知 app-server 版本或实验事件透明保存/转发，并按 capability gate 暴露；不能猜测解析。
5. relay 与 LAN 模式在完成配对、鉴权、E2EE 和重连验收前不能标为生产可用。
6. 对话 rewind 使用 capability-gated `thread/revert(beforeTurnId)`：替换所选 turn 之前的持久历史并保留同一 thread id。它不恢复本地文件；文件恢复是独立 Git/diff 操作，不能依赖已弃用的 `thread/rollback`。
7. 默认 Codex binary discovery 必须检查 app-server 协议最低版本，不能让仓库局部旧 CLI 静默遮蔽较新的用户级 CLI；显式 command override 保持权威。

## 三类扩展边界

- **OMP plugin/runtime**：不引入。
- **Paseo local plugin**：属于 Paseo 宿主扩展，当前配置强制关闭；源码先保留以降低上游同步成本。
- **Codex plugin/app/marketplace**：属于 app-server 桌面能力，必须在独立的 Codex Extensions vertical slice 中实现，不能接入 Paseo `PluginService`。

## 仓库边界

- `upstream/paseo`、`upstream/oh-my-pi` 是固定 revision 的 submodule。
- `protocol/` 是本机固定 Codex 版本生成的协议快照，不手写修改。
- `crates/codex-bridge` 只负责 app-server transport 与稳定薄 API。
- `crates/omp-primitives` 是 OMP Rust crate 的窄 adapter；每个 backend 默认关闭、可独立测试、带 notice。
- `host/`、`android/` 是迁移基线，尚未移动到 `legacy/`；新的产品能力不再写入旧 PTY 协议。
