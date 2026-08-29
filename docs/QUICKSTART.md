# Codex Harness Workbench - 快速开始指南

最后更新：2026-08-27

## 项目简介

Codex Harness Workbench 是一个以 Codex 官方 harness 为核心、可从桌面和移动端完整操作的本地优先工作台。

**核心特性：**
- ✅ Codex app-server 作为主要 agent runtime
- ✅ Rust daemon 提供高性能基础设施
- ✅ Paseo 提供 Web/桌面/移动端客户端
- ✅ **支持自定义 API**（OpenAI-compatible、Anthropic-compatible、ACP）
- ✅ 完整的对话管理（线程、回合、rewind）
- ✅ 审批系统与工具调用
- 🚧 E2EE relay 与移动端配对（待验证）

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

这会启动：
- Paseo daemon（使用隔离的 `.paseo-dev` home）
- Web UI 在 `http://127.0.0.1:6877`
- 只启用 Codex provider
- 关闭 relay、MCP server、本地 plugins

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

## 配置自定义 API

### 配置文件位置

开发环境：`.paseo-dev/config.json`
生产环境：`~/.paseo/config.json`

### 示例 1：添加 OpenAI API

```json
{
  "version": 1,
  "agents": {
    "providers": {
      "my-openai": {
        "extends": "codex",
        "enabled": true,
        "label": "我的 OpenAI",
        "env": {
          "OPENAI_API_KEY": "sk-...",
          "OPENAI_BASE_URL": "https://api.openai.com"
        },
        "models": [
          {"id": "gpt-4-turbo", "label": "GPT-4 Turbo", "isDefault": true},
          {"id": "gpt-4o", "label": "GPT-4o"}
        ]
      }
    }
  }
}
```

### 示例 2：添加 Claude 代理

```json
{
  "agents": {
    "providers": {
      "my-claude-proxy": {
        "extends": "claude",
        "enabled": true,
        "label": "Claude 代理",
        "env": {
          "ANTHROPIC_API_KEY": "sk-ant-...",
          "ANTHROPIC_BASE_URL": "https://my-proxy.example.com"
        },
        "disallowedTools": ["WebSearch"]
      }
    }
  }
}
```

### 示例 3：添加 Z.AI（Zhipu GLM）

```json
{
  "agents": {
    "providers": {
      "zai": {
        "extends": "claude",
        "enabled": true,
        "label": "ZAI",
        "env": {
          "ANTHROPIC_AUTH_TOKEN": "your-zai-api-key",
          "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
          "API_TIMEOUT_MS": "3000000"
        },
        "disallowedTools": ["WebSearch"],
        "models": [
          {"id": "glm-5-turbo", "label": "GLM 5 Turbo", "isDefault": true},
          {"id": "glm-5.1", "label": "GLM 5.1"}
        ]
      }
    }
  }
}
```

**重要提示：**
- Codex 始终启用，不能禁用
- 自定义 provider 必须设置 `"enabled": true`
- 配置更改后需要重启 daemon

详细配置指南：`docs/CUSTOM_PROVIDERS.md`

## 移动端使用

### 配对流程（待验证）

1. 在桌面端启动 daemon
2. 配置 E2EE relay（如果使用远程连接）
3. 在移动端扫码配对
4. 移动端自动同步 provider 列表
5. 选择 provider 创建对话

### 断线重连

项目已实现：
- 2048 条有界 replay buffer
- 过期 cursor 的 `reset_required` 信号
- 自动恢复对话状态

本机 relay 基线可通过 `./scripts/verify-relay.sh` 重现。该验证不替代 Android/iOS
实体设备配对、网络切换和长时间离线重连验收；完整边界见
[RELAY_VALIDATION.md](RELAY_VALIDATION.md)。

## 目录结构

