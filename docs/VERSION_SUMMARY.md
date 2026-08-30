# 版本控制总览

修订日期：2026-08-29

## 结论

父仓库没有 release tag，但已有 `origin`（`ewo3344/codex-harness-workbench`）。
不能把历史日期写成发布事实。live gitlink 以 `git submodule status` 为准。
产品进度以 [`STATUS.md`](../STATUS.md) 与 [`tasks.md`](tasks.md) 为准。

## 固定输入

| 组件 | 当前值 | 来源 |
| --- | --- | --- |
| Rust bridge | 0.1.0 | crates/codex-bridge/Cargo.toml |
| OMP primitives | 0.1.0 | crates/omp-primitives/Cargo.toml |
| Paseo package | 0.5.0 | upstream/paseo/package.json |
| Paseo revision | live gitlink | `git submodule status` |
| Paseo upstream baseline | b5f583221436056e1fee2a3179d568a4c5ce85b9 | UPSTREAMS.toml |
| Codex CLI | 0.149.0 | UPSTREAMS.toml |

根 Cargo.toml 只有 workspace 配置，没有顶层 version。Paseo 只推 `fork`，不推 `getpaseo/paseo`。

## 已建立的规则

- 使用 Semantic Versioning 2.0.0，并用 v 前缀标记父仓库 tag。
- tag 必须指向干净且经过验证的父仓库提交。
- 父提交必须记录精确的 Paseo gitlink 和 UPSTREAMS.toml revision。
- release.sh 不修改子模块 package，不自动推送，也不调用不存在的辅助脚本。
- 真实设备、额度、浏览器和 hosted relay 未验证的场景保持待验。

## 当前实现证据

截至 2026-08-29，以下证据已经写入进度日志：

- Rust bridge 的 app-server 握手、并发 JSON-RPC、审批、线程生命周期和 turn 控制。
- Paseo Codex required provider 与 custom provider 的配置、snapshot、reload 和浏览器
  生命周期路径。
- Web 本地 Wrangler E2EE relay terminal 的创建、订阅、输入/输出、resize 和终止。
- Desktop browser-tabs 验证；Desktop relay terminal 仍需单独处理失败路径。
- Android T7 真机 provider 表单 cancel 已通过；Maestro 操作系未修。

对应命令和边界见 docs/PROGRESS.md、docs/FEATURE_MATRIX.md 和
docs/RELAY_VALIDATION.md。

## 文件清单

| 路径 | 作用 |
| --- | --- |
| docs/VERSION_CONTROL.md | 完整版本、分支、回滚、CI 与子模块规则 |
| docs/VERSION_QUICK_REF.md | 日常查询和验证命令 |
| scripts/release.sh | 根仓库 release commit/tag 流程 |
| .github/workflows/ci.yml | 根仓库 Rust/Paseo 定向 CI |
| scripts/verify-rust.sh | Rust bridge 验证 |
| scripts/verify-custom-providers.sh | provider 配置和测试验证 |
| scripts/verify-relay.sh | 本地 relay 验证 |
| UPSTREAMS.toml | 固定 upstream 输入及 gitlink revision |

## 发布流程

### 本地检查

~~~bash
git status --short --untracked-files=all
git diff --check
git -C upstream/paseo status --short --untracked-files=all
git -C upstream/oh-my-pi status --short --untracked-files=all
cargo test --workspace --locked
cd upstream/paseo
npm ci
npm run format:check
npm run lint
npx vitest run packages/server/src/server/bootstrap.smoke.test.ts packages/server/src/server/agent/provider-snapshot-manager.test.ts --maxWorkers=1
npm run build:server
npm run build:daemon-web-ui
cd ../..
~~~

### 创建 tag

~~~bash
RELEASE_CONFIRM=1 ./scripts/release.sh alpha 0.1.0-alpha.1
# 配置并审阅 remote 后才使用
RELEASE_PUSH=1 RELEASE_CONFIRM=1 ./scripts/release.sh patch
~~~

正式 GitHub release 由根 workflow 在 tag 后创建。父仓库可推 `origin`，但尚无
release tag，不能声称已发布。根 workflow 只打包 Rust bridge；Paseo 制品由子模块
workflow 负责。

## 后续顺序

见 [`tasks.md`](tasks.md) T8–T11。不要按 MASTER_PLAN 三周表当当前待办。
