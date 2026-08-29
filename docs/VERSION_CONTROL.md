# Codex Harness Workbench - 版本控制与发布指南

修订日期：2026-08-29
适用范围：父仓库和 upstream 子模块

本文件描述可执行的版本控制流程，不代表已经创建过任何 root release。
版本、提交和验收状态以 Git、UPSTREAMS.toml、STATUS.md 与 docs/PROGRESS.md
中的可复现结果为准。

## 当前基线

根项目尚没有可用的 release tag。根 Cargo.toml 是 workspace 清单，没有
version 字段；两个根 crate 当前都声明为 0.1.0。Paseo package 当前为 0.5.0，
Codex CLI 为 0.149.0。Paseo gitlink 当前为
84acf5a65897a0c8cece2d0bdb323fe73edd03a4，公共上游基线为
b5f583221436056e1fee2a3179d568a4c5ce85b9。

~~~bash
cargo metadata --no-deps --format-version 1
git log --oneline -3
git tag -l 'v*'
git remote -v
git submodule status
git -C upstream/paseo rev-parse HEAD
node -p 'require("./upstream/paseo/package.json").version'
~~~

Paseo 的 gitlink 必须指向可从配置的 remote 获取的 commit。当前产品 commit
仍是本地分支结果，fork remote 尚待配置；在此之前不要向 Paseo 上游 origin 推送。

## 语义化版本

版本遵循 Semantic Versioning 2.0.0：

~~~text
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
~~~

| 类型 | 使用条件 | 示例 |
| --- | --- | --- |
| MAJOR | 不兼容 API 或配置变更 | 1.0.0 -> 2.0.0 |
| MINOR | 向后兼容的功能新增 | 1.0.0 -> 1.1.0 |
| PATCH | 向后兼容的问题修复 | 1.0.0 -> 1.0.1 |
| alpha | 早期验证，接口可能变化 | 0.2.0-alpha.1 |
| beta | 功能较完整，仍需验证 | 0.2.0-beta.1 |
| rc | 候选版本，仅修复阻塞问题 | 1.0.0-rc.1 |

根项目 tag 使用 v 前缀，tag 只附着在父仓库提交上；Paseo 的 package 版本和
Git 历史单独维护。

## 当前工作与路线图

当前没有 root release 历史。G0/G1 已完成：Paseo 产品 commit 为
84acf5a65897a0c8cece2d0bdb323fe73edd03a4，父仓库基线提交为
95a49d6。以下仍是工作项，不是发生过的 release：

1. 继续用真实证据验证 Codex bridge、provider 生命周期、relay 与桌面路径。
2. 完成 Android/iOS 尚未验证的配对、网络切换、审批和 transcript 场景。
3. 完成配置并发 CAS、活跃会话连续性和 reload 失败审计的最终客户端验收。
4. 有可复现构建产物与远程仓库后，再创建第一个预发布 tag。

实现进度以 STATUS.md、docs/PROGRESS.md、docs/FEATURE_MATRIX.md 和
docs/RELAY_VALIDATION.md 为准，不要从版本号推断完成度。

## 文件与版本归属

| 路径 | 归属 | 规则 |
| --- | --- | --- |
| crates/codex-bridge/Cargo.toml | 父仓库 | 当前 0.1.0，发布前显式修改并更新 lockfile |
| crates/omp-primitives/Cargo.toml | 父仓库 | 当前 0.1.0，默认 feature 仍关闭 |
| Cargo.toml | 父仓库 | workspace 清单，没有顶层版本 |
| upstream/paseo | git submodule | 父仓库只记录 gitlink，不隐式修改 package |
| protocol/ | 父仓库 | 协议快照变更需同步 UPSTREAMS.toml |
| CHANGELOG.md | 父仓库 | release 脚本可创建，内容必须对应真实提交 |

## 子模块工作流

在 checkout、更新或版本命令前，先归档并提交子模块：

~~~bash
tar --exclude='.git' --exclude='node_modules' -cf /tmp/paseo-worktree.tar -C upstream paseo
git -C upstream/paseo status --short --untracked-files=all
git -C upstream/paseo add <reviewed-files>
git -C upstream/paseo commit -m 'feat: extend Codex harness workflows'
git -C upstream/paseo rev-parse HEAD
git add upstream/paseo UPSTREAMS.toml
git diff --cached --submodule=log
~~~

