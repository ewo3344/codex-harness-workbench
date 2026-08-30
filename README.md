# Codex Harness Workbench

旧的 Codex 远程 PTY 原型正在重建为结构化 harness 工作台：Codex 官方
`app-server` 是 Codex provider 的唯一 agent runtime（不 fork Codex core），
Paseo 提供 Web/桌面/移动端与远程接入，Rust 逐步接管 daemon 基础设施。
claude / copilot / opencode / pi 等已实现 builtin 可使用；Codex 仍是 required /
默认。迁移期间保留目录名 `codex-remote-workbench`，等 Paseo 客户端切换完成后再原子改名。

当前已经跑通：

- Paseo → Codex app-server → 真实模型 turn；
- Rust app-server 双向并发 transport、乱序 response、审批回传和有限 replay；
- 真实命令审批，以及跨 app-server 重启的 thread 生命周期；
- 真实 turn steer 与 active-turn interrupt；
- 基于 0.149 experimental `thread/revert(beforeTurnId)` 的同线程对话 rewind；
- 默认关闭的 OMP `pi-walker` Rust adapter；
- Paseo 发布 claude / copilot / opencode / pi / Codex；旧配置也不能禁用 required 的 Codex runtime；
- **自定义 API provider 支持**：可在配置中添加 OpenAI-compatible、Anthropic-compatible 或 ACP provider，同时保持 Codex 作为必需的核心 runtime。
- 新建工作区默认选择 **Codex CLI** 终端 profile；终端以 `--no-alt-screen` 运行，桌面端继续复用现有平铺 pane/split 布局。

完整范围与证据见：

- [**完整实施计划（必读）**](docs/MASTER_PLAN.md) ⭐
- [**版本控制与发布计划**](docs/VERSION_CONTROL.md) 🔖
- [项目状态总览](STATUS.md)
- [重建计划](PLAN.md)
- [架构与组件边界](docs/ARCHITECTURE.md)
- [桌面体验功能矩阵](docs/FEATURE_MATRIX.md)
- [开发进度](docs/PROGRESS.md)
- [OMP Rust 评估](docs/OMP_RUST_ASSESSMENT.md)
- [自定义 Provider 配置指南](docs/CUSTOM_PROVIDERS.md)
- [自定义 API 与手机体验改善计划](docs/CUSTOM_API_PLAN.md)
- [快速开始指南](docs/QUICKSTART.md)
- [实施总结](docs/IMPLEMENTATION_SUMMARY.md)
- [版本快速参考](docs/VERSION_QUICK_REF.md)

## 当前可运行入口

前置条件：`codex` 0.149.0 或更高版本已登录且在 `PATH`，并已构建 pinned Paseo fork：

```bash
git submodule update --init --recursive
cd upstream/paseo
npm install
npm run build:server
cd ../..
```

```bash
cd /home/e/workspace/codex-remote-workbench
./scripts/start-harness-workbench.sh
```

脚本默认运行 `upstream/paseo` 的本地 build，使用隔离的 `.paseo-dev` home，在 `127.0.0.1:6877` 启动本地 Web UI，关闭
relay、MCP server、Paseo local plugins、OMP 和语音模型下载。产品 builtin
provider 可使用。它不会操作常用的 Paseo `6767` daemon。只有显式设置
`CHW_USE_GLOBAL_PASEO=1` 才使用全局未打 patch 的 CLI。

Rust 验证：

```bash
./scripts/verify-rust.sh
CHW_REAL_CODEX_TESTS=1 ./scripts/verify-rust.sh
```

这些 Codex 集成测试会读取本机账号状态；审批、生命周期和 turn 控制测试会运行短暂
的真实模型 turn，并只在独立临时目录中操作。

Relay 本地 E2EE 验证：

```bash
./scripts/verify-relay.sh
```

它启动临时 Wrangler relay 与临时 Paseo daemon，不会改变常规的 `.paseo-dev`
开发配置。详见 [relay 验证记录](docs/RELAY_VALIDATION.md)。

## 仓库布局

- `crates/codex-bridge/`：Codex app-server supervisor、JSONL transport、replay 与薄 lifecycle API。
- `crates/omp-primitives/`：默认关闭的 OMP Rust primitive adapter。
- `upstream/paseo/`、`upstream/oh-my-pi/`：固定 revision 的 Git submodule。
- `protocol/`：由固定 Codex CLI 版本生成的 JSON Schema/TypeScript 快照。
- `config/`、`scripts/`：Paseo 本地运行配置与入口（Codex required，其他产品 builtin 可发行）。
- `host/`、`android/`：旧 Go/PTY 与 Android 迁移基线；不再承接新产品能力。

## 旧 PTY 原型

旧实现仍可用于回归比较，但不是默认架构：

```bash
cd /home/e/workspace/codex-remote-workbench/host
go run . --addr 127.0.0.1:8787 --cwd /home/e/workspace
```

在新 Paseo 端到端路径覆盖 worktree、diff、后台终端和移动端前，不移动或删除这些
基线文件。之后会整体迁到 `legacy/` 并提供配置迁移与回滚说明。
