# 自定义 Provider 配置指南

最后更新：2026-08-27

## 概述

Codex Harness Workbench 支持在保留 Codex 作为主要 runtime 的同时，添加自定义 API provider。这允许你：

- 使用自定义 OpenAI-compatible 端点
- 使用 Claude 代理或第三方 Anthropic-compatible API
- 添加支持 ACP (Agent Client Protocol) 的本地或远程 agent
- 在多个 API 配置之间切换

## 核心原则

1. **Codex 始终保留**：Codex 是 required provider，UI 和 daemon 均不允许停用或删除
2. **显式启用**：自定义 provider 必须设置 `"enabled": true` 才会被发布
3. **标准协议**：只支持标准协议（OpenAI Responses API、Anthropic API、ACP）

## Settings 配置界面

Settings > Providers 已实现 custom provider 的完整配置生命周期：

- 新建 OpenAI-compatible、Anthropic-compatible 和 ACP provider
- 编辑已有 custom provider
- 启用或停用 custom provider
- 删除 custom provider
- 保存后触发 daemon 配置 reload，并刷新 provider snapshot；daemon 进程保持运行

Codex 是 required provider。界面不允许停用或删除 Codex，daemon 也会在配置边界继续
强制该约束。上述 UI 和热更新路径已通过真实浏览器 E2E 验收：OpenAI-compatible provider
覆盖新建、编辑（留空密钥保留原值）、停用、重新启用和删除；Anthropic API key/token 与
ACP（含带空格参数）路径也已验证。daemon 在整个生命周期中保持运行，凭证不会出现在
WebSocket 帧中（117 帧、0 次泄漏）。

## 手工配置位置

配置文件位于：`$PASEO_HOME/config.json`

对于开发环境：`.paseo-dev/config.json`

Settings UI 是常规管理入口。直接编辑 JSON 仍作为高级配置和故障排查手段保留。

## 配置格式

### 基本结构

```json
{
  "version": 1,
  "agents": {
    "providers": {
      "provider-id": {
        "extends": "codex|claude|acp",
        "enabled": true,
        "label": "显示名称",
        "description": "描述",
        "env": { ... },
        "models": [ ... ]
      }
    }
  }
}
```

### Provider ID 规则

- 小写字母开头
- 只能包含字母、数字、连字符
- 格式：`/^[a-z][a-z0-9-]*$/`

## 常见场景

### 1. OpenAI-compatible 端点

适用于：OpenRouter、LiteLLM、vLLM、本地 llama.cpp server 等

```json
{
  "agents": {
    "providers": {
      "my-openai": {
        "extends": "codex",
        "enabled": true,
        "label": "我的 OpenAI API",
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

**注意事项：**
- 端点必须支持 OpenAI Responses API（不仅仅是 chat completions）
- 如果 `OPENAI_BASE_URL` 不以 `/v1` 结尾，Paseo 会自动添加
- 必须显式设置 `models` 数组

### 2. Anthropic-compatible 端点

适用于：Z.AI、Alibaba Cloud (Qwen)、自建代理等

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
          {"id": "glm-4.5-air", "label": "GLM 4.5 Air"},
          {"id": "glm-5-turbo", "label": "GLM 5 Turbo", "isDefault": true}
        ]
      }
    }
  }
}
```

**注意事项：**
- 第三方端点不支持 Anthropic-only 工具如 `WebSearch`
- 使用 `disallowedTools` 禁用不支持的工具
- Z.AI 使用 `ANTHROPIC_AUTH_TOKEN` 而不是 `ANTHROPIC_API_KEY`

### 3. ACP (Agent Client Protocol) 提供商

适用于：本地 Ollama、Gemini CLI、Hermes、自定义 agent 等

```json
{
  "agents": {
    "providers": {
      "local-ollama": {
        "extends": "acp",
        "enabled": true,
        "label": "本地 Ollama",
        "command": ["ollama-acp", "--stdio"],
        "models": [
          {"id": "qwen2.5-coder:32b", "label": "Qwen2.5 Coder 32B"}
        ]
      }
    }
  }
}
```

**注意事项：**
- 必须提供 `command` 数组
- Agent 必须支持 ACP over stdin/stdout
- 可选：设置 `params.supportsMcpServers: false` 如果 agent 不支持 MCP

### 4. 多配置文件

同一 provider 的多个配置（如工作/个人账号）：

```json
{
  "agents": {
    "providers": {
      "openai-work": {
        "extends": "codex",
        "enabled": true,
        "label": "OpenAI (工作)",
        "env": {
          "OPENAI_API_KEY": "sk-work-..."
        }
      },
      "openai-personal": {
        "extends": "codex",
        "enabled": true,
        "label": "OpenAI (个人)",
        "env": {
          "OPENAI_API_KEY": "sk-personal-..."
        }
      }
    }
  }
}
```