```
codex-remote-workbench/
├── crates/
│   ├── codex-bridge/      # Rust bridge 与 app-server 通信
│   └── omp-primitives/    # OMP Rust primitive adapter
├── upstream/
│   ├── paseo/             # Paseo fork（客户端）
│   └── oh-my-pi/          # OMP submodule
├── config/                # 配置文件和示例
├── docs/                  # 文档
│   ├── ARCHITECTURE.md    # 架构说明
│   ├── FEATURE_MATRIX.md  # 功能矩阵
│   ├── PROGRESS.md        # 开发进度
│   ├── CUSTOM_PROVIDERS.md # 自定义 provider 指南
│   └── CUSTOM_API_PLAN.md # 改善计划
├── scripts/               # 启动和验证脚本
├── protocol/              # Codex 协议快照
└── .paseo-dev/           # 开发环境隔离目录
```

## 常用命令

### Provider 管理

```bash
# 列出所有 providers
paseo provider ls --host 127.0.0.1:6877

# 查看 provider 详情
paseo provider diagnostic <provider-id> --host 127.0.0.1:6877

# 列出模型
paseo provider models <provider-id> --host 127.0.0.1:6877
```

### Agent 管理

```bash
# 创建对话
paseo run \
  --host 127.0.0.1:6877 \
  --provider <provider-id>/<model-id> \
  --cwd /path/to/workspace \
  'Your prompt here'

# 列出 agents
paseo agent ls --host 127.0.0.1:6877

# 恢复对话
paseo resume <agent-id> --host 127.0.0.1:6877
```

### 开发命令

```bash
# 运行 Rust 测试
./scripts/verify-rust.sh

# 运行真实 Codex 集成测试（需要账户）
CHW_REAL_CODEX_TESTS=1 ./scripts/verify-rust.sh

# 验证自定义 provider 功能
./scripts/verify-custom-providers.sh

# 重新构建 Paseo
cd upstream/paseo
npm run build:server
npm run build:daemon-web-ui
```

## 故障排除

### 问题：Codex 版本过低

```bash
# 检查版本
codex --version

# 如果 < 0.149.0，需要升级
# 或者设置 CHW_CODEX_COMMAND 环境变量指向正确的 binary
export CHW_CODEX_COMMAND=/path/to/newer/codex
```

### 问题：找不到 provider

检查配置文件中的 `enabled: true` 设置：
```bash
cat .paseo-dev/config.json | grep -A 5 "providers"
```

### 问题：移动端无法连接

确保：
1. daemon 已启动
2. 防火墙允许端口 6877
3. E2EE relay 配置正确（如果使用）

### 问题：API key 无效

- OpenAI：检查 `OPENAI_API_KEY` 环境变量
- Anthropic：检查 `ANTHROPIC_API_KEY` 或 `ANTHROPIC_AUTH_TOKEN`
- 第三方：参考提供商文档

## 性能优化

### Replay Buffer

当前限制：2048 条事件
如果对话很长，客户端会收到 `reset_required` 信号并重新加载完整历史。

### OMP Walker（可选）

启用文件扫描加速（实验性）：
```bash
cargo build --features omp-walker
```

## 安全注意事项

1. **API Keys**：存储在本地配置文件，不同步到移动端
2. **E2EE**：移动端连接使用端到端加密
3. **审批系统**：所有命令和文件操作需要审批
4. **沙箱**：Codex 命令在受控沙箱中执行

## 进一步阅读

- [完整架构说明](docs/ARCHITECTURE.md)
- [功能矩阵与完成度](docs/FEATURE_MATRIX.md)
- [开发进度](docs/PROGRESS.md)
- [自定义 Provider 配置](docs/CUSTOM_PROVIDERS.md)
- [重建计划](PLAN.md)

## 贡献与反馈

项目当前处于活跃开发阶段。主要待完成项：

- [ ] 移动端 E2EE relay 真实验证
- [ ] 完整的审批 UI（文件、命令、用户输入）
- [ ] 后台终端完整集成
- [ ] 配置热重载
- [ ] Web UI 配置管理界面

## 许可证

- Codex：Apache-2.0
- OMP：MIT（含第三方 notices）
- Paseo：AGPL-3.0
- 本项目：遵循上游许可证

---

**项目工作名**：Codex Harness Workbench  
**当前版本**：Alpha（开发中）  
**最后更新**：2026-08-24
