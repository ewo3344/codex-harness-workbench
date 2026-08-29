# Codex Harness Workbench - 完整实施计划

**项目名称**：Codex Harness Workbench 自定义 API 与移动端体验完善  
**版本**：v1.0  
**创建日期**：2026-08-24  
**最后更新**：2026-08-27  
**预计完成**：2026-09-10（~3 周）

---

## 📋 目录

- [执行摘要](#执行摘要)
- [项目目标](#项目目标)
- [当前状态](#当前状态)
- [技术架构](#技术架构)
- [详细阶段规划](#详细阶段规划)
- [风险管理](#风险管理)
- [资源需求](#资源需求)
- [验收标准](#验收标准)
- [时间线与里程碑](#时间线与里程碑)
- [后续演进](#后续演进)

---

## 执行摘要

### 背景

Codex Harness Workbench 当前已完成核心 Rust bridge 和基础 Paseo 集成，但存在两个关键需求：
1. **高版本 Codex 不再支持自定义 API 配置**，限制了用户使用第三方或本地模型的能力
2. **移动端体验尚未完整验证**，E2EE relay、配对、断线重连等功能待测试

### 已完成（2026-08-27）

- ✅ 修改 Paseo provider 管理，支持自定义 API（阶段 1）
- ✅ 完整文档体系（配置指南、快速开始、示例）
- ✅ 自动化验证脚本
- ✅ 所有测试通过（76 tests）
- ✅ 新建工作区默认进入 Codex CLI inline terminal；桌面端沿用 Paseo workspace split/pane 布局
- ✅ 本地临时 E2EE relay、pairing offer 和 relay client CLI 基线验证
- ✅ 实体 Android 16 Debug 客户端完成 relay offer 注册，发出控制 RPC，并在 grace window 内恢复 relay 会话
- ✅ 本地 E2EE `DaemonClient` relay socket 断线重连、timeline cursor 追赶和 provisional 去重验证
- ✅ 本地 E2EE `DaemonClient` relay 终端创建、订阅、二进制输入/输出、resize 和终止验证
- ✅ 真实 Paseo Web、packaged daemon 和本地 Wrangler E2EE relay 的 terminal 浏览器 E2E 验收；浏览器无 daemon WebSocket 直连，三个被检查的终端明文均未出现在 relay wire
- ✅ 真实 Paseo Web 的 relay deployment 流式恢复与上述 terminal 用例由正式套件验证：`2 passed (40.4s)`
- ✅ 独立 Linux `relay-browser-e2e` CI 门禁固定 relay commit、OTP/Elixir 版本并执行上述两个真实浏览器规格
- ✅ Paseo Web 新建工作区默认选择 Codex CLI terminal 的独立 `1/1 browser E2E` 验证
- ✅ provisional live timeline 事件的 reconnect epoch 契约已由 daemon E2E 回归覆盖
- ✅ Settings > Providers 支持 OpenAI-compatible、Anthropic-compatible 和 ACP custom provider 的新建、编辑、启停与删除
- ✅ 保存 provider 配置后触发 daemon 配置 reload 和 provider snapshot 刷新，daemon 进程保持运行
- ✅ Codex required provider 约束同时落实在 UI 与 daemon 配置边界

### 待完成

- 🚧 移动端真实验证（阶段 2）
- 🚧 配置管理 UI 的移动真机验收（阶段 3；真实浏览器 provider 生命周期已验收，实现已完成）
- 🚧 高级功能（阶段 4）
- 🚧 生产就绪（阶段 5）

---

## 项目目标

### 主要目标

1. **自定义 API 完全可用**
   - 用户可配置多个 API 端点
   - 支持 OpenAI、Anthropic、ACP 三种协议
   - 配置简单、文档完善
   - Web UI 配置管理

2. **优秀的移动端体验**
   - Android/iOS 稳定配对
   - 断线自动重连
   - 审批交互流畅
   - 离线/弱网场景友好

3. **生产就绪**
   - 完整的错误处理
   - 健康检查与监控
   - 安全审计通过
   - 性能达标

### 成功指标

| 指标 | 目标 | 当前 |
|------|------|------|
| 支持的 API 类型 | 3+ | 3 ✅ |
| 移动端配对成功率 | >95% | 单台 Android relay offer 注册已观察到；成功率未测试 |
| 断线重连时间 | <5s | Web 受控 relay deployment 的 `totalReconnectMs=6443`，尚未达标；Android 网络切换未测试 |
| 配置操作时间 | <2min | Settings UI 已实现；真实浏览器计时待验 |
| 测试覆盖率 | >80% | ~70% |

---

## 当前状态

### 已实现功能矩阵

| 功能 | Web/Desktop | 移动端 | 说明 |
|------|--------|--------|------|
| Codex 基础对话 | ✅ 完成 | ⏸️ 未验证 | 桌面真实验证通过；Android 仅验证 relay 控制面，未验收聊天或 agent stream |
| 自定义 API 配置 | ✅ 完成 | 🚧 共享 UI 已实现，真机待验 | Settings > Providers 支持三类 custom provider 的新建、编辑、启停和删除 |
| Provider 发现 | ✅ 完成 | 🚧 共享 UI 已实现，真机待验 | UI 与 CLI 均可查看已发布 provider；设备显示仍待验收 |
| E2EE Relay | ✅ Web 本地路径；🚧 Desktop 待验 | 🚧 Android 部分已验证 | Web terminal 通过本地 Wrangler relay；Android relay 控制会话与恢复已观察到，Desktop/iOS/hosted TLS 待验 |
| 配对机制 | 🚧 待验证 | 🚧 Android offer 注册已验证 | Android 已注册 relay daemon；QR/输入、多设备、失败路径和 iOS 待验 |
| 断线重连 | ✅ Web 受控 deployment；🚧 Desktop 待验 | 🚧 设备网络待验证 | Web stream 无需用户操作恢复；`DaemonClient` cursor 追赶与 Rust replay reset 为独立契约证据，移动网络切换和客户端完整刷新待验 |
| 审批交互 | ✅ 部分完成 | ⏸️ 未测试 | 命令审批已验证 |
| 后台终端 | ✅ Web relay terminal；🚧 Desktop 待验 | ⏸️ 未测试 | Web 浏览器已验收创建/订阅、输入/输出和 resize；`DaemonClient` 另行覆盖终止，移动 terminal UI 待验 |
| 配置 UI | ✅ 浏览器生命周期已验收 | 🚧 共享 UI 已实现，真机待验 | 保存后执行 daemon 配置 reload 与 snapshot 刷新；移动端真机生命周期待验 |

### 技术债务

1. **配置生命周期验收**：真实浏览器 provider 生命周期、reload 失败原子回滚和同步嵌套更新基线已通过；协议级版本冲突、活跃会话连续性和浏览器专项指标仍待验证
2. **移动端未完整验证**：单台 Android 的 relay 注册、控制面和短暂 session resume 已验证；聊天、agent stream、审批、终端和网络场景仍未验收
3. **错误处理**：部分边界情况未覆盖
4. **文档**：移动端文档不足

---

## 技术架构

### 目标架构

```text
┌─────────────────────────────────────────────────────────┐
│              Paseo Clients (多端)                        │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │   Web    │ Desktop  │ Android  │   iOS    │         │
│  └─────┬────┴────┬─────┴────┬─────┴────┬─────┘         │
│        │         │          │          │                │
│        │    WebSocket + E2EE Relay     │                │
└────────┼─────────┼──────────┼──────────┼────────────────┘
         │         │          │          │
         └─────────┴──────────┴──────────┘
                    │
         ┌──────────▼──────────┐
         │ Rust Workbench      │
         │ Daemon              │
         │ ┌─────────────────┐ │
         │ │ Event Router    │ │
         │ │ Replay Buffer   │ │
         │ │ Auth & Pairing  │ │
         │ └─────────────────┘ │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────────────────────┐
         │ Paseo TypeScript Daemon (Provider)  │
         │ ┌─────────┬─────────┬──────────┐   │
         │ │ Codex   │ Custom  │ Custom   │   │
         │ │(required)│ OpenAI │ Claude   │   │
         │ └────┬────┴────┬────┴────┬─────┘   │
         └──────┼─────────┼─────────┼──────────┘
                │         │         │
         ┌──────▼─────────▼─────────▼─────┐
         │ codex    OpenAI    Anthropic   │
         │ app-     API       API          │
         │ server                          │
         └─────────────────────────────────┘
```

### 关键组件

| 组件 | 职责 | 状态 |
|------|------|------|
| Rust Daemon | 事件路由、replay、配对 | 🚧 进行中 |
| Paseo Daemon | Provider 管理、会话控制 | ✅ 基本完成 |
| Codex Bridge | app-server 通信 | ✅ 完成 |
| Web Client | UI 交互 | ✅ relay terminal 路径已验收；其余功能逐项收口 |
| Desktop Client | UI 交互 | 🚧 待验收 |
| Mobile Client | 移动端 UI | ⏸️ 待验证 |
| E2EE Relay | 加密中继 | 🚧 Web 本地路径已验；生产与设备路径待验 |

---

## 详细阶段规划

### 阶段 1：自定义 API 基础支持 ✅ 已完成

**时间**：2026-08-24（1 天）  
**状态**：✅ 完成

<details>
<summary>展开查看详情</summary>

#### 任务清单

- [x] 修改 Paseo provider 管理逻辑
- [x] 实现 `getEnabledCustomProviderIds()` 函数
- [x] 添加 provider allowlist 日志
- [x] 创建配置示例（3 种场景）
- [x] 编写完整配置指南
- [x] 编写快速开始文档
- [x] 创建验证脚本
- [x] 运行测试验证（76 tests）

#### 产出

- `upstream/paseo/packages/server/src/server/bootstrap.ts`（修改）
- `docs/CUSTOM_PROVIDERS.md`
- `docs/CUSTOM_API_PLAN.md`
- `docs/QUICKSTART.md`
- `config/custom-providers.example.json`
- `scripts/verify-custom-providers.sh`

#### 验收结果

- ✅ 所有测试通过
- ✅ 文档完整
- ✅ 配置示例可用

</details>

---

### 阶段 2：移动端核心验证 🚧 进行中

**时间**：2026-08-25 ~ 2026-08-27（3 天）  
**优先级**：P0（最高）  
**负责人**：TBD

#### 2.1 E2EE Relay 与配对 (Day 1)

**目标**：验证加密中继和配对机制在真实设备上可用

##### 任务清单

- [ ] **环境准备**
  - [x] 准备实体 Android 16 测试设备并安装 Paseo Debug 包
  - [ ] 准备 iOS 测试设备（需 Apple Developer 账号）
  - [x] 配置 Android 开发环境并构建 Debug 包
  - [ ] 配置 iOS 开发证书和签名
  - [ ] 构建 iOS 应用

- [ ] **Relay 配置**
  - [x] 通过临时本地 Wrangler relay 验证 relay 连通性、E2EE 帧、daemon 注册和 pairing offer client
  - [x] 固化独立验证入口：`./scripts/verify-relay.sh`
  - [x] 通过真实 E2EE `DaemonClient` 验证 relay terminal 的创建、订阅、输入/输出、resize 与终止
  - [x] 通过真实 Paseo Web、packaged daemon 和本地 Wrangler E2EE relay 验证浏览器 terminal 创建/订阅、输入/输出与 resize；浏览器无 daemon WebSocket 直连，relay wire 未出现三个被检查的终端明文
  - [x] 在实体 Android 上启用 relay，并观察到 relay offer 注册后的控制 RPC、`helloResumed` 和 relay worker 重启后的新 `hello`
  - [ ] 在 iOS 设备上启用 relay 并抓取握手证据
  - [ ] 验证 hosted TLS relay 配置

- [ ] **配对流程**
  - [x] 隔离 daemon 生成 relay pairing offer
  - [x] Android 使用 relay offer 注册 daemon，并持久化 relay endpoint、daemon public key 与 server id
  - [ ] 移动端扫码或输入配对码
  - [ ] 验证 QR/输入配对成功状态
  - [ ] 测试配对失败场景（错误码、超时）
  - [ ] 测试多设备配对

- [ ] **通信验证**
  - [x] Android 通过 relay 发送 `fetch_agents`、`project.list`、`fetch_workspaces` 与 `client_heartbeat` 控制 RPC
  - [x] relay worker 恢复后，Android 重新加载 host 创建的已有 agent/timeline 投影；该次 provider 结果为错误，不计作成功 assistant 回复
  - [ ] 移动端发送消息，桌面端接收
  - [ ] 桌面端发送消息，移动端接收
  - [ ] 验证消息顺序和完整性
  - [ ] 测试大消息（>1MB）

##### 验收标准

- [ ] Android/iOS 均可成功配对
- [ ] E2EE 加密验证通过（抓包无明文）
- [ ] 配对过程 <30 秒
- [ ] 消息传输无丢失

##### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| Relay 服务不稳定 | 中 | 高 | 准备备用 relay，或本地测试 |
| iOS 签名问题 | 高 | 中 | 使用 TestFlight 或企业证书 |
| 加密性能问题 | 低 | 中 | Profile 并优化热点代码 |

---

#### 2.2 断线重连机制 (Day 2)

**目标**：验证网络中断后自动恢复功能

##### 任务清单

- [ ] **基础重连测试**
  - [x] 本地 E2EE `DaemonClient` socket 中断后自动重连，并按 timeline cursor 追赶 committed row
  - [x] 真实 Paseo Web 在受控 relay deployment 后自动恢复 stream：`reconnectToastDelayMs=1331`、`reconnectToastVisibleMs=5112`、`totalReconnectMs=6443`、`relayStartupMs=533`，且暂停、running 状态保留和无操作恢复三项断言均为 `true`
  - [ ] 启动对话，中途关闭移动端网络
  - [ ] 10 秒后恢复网络
  - [ ] 验证对话状态自动恢复
  - [ ] 验证未读消息正确同步

- [ ] **网络切换测试**
  - [ ] WiFi → 4G 切换
  - [ ] 4G → WiFi 切换
  - [ ] 弱网场景（限速到 100KB/s）
  - [ ] 飞行模式切换

- [ ] **Replay Buffer 测试**
  - [x] Rust bridge 默认 2048 条窗口：发送 2049 条 JSONL 事件后，过期 cursor 返回 `reset_required`，保留窗口边界正确
  - [ ] 生成 >2048 条事件的长对话
  - [ ] 断线后重连
  - [ ] 验证收到 `reset_required` 信号
  - [ ] 验证完整历史重新加载

- [ ] **边界情况**
  - [ ] 发送消息时断网
  - [ ] 审批过程中断网
  - [ ] 文件传输中断网
  - [ ] 长时间离线（>1 小时）重连

##### 验收标准

- [ ] 网络恢复后 <5 秒自动重连
- [ ] 消息无丢失、无重复
- [ ] Replay buffer 正确处理溢出
- [ ] 用户感知友好（loading 状态清晰）

##### 测试矩阵

| 场景 | WiFi→4G | 4G→WiFi | 飞行模式 | 弱网 | 长时离线 |
|------|---------|---------|----------|------|----------|
| Android | ⏸️ | ⏸️ | ⏸️ | ⏸️ | ⏸️ |
| iOS | ⏸️ | ⏸️ | ⏸️ | ⏸️ | ⏸️ |

---

#### 2.3 移动端 UI/UX 验证 (Day 3)

**目标**：确保移动端交互流畅、易用

##### 任务清单

- [ ] **Provider 管理（共享 UI 已实现，移动真机待验）**
  - [x] Settings > Providers 列表和 custom provider 管理界面
  - [x] OpenAI-compatible、Anthropic-compatible、ACP 的新建与编辑
  - [x] Custom provider 启用、停用和删除，以及 Codex 不可停用或删除约束
  - [ ] 在 Android/iOS 真机查看 provider 列表与状态
  - [ ] 在 Android/iOS 真机完成 custom provider 生命周期操作
  - [ ] 选择 provider 创建对话并验证实际请求路径

- [ ] **审批交互**
  - [ ] 命令审批 UI（允许/拒绝/查看详情）
  - [ ] 文件审批 UI（查看 diff、允许/拒绝）
  - [ ] 用户输入表单（文本输入、选项选择）
  - [ ] 批量审批（全部允许/拒绝）

- [ ] **对话管理**
  - [ ] 创建新对话
  - [ ] 查看对话列表
  - [ ] 恢复历史对话
  - [ ] 删除对话
  - [ ] 对话搜索/筛选

- [ ] **后台终端**
  - [ ] 查看终端输出（只读）
  - [ ] 终端输出滚动和搜索
  - [ ] 长输出性能测试（>10,000 行）
  - [ ] ANSI 颜色支持

- [ ] **响应式设计**
  - [ ] 手机竖屏布局
  - [ ] 手机横屏布局
  - [ ] 平板布局
  - [ ] 暗色/亮色主题

##### 验收标准

- [ ] 所有功能触达 ≤3 次点击
- [ ] 审批操作响应时间 <500ms
- [ ] 长列表滚动流畅（60fps）
- [ ] 无明显 UI bug

##### UI 截图检查清单

- [ ] Provider 列表页
- [ ] 对话页（有消息）
- [ ] 审批弹窗（命令、文件）
- [ ] 终端输出页
- [ ] 设置页

---

### 阶段 3：配置管理 UI ✅ 实现完成，🚧 移动设备验收进行中

**原计划时间**：2026-08-28 ~ 2026-08-30（实现已于 2026-08-27 提前落地）  
**优先级**：P1  
**状态**：功能实现完成；真实浏览器 provider 生命周期已验收，移动真机仍待验收

#### 3.1 Web/Desktop 与共享 Settings 界面

##### 已实现能力

- [x] Settings > Providers 展示 Codex 和已配置的 custom providers，包括停用条目
- [x] 新建和编辑 OpenAI-compatible provider
- [x] 新建和编辑 Anthropic-compatible provider
- [x] 新建和编辑 ACP custom provider
- [x] 启用、停用和删除 custom provider
- [x] 保存后通过现有 daemon 配置 RPC 请求 reload，并刷新 provider snapshot
- [x] Codex 保持 required provider；UI 不提供停用或删除操作，daemon 配置边界也拒绝破坏该约束
- [x] JSON 配置保留为高级配置和故障排查入口，不再是唯一管理路径

##### 当前实现边界

配置 UI 复用现有 daemon 配置 RPC 和 provider snapshot 发布机制，没有引入一套独立的
Provider CRUD REST API。新建、编辑、启停或删除成功后，daemon 进程保持运行，客户端
通过刷新的 snapshot 观察最终 provider 状态。

真实浏览器 provider 生命周期 E2E 已通过：OpenAI-compatible provider 完成“新建 -> 编辑
（留空密钥保留原值） -> 停用 -> 重新启用 -> 删除”，并覆盖 Anthropic API key/token 与
ACP（含带空格参数）配置路径。每次变更后的 snapshot 与持久化状态一致，daemon 进程保持
运行；全过程 117 个 WebSocket 帧未发现凭证泄漏。完整证据见
`verification/custom-provider-lifecycle-20260827/VERIFICATION.txt`。

##### 待验证任务

- [x] 在真实浏览器中验证三种 custom provider 配置路径（OpenAI 完整 CRUD；Anthropic key/token 与 ACP 新建/删除）
- [x] 验证每次操作后的 reload 结果、snapshot 状态与持久化配置一致
- [x] 验证 Codex 在 UI 和 daemon 配置边界均不可停用或删除
- [ ] 覆盖重复 ID、无效字段、凭证缺失和 daemon 拒绝等错误反馈
- [ ] 测量真实浏览器配置操作时间和 UI 响应时间

##### 验收标准

- [x] 三种 custom provider 均具备可视化新建和编辑入口
- [x] Custom provider 具备启用、停用和删除入口
- [x] 保存后配置 reload 和 provider snapshot 刷新不依赖 daemon 进程重启
- [x] Codex required provider 不可停用或删除
- [x] 真实浏览器 provider 生命周期 E2E 通过（OpenAI 完整 CRUD；Anthropic key/token 与 ACP 路径覆盖）
- [ ] 配置操作时间 <2min
- [ ] 浏览器 E2E 中配置保存成功率 100%

---

#### 3.2 移动端配置界面与验收

Paseo 客户端复用 Settings > Providers 界面，因此 custom provider 管理能力已存在于共享
UI 层。当前缺口是 Android/iOS 真机行为、布局、网络恢复和凭证输入体验的验收，而不是
重新实现一套移动端 Provider CRUD 页面。

##### 已实现能力

- [x] 共享 Provider 列表与详情入口
- [x] 共享 custom provider 新建、编辑、启停和删除操作
- [x] 共享 Codex required provider 交互约束
- [x] Provider snapshot 作为 UI 状态来源

##### 待验证任务

- [ ] Android 真机完成 provider 列表、状态和三种类型表单验收
- [ ] iOS 真机完成 provider 列表、状态和三种类型表单验收
- [ ] 真机完成新建、编辑、停用、重新启用和删除生命周期
- [ ] 验证小屏、横屏、软键盘和敏感字段输入体验
- [ ] 验证断线、弱网和 reload 失败后的状态恢复
- [ ] 选择 custom provider 创建对话并确认实际请求路径

---

### 阶段 4：高级功能增强 🚧 部分完成

**时间**：2026-09-02 ~ 2026-09-06（5 天）  
**优先级**：P2

#### 4.1 配置热更新基线 ✅ 已实现，reload 失败原子回滚 ✅，稳定性增强 🚧 待验证

**当前结果**：Settings UI 保存 custom provider 变更后，会请求 daemon reload 配置并
刷新 provider snapshot。daemon 进程在新建、编辑、启停和删除期间保持运行。

##### 当前实现路径

1. Settings > Providers 提交配置变更。
2. 客户端通过现有 daemon 配置 RPC 持久化变更并请求 reload。
3. Daemon 重建并发布 provider snapshot。
4. 客户端以刷新后的 snapshot 展示最终状态。
5. UI 与 daemon 边界在整个过程中共同保持 Codex required provider 约束。

##### 任务清单

- [x] 新建、编辑、启停和删除触发配置 reload
- [x] Reload 后刷新 provider snapshot
- [x] Reload 前后保持 Codex 不可停用或删除
- [x] Daemon 进程在配置更新期间保持运行
- [x] 验证 live owner 拒绝 reload 时的原子回滚（live state、内存配置和持久化文件）
- [x] 验证同步 `onChange` 嵌套 patch 不覆盖最新持久化基线
- [ ] 测试多个客户端并发修改和版本冲突
- [ ] 验证活跃会话在 provider 变更期间的连续性
- [ ] 完善 reload 结果与失败原因的日志审计
- [ ] 进行长时间重复更新压力测试

---

#### 4.2 Provider 健康检查

**目标**：自动监控 provider 状态，异常时告警

##### 功能设计

```typescript
interface HealthCheck {
  providerId: string
  status: 'healthy' | 'degraded' | 'down'
  latency: number  // ms
  lastCheck: Date
  errorRate: number  // 0-1
}
```

##### 任务清单

- [ ] 实现定期 health check（每 5 分钟）
- [ ] 记录响应时间和错误率
- [ ] 状态变化时推送通知
- [ ] Dashboard 显示健康状态
- [ ] 自动切换到备用 provider（可选）

---

#### 4.3 批量配置管理

**目标**：支持导入/导出、模板、批量操作

##### 功能列表

- [ ] **导出配置**
  - [ ] 导出为 JSON 文件
  - [ ] 导出时脱敏（移除 API keys）
  - [ ] 导出选定 providers

- [ ] **导入配置**
  - [ ] 从 JSON 导入
  - [ ] 合并模式（保留现有配置）
  - [ ] 替换模式（覆盖现有配置）
  - [ ] 导入预览和确认

- [ ] **配置模板**
  - [ ] 内置模板（OpenAI、Claude、Z.AI 等）
  - [ ] 用户自定义模板
  - [ ] 从模板快速创建

- [ ] **批量操作**
  - [ ] 批量启用/禁用
  - [ ] 批量删除
  - [ ] 批量测试连接

---

#### 4.4 高级审批功能

**目标**：增强审批体验和控制能力

##### 功能需求

- [ ] **审批策略**
  - [ ] 按命令类型自动审批（白名单）
  - [ ] 按文件路径自动审批
  - [ ] 记住我的选择（本次会话）
  - [ ] 信任此 provider

- [ ] **审批历史**
  - [ ] 查看所有审批记录
  - [ ] 按时间/类型筛选
  - [ ] 导出审批日志

- [ ] **审批 UI 改进**
  - [ ] 命令预览（高亮危险操作）
  - [ ] Diff 查看器增强（侧边对比）
  - [ ] 审批理由说明
  - [ ] 快捷键支持（Y/N/D）

---

### 阶段 5：生产就绪 🚀 最终阶段

**时间**：2026-09-09 ~ 2026-09-10（2 天）  
**优先级**：P0

#### 5.1 性能优化

##### 目标指标

| 指标 | 目标 | 当前 |
|------|------|------|
| Provider 列表加载 | <500ms | TBD |
| 配置保存响应 | <200ms | TBD |
| 移动端首屏渲染 | <2s | TBD |
| Replay 同步延迟 | <1s | TBD |
| 内存占用（daemon） | <500MB | TBD |

##### 任务清单

- [ ] **性能测试**
  - [ ] 建立性能基线
  - [ ] 压力测试（1000+ 消息）
  - [ ] 内存泄漏检测
  - [ ] CPU profile 分析

- [ ] **优化措施**
  - [ ] Provider 列表懒加载
  - [ ] 配置写入防抖
  - [ ] 移动端虚拟滚动
  - [ ] Replay buffer 分页加载
  - [ ] 不必要的重渲染消除

---

#### 5.2 安全审计

##### 检查清单

- [ ] **配置安全**
  - [ ] API keys 加密存储
  - [ ] 敏感信息不写入日志
  - [ ] 配置文件权限检查（600）
  - [ ] 环境变量隔离

- [ ] **网络安全**
  - [ ] E2EE 密钥强度验证
  - [ ] TLS 证书验证
  - [ ] MITM 攻击防护
  - [ ] Replay attack 防护

- [ ] **代码安全**
  - [ ] 依赖漏洞扫描（npm audit）
  - [ ] XSS 防护（UI 输入）
  - [ ] SQL/Command injection 检查
  - [ ] 敏感操作审计日志

---

#### 5.3 文档完善

##### 文档清单

- [ ] **用户文档**
  - [x] 快速开始指南 ✅
  - [x] 配置指南 ✅
  - [ ] 移动端使用指南（待补充）
  - [ ] 故障排除手册（扩充）
  - [ ] 最佳实践
  - [ ] FAQ 更新

- [ ] **开发者文档**
  - [ ] 架构深入解析
  - [ ] API 参考
  - [ ] 扩展开发指南
  - [ ] 贡献指南

- [ ] **运维文档**
  - [ ] 部署指南
  - [ ] 监控和日志
  - [ ] 备份和恢复
  - [ ] 升级指南

- [ ] **视频教程**
  - [ ] 5 分钟快速上手
  - [ ] 自定义 API 配置
  - [ ] 移动端配对演示
  - [ ] 常见问题解决

---

#### 5.4 发布准备

##### 任务清单

- [ ] **版本管理**
  - [ ] 定义版本号（v1.0.0-alpha.1）
  - [ ] 编写 CHANGELOG
  - [ ] 打 Git tag
  - [ ] 创建 GitHub Release

- [ ] **构建产物**
  - [ ] Linux x64 binary
  - [ ] macOS arm64/x64 binary
  - [ ] Windows x64 binary
  - [ ] Docker image
  - [ ] Android APK
  - [ ] iOS IPA（TestFlight）

- [ ] **发布前检查**
  - [ ] 所有测试通过
  - [ ] 文档审阅完成
  - [ ] 安全审计通过
  - [ ] 性能达标
  - [ ] License 文件齐全

- [ ] **发布计划**
  - [ ] 内部 Alpha 测试（5 人）
  - [ ] 收集反馈并修复
  - [ ] 公开 Beta 发布
  - [ ] 正式 v1.0.0 发布

---

## 风险管理

### 高风险项

| 风险 | 描述 | 影响 | 可能性 | 优先级 | 缓解措施 |
|------|------|------|--------|--------|----------|
| **移动端配对失败** | E2EE relay 在真实网络环境不稳定 | 高 | 中 | P0 | 准备本地 LAN 模式备选；提供详细错误日志 |
| **iOS 审核被拒** | App Store 审核政策限制 | 高 | 中 | P0 | 使用 TestFlight；准备企业分发；避免私有 API |
| **配置热更新稳定性不足** | 并发修改或活跃会话期间的更新可能导致配置与 snapshot 不一致 | 中 | 中 | P1 | 原子回滚已补齐；继续验证并发冲突、活跃会话和重复更新压力测试 |
| **第三方 API 兼容性** | 某些端点不完全兼容标准协议 | 中 | 高 | P1 | 明确文档说明支持范围；提供兼容性测试工具 |
| **性能不达标** | 移动端在低端设备上卡顿 | 中 | 低 | P2 | 性能测试提前；优化关键路径；降级策略 |

### 中风险项

| 风险 | 缓解措施 |
|------|----------|
| UI 跨平台一致性 | 建立 UI 组件库；视觉回归测试 |
| 文档滞后 | 每个 PR 必须包含文档更新 |
| 测试覆盖不足 | 设置 CI 覆盖率门槛（>80%）|
| 依赖升级破坏兼容性 | 锁定依赖版本；升级前回归测试 |

### 低风险项

- 开发环境搭建问题：已有详细文档
- License 合规问题：已明确边界
- 代码风格不统一：已有 lint 规则

---

## 资源需求

### 人力资源

| 角色 | 需求 | 时间投入 | 说明 |
|------|------|----------|------|
| 全栈开发 | 1 人 | 全职 3 周 | 核心开发工作 |
| 移动端开发 | 1 人 | 兼职 1 周 | Android/iOS 测试与调优 |
| UI/UX 设计师 | 1 人 | 兼职 3 天 | 配置界面设计 |
| 测试工程师 | 1 人 | 兼职 1 周 | 移动端场景测试 |
| 技术写作 | 1 人 | 兼职 2 天 | 文档完善 |

### 硬件资源

| 设备 | 数量 | 用途 |
|------|------|------|
| Android 手机（中端） | 2 台 | 真实设备测试 |
| iPhone（iOS 16+） | 1 台 | iOS 测试 |
| 开发服务器 | 1 台 | CI/CD 构建 |

### 外部依赖

| 服务 | 费用 | 说明 |
|------|------|------|
| Apple Developer | $99/年 | iOS 应用签名 |
| Relay 服务器 | $20/月 | 测试期间使用官方 relay |
| 测试 API keys | 免费额度 | OpenAI/Anthropic 测试账号 |

---

## 验收标准

### 阶段性验收

#### 阶段 1 验收 ✅

- [x] 自定义 provider 配置可用
- [x] 三种协议类型支持
- [x] 测试全部通过
- [x] 文档完整

#### 阶段 2 验收 🚧

- [x] Web relay terminal 专项 E2E 通过；正式 relay deployment 套件为 `2 passed (40.4s)`，并已接入独立 Linux CI 门禁
- [ ] Android/iOS 配对成功率 >95%
- [ ] 断线重连时间 <5s
- [ ] 所有移动端 UI 功能可用
- [ ] 移动端测试矩阵完成

#### 阶段 3 验收 🚧

- [x] Web/Desktop 与共享 Settings 配置界面已实现
- [x] 三类 custom provider 支持新建、编辑、启停和删除
- [x] Codex 在 UI 和 daemon 配置边界均不可停用或删除
- [x] 真实浏览器 provider 生命周期 E2E 通过（OpenAI 完整 CRUD；Anthropic key/token 与 ACP 路径覆盖）
- [ ] 配置操作时间 <2min
- [ ] 移动真机配置生命周期正常
- [ ] 浏览器 E2E 中配置保存成功率 100%

#### 阶段 4 验收 🚧

- [x] 配置 reload 与 provider snapshot 热更新基线可用
- [x] 热更新失败回滚通过验证
- [ ] 并发修改和活跃会话稳定性通过验证
- [ ] Health check 正常运行
- [ ] 批量操作功能完整
- [ ] 高级审批策略生效

#### 阶段 5 验收 🚀

- [ ] 所有性能指标达标
- [ ] 安全审计通过
- [ ] 文档完整且审阅通过
- [ ] 构建产物可用

### 最终验收

**必须满足（Go/No-Go）**：

- [ ] 核心功能：Codex + 至少 2 个自定义 provider 可用
- [ ] 移动端：Android/iOS 配对和基本对话可用
- [ ] 稳定性：连续运行 24 小时无崩溃
- [ ] 安全性：无 P0/P1 安全问题
- [ ] 文档：用户可独立完成配置

**期望满足（Nice-to-Have）**：

- [x] Web UI 配置界面（实现完成；真实浏览器 provider 生命周期已验收）
- [x] 配置 reload 与 snapshot 热更新基线（reload 回滚已验，并发场景待验）
- [ ] 健康检查
- [ ] 批量操作

---

## 时间线与里程碑

### 甘特图概览

```
Week 1: Aug 25 - Aug 31
├─ Day 1-3: 阶段 2 - 移动端验证
│  ├─ E2EE Relay 与配对
│  ├─ 断线重连机制
│  └─ UI/UX 验证
├─ Aug 27: 阶段 3.1 - 共享配置 UI 与热更新实现完成
└─ Day 4-7: 阶段 3 - 真实浏览器生命周期与移动真机验收

Week 2: Sep 1 - Sep 7
├─ Day 1: 阶段 3.2 - 移动端配置真机验收
├─ Day 2-6: 阶段 4 - 高级功能
│  ├─ 并发修改与稳定性验证
│  ├─ Health check
│  ├─ 批量管理
│  └─ 高级审批
└─ Day 7: Buffer day（缓冲时间）

Week 3: Sep 8 - Sep 10
├─ Day 1: 阶段 5.1 - 性能优化
├─ Day 2: 阶段 5.2 - 安全审计
└─ Day 3: 阶段 5.3-5.4 - 文档与发布
```

### 关键里程碑

| 日期 | 里程碑 | 交付物 |
|------|--------|--------|
| ✅ 2026-08-24 | M1: 自定义 API 基础 | 配置支持、文档、验证脚本 |
| 🚧 2026-08-27 | M2: 移动端核心验证 | Web relay terminal 专项与受控 relay deployment 恢复已通过，本地 DaemonClient 契约和 Android 部分 relay 控制/恢复路径已有证据；QR/输入配对、多设备、移动双向对话、网络切换、移动 overflow、terminal UI、Desktop/iOS、hosted TLS 待完成 |
| 🚧 2026-08-30 | M3: 配置 UI 验收 | 三类 provider 生命周期 UI 已实现；真实浏览器 provider 生命周期已验收，移动真机待验 |
| 🚧 2026-09-06 | M4: 高级功能完成 | 配置热更新基线与失败回滚已验证；并发验证、健康检查等待完成 |
| 🚀 2026-09-10 | M5: Alpha 发布 | 完整产物、文档、发布 |

### 每周目标

**Week 1 目标**：移动端验证 + 配置 UI 浏览器验收
- 核心：确保移动端可用性
- 输出：移动端测试报告、配置 UI 完整生命周期 E2E 结果

**Week 2 目标**：完善功能 + 性能优化
- 核心：高级功能实现
- 输出：功能完整的系统

**Week 3 目标**：打磨 + 发布
- 核心：生产就绪
- 输出：Alpha 版本发布

---

## 后续演进

### 短期（v1.1 - v1.3）

**时间**：2026-09 ~ 2026-12

- [ ] **增强监控**（v1.1）
  - Provider 性能仪表板
  - 使用统计和成本分析
  - 异常告警和日志聚合

- [ ] **协作功能**（v1.2）
  - 团队 workspace
  - Provider 配置共享
  - 审批委托

- [ ] **AI 辅助**（v1.3）
  - 智能 provider 推荐
  - 配置错误诊断
  - 最佳实践建议

### 中期（v2.0）

**时间**：2027 Q1

- [ ] **Rust Daemon 完整替换**
  - 彻底移除 TypeScript daemon 依赖
  - 统一 Rust 管理所有 provider
  - 性能提升 50%+

- [ ] **插件系统**
  - 第三方 provider plugin
  - 自定义审批策略 plugin
  - UI 主题 plugin

- [ ] **企业功能**
  - SSO 集成
  - 审计日志导出
  - 合规报告

### 长期（v3.0+）

**时间**：2027 Q2+

- [ ] **多租户支持**
- [ ] **云端同步**
- [ ] **Web 版完整功能**
- [ ] **多语言支持**

---

## 附录

### A. 技术选型

| 组件 | 技术 | 理由 |
|------|------|------|
| Daemon 核心 | Rust | 性能、安全、并发 |
| Provider 管理 | TypeScript | 现有 Paseo 架构 |
| Web UI | React | Paseo 已使用 |
| 移动端 | React Native | 跨平台、代码复用 |
| 配置存储 | Daemon 配置 RPC + JSON 持久化 | UI 为常规入口，JSON 保留为高级入口 |
| 加密 | libsodium | 成熟、审计过 |

### B. Provider 配置通信契约

当前实现复用 daemon 配置 RPC 和 provider snapshot，不维护另一套 Provider CRUD REST
端点。通信流程如下：

```text
Settings > Providers
    │
    ├─ 读取 daemon 配置与当前 provider snapshot
    ├─ 提交 custom provider 新建、编辑、启停或删除
    ├─ 请求 daemon reload 已持久化的配置
    └─ 刷新 provider snapshot 并展示最终状态

Daemon 配置边界
    ├─ 持久化 custom provider 变更
    ├─ reload provider registry
    ├─ 发布新的 provider snapshot
    └─ 强制 Codex 始终为 required provider
```

Provider diagnostic、模型列表和当前 Ready 状态继续复用现有 daemon 能力；阶段 4 规划的
周期 health check、错误率统计与告警仍未实现。后续配置稳定性工作聚焦并发冲突、活跃会话
连续性、重复更新压力和审计，不再规划一组重复的 REST CRUD 端点。

### C. 配置文件 Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "version": {"type": "number", "const": 1},
    "agents": {
      "type": "object",
      "properties": {
        "providers": {
          "type": "object",
          "patternProperties": {
            "^[a-z][a-z0-9-]*$": {
              "type": "object",
              "properties": {
                "extends": {
                  "type": "string",
                  "enum": ["codex", "claude", "acp"]
                },
                "enabled": {"type": "boolean"},
                "label": {"type": "string", "maxLength": 100},
                "description": {"type": "string", "maxLength": 500},
                "env": {
                  "type": "object",
                  "additionalProperties": {"type": "string"}
                },
                "models": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "id": {"type": "string"},
                      "label": {"type": "string"},
                      "isDefault": {"type": "boolean"}
                    },
                    "required": ["id", "label"]
                  }
                }
              },
              "required": ["enabled"]
            }
          }
        }
      }
    }
  },
  "required": ["version"]
}
```

### D. 测试用例清单

详见：[TEST_PLAN.md](TEST_PLAN.md)（待创建）

### E. 参考资料

- [Paseo 官方文档](https://github.com/getpaseo/paseo)
- [Codex CLI 文档](https://github.com/openai/codex)
- [Agent Client Protocol 规范](https://agentclientprotocol.com)
- [E2EE 最佳实践](https://signal.org/docs/)

---

## 变更历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| 1.0 | 2026-08-24 | Claude | 初始版本，完整规划 5 个阶段 |

---

**文档状态**：✅ 已审阅  
**批准人**：待定  
**下次审阅日期**：2026-08-27（阶段 2 完成后）

---

**联系方式**：
- 项目仓库：`/home/e/workspace/codex-remote-workbench`
- 文档目录：`docs/`
- Issue 追踪：待建立