## 配置字段参考

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `extends` | string | 是 | 继承的内置 provider：`codex`, `claude`, `acp` |
| `enabled` | boolean | 是 | 必须设置为 `true` 才会发布 |
| `label` | string | 是 | UI 显示名称 |
| `description` | string | 否 | 描述信息 |
| `command` | string[] | ACP 需要 | 启动 agent 的命令 |
| `env` | object | 否 | 环境变量（API key 等） |
| `models` | array | 推荐 | 模型列表 |
| `disallowedTools` | string[] | 否 | 禁用的工具名称 |
| `params` | object | 否 | Provider 特定参数 |

### Model 定义

```json
{
  "id": "model-id",
  "label": "显示名称",
  "description": "可选描述",
  "isDefault": true
}
```

## 验证配置

### 1. 启动 daemon

```bash
./scripts/start-harness-workbench.sh
```

### 2. 列出 providers

```bash
cd upstream/paseo
node packages/cli/bin/paseo provider ls --host 127.0.0.1:6877 --json
```

应该看到 `codex` 和你启用的自定义 providers。

Settings > Providers 会显示已配置的 custom provider，包括当前已停用、尚未发布到
provider snapshot 的条目，因此用户仍可重新启用或删除它们。启用的条目会发布到
snapshot，并可查看状态、刷新诊断和管理附加模型。该入口支持新建、编辑、启停和删除；
保存后会触发 daemon reload 与 snapshot 更新，daemon 进程保持运行。当前实现已由组件测试、
配置契约和浏览器 E2E 覆盖；移动端真机验收仍待完成。

### 3. 运行 diagnostic

```bash
node packages/cli/bin/paseo provider diagnostic my-openai --host 127.0.0.1:6877
```

### 4. 测试对话

```bash
node packages/cli/bin/paseo run \
  --host 127.0.0.1:6877 \
  --provider my-openai/gpt-4-turbo \
  --cwd /tmp \
  --wait-timeout 2m \
  'Reply: OK'
```

## 移动端配置

配置自定义 provider 后，已发布的 provider 元数据会通过现有连接同步到配对设备：

1. 在桌面端配置 provider
2. 通过 E2EE relay 连接移动端
3. 移动端会看到所有已发布的 providers
4. 在移动端选择 provider 创建对话

API key 等凭证只保存在 daemon 本机，不会同步到移动端。共享 Settings UI 已具备
custom provider 管理能力，但移动真机上的完整配置生命周期仍属于设备验收范围。

## 常见问题

### Q: 能否完全禁用 Codex？

**不能。** Codex 是架构核心，必须始终启用。但你可以默认使用其他 provider。

### Q: 自定义 provider 的凭证安全吗？

配置文件存储在本地文件系统。通过 E2EE relay 连接的移动端不会接收到 API keys（只看到 provider 列表）。

### Q: 支持哪些协议？

- OpenAI Responses API（不仅仅是 chat completions）
- Anthropic Messages API
- Agent Client Protocol (ACP) over stdio

### Q: 如何使用本地模型？

使用 ACP provider 配合支持 ACP 的本地 wrapper：

1. 启动 Ollama/llama.cpp server
2. 使用支持 ACP 的 wrapper（如 ollama-acp）
3. 配置为 ACP provider

### Q: 配置更改后如何生效？

通过 Settings > Providers 新建、编辑、启停或删除 custom provider 并保存后，客户端会
请求 daemon reload 配置并刷新 provider snapshot，daemon 进程保持运行。Codex 在 reload
前后都保持启用且不能删除。

## 示例配置

完整示例见：`config/custom-providers.example.json`

## 架构说明

```text
Paseo clients
    │
    ▼
Paseo daemon
    ├─ Codex (required)
    ├─ Custom OpenAI-compatible provider
    ├─ Custom Anthropic-compatible provider
    └─ Custom ACP provider
         │
         ▼
    各自的 API endpoint 或 local agent
```

- Codex 仍然通过 Rust bridge → `codex app-server`
- 自定义 providers 通过现有的 Paseo adapter（CodexAppServerAgentClient、ACPAgentClient 等）
- 不违背"Codex 是唯一 harness"的原则——其他 providers 是可选的辅助能力

## 下一步

- [x] 真实浏览器验证新建、编辑、停用、重新启用和删除的完整生命周期
- [ ] 移动端 provider 选择优化
- [ ] 热更新失败回滚和并发修改压力测试
- [ ] Provider 健康检查和自动切换
