# 快速开始

最后更新：2026-08-30

Codex 官方 `app-server` 是 Codex provider 的 runtime（不 fork core）。Paseo 提供客户端。产品 builtin（claude / copilot / opencode / pi）可发行；Codex required。剩余工作见 [`tasks.md`](tasks.md)。

## 快速开始

### 前置条件

1. **Codex CLI**：0.149.0 或更高版本
   ```bash
   codex --version
   # 应显示 >= 0.149.0
   ```

2. **Node.js**：用于 Paseo
   ```bash
   node --version
   # 推荐 v22+
   ```

3. **Rust**：用于 Rust bridge
   ```bash
   rustc --version
   # 推荐 1.88.0+
   ```

### 安装步骤

```bash
# 1. 克隆并初始化子模块
cd /path/to/codex-remote-workbench
git submodule update --init --recursive

# 2. 构建 Paseo
cd upstream/paseo
npm install
npm run build:server
cd ../..

# 3. 验证 Rust 组件
./scripts/verify-rust.sh

# 4. 验证自定义 provider 功能
./scripts/verify-custom-providers.sh

# 5. 验证本地 E2EE relay（临时环境，不改变常规 daemon 配置）
./scripts/verify-relay.sh
```

### 启动 Daemon

```bash
./scripts/start-harness-workbench.sh
```

这会启动隔离 `.paseo-dev` 的 Paseo daemon 与 Web UI（`http://127.0.0.1:6877`）。产品 builtin 可发行，Codex required。relay、MCP、Paseo local plugin 默认关。

新建工作区默认选择 **Codex CLI** terminal profile。输入首条任务后会在真实
Codex CLI 终端中启动；桌面端可用现有 workspace tab 与 split pane 打开文件、diff
或额外终端。显式选择 Chat 仍会创建结构化 Codex app-server 对话。

### 验证安装

```bash
# 列出可用 providers
cd upstream/paseo
node packages/cli/bin/paseo provider ls --host 127.0.0.1:6877

# 运行诊断
node packages/cli/bin/paseo provider diagnostic codex --host 127.0.0.1:6877

# 创建测试对话
node packages/cli/bin/paseo run \
  --host 127.0.0.1:6877 \
  --provider codex/gpt-5.6-luna \
  --thinking low \
  --cwd /tmp \
  --wait-timeout 2m \
  'Reply exactly: READY'
```

自定义 API：Settings > Providers，或见 [CUSTOM_PROVIDERS.md](CUSTOM_PROVIDERS.md)。保存后会 reload snapshot，不必为改 provider 重启 daemon。Codex 不能禁用；自定义须 `enabled: true`。

移动端配对、网络切换、hosted TLS 仍待验（T8）。本地 relay 基线：`./scripts/verify-relay.sh`，边界见 [RELAY_VALIDATION.md](RELAY_VALIDATION.md)。

```bash
export CHW_CODEX_COMMAND=/path/to/codex   # CLI < 0.149.0 时
cd upstream/paseo
node packages/cli/bin/paseo provider ls --host 127.0.0.1:6877 --json
```

剩余工作 [`tasks.md`](tasks.md)。许可证：Codex Apache-2.0，OMP MIT，Paseo AGPL-3.0。