若 commit 尚未在可访问 fork 上，保留 patches/paseo/ 作为临时重建路径，并在
UPSTREAMS.toml 记录基线、commit 和应用顺序。不要把 .paseo-dev、密钥、APK、
日志或构建目录加入子模块 commit。

## 分支策略

~~~text
main                 可复现、可发布的父仓库提交
develop              集成分支（实际创建后再使用）
feature/<topic>      功能开发
bugfix/<topic>       非紧急修复
hotfix/<topic>       从 main 分出的紧急修复
release/<version>    候选版本准备
docs/<topic>         仅文档变更
~~~

策略是约定，不代表分支已经存在。每个 release tag 必须指向经过验证的父仓库
提交，并记录精确的子模块 gitlink。

## 发布流程

发布前必须保证父仓库和两个子模块均干净：

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
./scripts/verify-rust.sh
./scripts/verify-custom-providers.sh
./scripts/verify-relay.sh
~~~

真实 Codex 场景需要 CHW_REAL_CODEX_TESTS=1 和已登录的 Codex CLI；设备、额度
或浏览器缺失时必须保留为待验状态。

scripts/release.sh 只修改父仓库 CHANGELOG.md、提交并创建 tag，不修改 Paseo
package，也不自动推送：

~~~bash
RELEASE_CONFIRM=1 ./scripts/release.sh alpha 0.1.0-alpha.1
RELEASE_CONFIRM=1 ./scripts/release.sh patch
RELEASE_PUSH=1 RELEASE_CONFIRM=1 ./scripts/release.sh patch
~~~

父仓库的 `scripts/release.sh` 不负责多平台打包；根 CI 的 `build` job 会为 Linux、
macOS 和 Windows 打包 `codex-bridge` 二进制。Paseo 的 desktop、mobile 和 server
制品仍由子模块自身 workflow 维护。tag workflow 可在配置好 remote 和写权限后创建
GitHub release，并使用 GitHub 自动生成 release notes：

~~~bash
gh release create v<version> --draft --generate-notes
~~~

## 回滚

~~~bash
git fetch --tags
git switch --detach v<known-good-version>
# 或在 main 上生成可审计的反向提交
git switch main
git revert <bad-commit>
~~~

回滚父提交时同时确认 git submodule status，不要留下不匹配的 Paseo 工作区。
运行态配置位于 PASEO_HOME/config.json，开发脚本默认 .paseo-dev/config.json；
先复制备份，再恢复经过审阅的 JSON。当前没有独立的配置迁移或安装验证脚本。

## Changelog

根 CHANGELOG.md 使用 Keep a Changelog 结构，版本条目只能在对应父仓库提交
和 tag 创建后加入。upstream/paseo/CHANGELOG.md 不等同于父仓库变更记录。

~~~markdown
# Changelog

## [Unreleased]

## [0.1.0-alpha.1] - YYYY-MM-DD

### Added
- 可由提交和验证命令证明的功能
~~~

## CI 与子模块关系

根 .github/workflows/ci.yml 在父仓库提交上触发。actions/checkout 检出父仓库
记录的 gitlink，不会看到子模块工作区中尚未提交的文件。只有当 gitlink commit
已推送到 .gitmodules 指向的可访问 URL，或 workflow 显式配置 fork，远程 CI 才能
初始化该子模块。

Paseo 自身还有独立的 upstream/paseo/.github/workflows/ci.yml，负责 Node 22、
server、desktop、app、relay 和 CLI 合约。根 workflow 只运行父仓库 Rust 检查、
固定的 Paseo 定向检查和构建；两个 workflow 的结果不能合并成一次 release 证明。

根 CI 不调用不存在的 `npm run test:coverage`、release-notes、迁移或安装验证脚本；
Rust 覆盖率使用 `cargo-tarpaulin`，Rust bridge 制品由 workflow 的实际打包步骤生成。
Paseo 的完整桌面和移动端制品流程仍由子模块 workflow 单独维护。
