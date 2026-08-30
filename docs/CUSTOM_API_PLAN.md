# 自定义 API 与手机体验改善计划

**档案**：2026-08-24 专项计划快照，不是当前必读。阶段 1「当时架构强制 Codex-only」已由产品 builtin 发行 + required Codex 取代。当前剩余工作见 [`docs/tasks.md`](tasks.md)。

最后更新：2026-08-24（档案）

## 背景

用户需求：
1. 支持自定义 API endpoint（因高版本 Codex 不再支持 API 配置）
2. 改善手机远程体验

## 技术方案

### 阶段 1：放宽 Provider 限制（1-2 天）

当时架构强制 Codex-only；目标是 "Codex 优先 + 可选自定义 provider"。产品侧此后已发行 claude / copilot / opencode / pi，Codex 仍 required。

#### 修改点

**1. Paseo provider 管理器**

文件：`upstream/paseo/packages/server/src/server/agent/provider-snapshot-manager.ts`

```typescript
// 当前：硬编码 ['codex']
const PUBLISHED_PROVIDER_ALLOWLIST = ['codex'];

// 修改为：从配置读取
const PUBLISHED_PROVIDER_ALLOWLIST = [
  'codex',  // 必须保留
  ...getCustomProviderIds()  // 从 config.json 读取启用的自定义 provider
];
```

**2. 配置 schema**

允许用户在 `.paseo-dev/config.json` 定义自定义 provider：

```json
{
  "version": 1,
  "agents": {
    "providers": {
      "codex": {
        "enabled": true
      },
      "my-openai-api": {
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
      },
      "my-claude-proxy": {
        "extends": "claude",
        "enabled": true,
        "label": "Claude 代理",
        "env": {
          "ANTHROPIC_API_KEY": "sk-ant-...",
          "ANTHROPIC_BASE_URL": "https://my-proxy.example.com"
        },
        "disallowedTools": ["WebSearch"]
      },
      "local-ollama": {
        "extends": "acp",
        "enabled": true,
        "label": "本地 Ollama",
        "command": ["ollama-acp-wrapper"],
        "models": [
          {"id": "qwen2.5-coder", "label": "Qwen2.5 Coder"}
        ]
      }
    }
  }
}
```

**3. UI 更新**

文件：`upstream/paseo/packages/app/src/screens/settings/providers-section.tsx`

- 保留 Codex（始终显示，不可禁用）
- 显示自定义 provider 列表
- 添加"添加自定义 API"按钮

#### 验证

```bash
cd upstream/paseo
npm test -- provider-snapshot-manager.test.ts
npm test -- bootstrap.smoke.test.ts
npm run build:server

cd ../..
./scripts/start-harness-workbench.sh
# 验证可以同时看到 codex 和自定义 provider
node upstream/paseo/packages/cli/bin/paseo provider ls --host 127.0.0.1:6877
```

### 阶段 2：移动端验证与优化（2-3 天）

#### 2.1 E2EE Relay 与配对

**测试场景：**
1. 桌面端启动 daemon
2. Android/iOS 扫码配对
3. 验证 E2EE 加密连接
4. 创建对话，验证消息往返

**配置：**
```json
{
  "relay": {
    "enabled": true,
    "url": "wss://relay.paseo.sh"
  }
}
```

#### 2.2 断线重连测试

**测试场景：**
1. 移动端连接并开始对话
2. 切换网络（WiFi ↔ 4G）
3. 进入飞行模式 10 秒后恢复
4. 验证 replay buffer 自动恢复对话状态

当前 Rust bridge 已实现：
- 2048 条有界 replay buffer
- 过期 cursor 的 `reset_required` 信号

**需验证：**
- 移动端 cursor 管理
- 超过 replay buffer 后的完整刷新

#### 2.3 移动端 UI 适配

**审批交互：**
- 命令审批的移动端 modal
- 文件审批的 diff 查看
- 用户输入表单

**后台终端：**
- 移动端 terminal 输出查看
- 基本命令输入（可选）

### 阶段 3：配置管理 UI（1-2 天）

#### 桌面/Web 端

新增设置页面：**API 配置**

功能：
- 列出所有自定义 API
- 添加/编辑/删除配置
- 测试连接（diagnostic）
- 模型发现

#### 移动端

简化版：
- 查看已配置的 API
- 选择默认 provider
- 基本连接状态

## 架构影响评估

### 不违背核心原则

✅ **Codex 仍是主要 runtime**：默认启用，不可禁用
✅ **不重写 agent loop**：自定义 API 仍通过 Codex/Claude/ACP adapter
✅ **保持 Paseo 作为产品面**：只是开放 provider 配置能力

### 变更点

1. **provider 管理策略**：从"只有 Codex"改为"Codex + 可选自定义"
2. **配置边界**：允许用户配置但不允许完全禁用 Codex
3. **UI 暴露**：设置页显示自定义 provider 管理

### 与现有进度的关系

- ✅ M1 Rust bridge：无影响，继续使用
- ✅ M2 Paseo fork：需要修改 provider allowlist 逻辑
- ⏸️ M3 OMP primitives：独立，不冲突
- ⏸️ M4 桌面功能：并行推进

## 实施优先级

### P0（立即）
1. 修改 Paseo provider 管理，允许自定义 provider
2. 验证 extends codex/claude/acp 的配置路径

### P1（本周）
3. 移动端 E2EE relay 真实配对测试
4. 断线重连场景验证
5. 基本配置 UI

### P2（下周）
6. 移动端审批/终端 UI 优化
7. 完整配置管理界面
8. 多 API 配置文档

## 风险与缓解

**风险 1：自定义 API 兼容性**
- 缓解：只支持标准协议（OpenAI Responses API、Anthropic API、ACP）
- 非标准端点需用户自行验证

**风险 2：移动端性能**
- 缓解：replay buffer 已限制 2048 条，防止内存爆炸
- 大文件 diff 需要分页加载

**风险 3：上游 Paseo 同步冲突**
- 缓解：修改点集中在 provider 管理，保持最小改动面
- 定期 rebase 上游更新

## 验收标准

### 自定义 API
- [ ] 可配置至少 3 种自定义 provider（OpenAI、Claude proxy、ACP）
- [ ] 配置后可在 provider 列表看到
- [ ] 可以创建对话并完成一次成功的 turn
- [ ] diagnostic 正确显示连接状态和模型列表

### 手机体验
- [ ] Android/iOS 成功配对并建立 E2EE 连接
- [ ] 网络切换后自动重连，对话状态不丢失
- [ ] 审批请求在移动端正确显示并可操作
- [ ] 基本 terminal 输出可查看

## 时间估算

- 阶段 1：1-2 天（核心开发）
- 阶段 2：2-3 天（移动端测试）
- 阶段 3：1-2 天（UI 完善）

**总计：4-7 天**

## 下一步

1. 确认方案可行性（与用户讨论）
2. 创建开发分支
3. 修改 provider 管理逻辑
4. 添加配置 schema 验证
5. 真实 API 端点测试
