# Codex Harness Workbench — 现状

**最后更新**：2026-08-30  
权威剩余工作：[`docs/tasks.md`](docs/tasks.md)（T8–T11）。运行：[`docs/QUICKSTART.md`](docs/QUICKSTART.md) / `./scripts/start-harness-workbench.sh`。

## 已落地

- Rust Codex app-server bridge：并发 JSON-RPC、审批、thread/turn、`thread/revert` rewind、有界 replay。
- 产品 builtin（claude / copilot / opencode / pi / Codex）可发行；Codex required，`codex.enabled=false` 仍可用；自定义 `enabled: true` opt-in。
- Settings > Providers 生命周期（浏览器 E2E）；Android 真机表单 cancel（T7）通过。iOS 未验。
- 本地 Wrangler E2EE relay 基线 + Web relay terminal。QR/多设备/网络切换/iOS/hosted TLS 未证明（T8）。
- 配置 CAS（T5）：UI 带 `expectedRevision`；同 provider 后写拒绝。活跃会话与 reload 失败日志仍待验（T10）。

## 未完成（不要从本文件另开待办）

见 `docs/tasks.md`：T8 relay 未证明项、T9 Desktop relay-terminal 再连接、T10 配置面残件、T11 真实模型 turn。Maestro 操作系（阻碍 A）在 T7 之后仍独立未修。

## 已知缺口（摘要）

| 项 | 状态 |
| --- | --- |
| T8 配对 / 多设备 / 网络切换 / iOS / hosted TLS | 未证明 |
| T9 Desktop relay-terminal reconnect | 已知缺陷，reconnect 未跑到 |
| T10 会话连续性、反复更新、reload 失败日志 | 未验 |
| T11 rewind 双 turn 等真实模型 E2E | 等额度 |

阶段 5 / Alpha 未开始。不要把 [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md) 当当前计划。
