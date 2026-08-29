# 版本控制快速参考

修订日期：2026-08-29

## 当前状态

| 项目 | 来源 | 当前状态 |
| --- | --- | --- |
| 父仓库 release tag | git tag | 尚无 |
| Rust bridge | crates/codex-bridge/Cargo.toml | 0.1.0 |
| OMP primitives | crates/omp-primitives/Cargo.toml | 0.1.0 |
| Paseo package | upstream/paseo/package.json | 0.5.0 |
| Paseo gitlink | UPSTREAMS.toml | 84acf5a65897a0c8cece2d0bdb323fe73edd03a4 |
| Codex CLI | UPSTREAMS.toml | 0.149.0 |

父仓库首次提交已完成；可访问的 Paseo fork 尚待配置。不要把工作区日期或文档
中的路线图当成 release 证据；以 STATUS.md 和 docs/PROGRESS.md 的命令结果为准。

## 常用查询

~~~bash
git log --oneline -3
git tag -l 'v*' | sort -V
git describe --tags --always
git submodule status
cargo metadata --no-deps --format-version 1
node -p 'require("./upstream/paseo/package.json").version'
~~~

## 版本命令

~~~bash
# 首次 release 显式指定版本
RELEASE_CONFIRM=1 ./scripts/release.sh alpha 0.1.0-alpha.1

# 已有父仓库 tag 后按类型递增
RELEASE_CONFIRM=1 ./scripts/release.sh patch
RELEASE_CONFIRM=1 ./scripts/release.sh minor
RELEASE_CONFIRM=1 ./scripts/release.sh major
~~~

release.sh 要求父仓库和子模块工作树干净，运行 Rust 与 Paseo 定向测试和构建，
只创建父仓库 CHANGELOG、commit 和 tag。它不会修改 Paseo package，也不会自动
推送。配置 remote 后若确实需要推送，显式设置 RELEASE_PUSH=1。

## 发布前验证

~~~bash
git diff --check
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
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

设备、额度、浏览器或真实 Codex 凭证缺失时，结果应记录为待验，不得改写为
通过。

## 当前功能快照

| 能力 | Web/Desktop | Android/iOS |
| --- | --- | --- |
| Codex bridge、线程和 turn 控制 | 真实 bridge/CLI 路径已验证 | 共享协议，移动端完整路径待验 |
| Custom provider 配置 | Settings 生命周期和浏览器路径已验证 | 共享 UI，真机生命周期待验 |
| E2EE relay terminal | Web 本地 Wrangler 路径已验证 | 控制面部分验证，配对/网络切换待验 |
| Desktop 包装 | 浏览器 tabs 路径已验证 | 不适用 |
| 配置热更新 | reload 与 snapshot 路径已验证 | 共享协议，真机待验 |
| CAS 并发、活跃会话连续性 | 待验 | 待验 |

## 升级与回滚原则

1. 在切换父 tag 或子模块 commit 前，归档并提交当前子模块工作区。
2. 备份 PASEO_HOME/config.json，再切换版本。
3. 切换后重装依赖并运行上面的定向测试和验证脚本。
4. 出现问题时使用 git revert，或切换到已验证 tag；同时检查 git submodule status。
5. 当前没有独立的配置迁移或安装验证脚本，不要调用不存在的脚本名。

## 重要路径

| 路径 | 用途 |
| --- | --- |
| UPSTREAMS.toml | Codex、Paseo、OMP 固定输入 |
| Cargo.toml | Rust workspace 清单（无顶层 version） |
| docs/VERSION_CONTROL.md | 完整流程和子模块规则 |
| docs/PROGRESS.md | 实测进度日志 |
| STATUS.md | 当前阶段和缺口 |
| .github/workflows/ci.yml | 父仓库 CI |
| scripts/release.sh | 本地 release commit/tag |
| scripts/verify-rust.sh | Rust bridge 验证 |
| scripts/verify-custom-providers.sh | provider 配置契约验证 |
| scripts/verify-relay.sh | 本地 relay 验证 |

## 子模块 pin

~~~bash
git -C upstream/paseo rev-parse HEAD
grep -n '^revision' UPSTREAMS.toml
git diff --submodule=log
~~~

父 workflow 只会检出父提交中记录的 gitlink。Paseo 自身的 CI 位于
upstream/paseo/.github/workflows/ci.yml，使用 Node 22 并覆盖其 server、desktop、
app、relay 和 CLI 合约；两者结果分开记录。
