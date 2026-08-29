# Codex Harness Workbench - 项目状态总览

**最后更新**：2026-08-28  
**当前阶段**：阶段 1 完成 ✅；阶段 2 的 Web relay terminal 路径已验收，移动设备验收继续进行 🚧；阶段 3 配置 UI 与热更新实现完成，真实浏览器 provider 生命周期已验收，移动真机生命周期待验 🚧

---

## 🎯 项目目标

构建一个以 Codex 官方 harness 为核心、支持自定义 API、可从多端完整操作的本地优先 AI 工作台。

---

## 📊 整体进度

```
阶段 1 已完成；阶段 2 已验收真实 Web relay terminal 路径，并验证本地 relay 基线、一台实体 Android 的部分 relay 控制/恢复路径；移动端仍未形成完成度百分比。阶段 3 功能实现已完成，验收进度单独记录。

阶段 1: 自定义 API 基础      ████████████  100% ✅
阶段 2: 移动端核心验证        ██░░░░░░░░░░   Web relay terminal ✅ / Android 部分恢复路径 ✅ / 其余验收待办
阶段 3: 配置管理 UI          ████████████  实现完成、浏览器 provider 生命周期已验收 ✅ / 移动真机验收待办
阶段 4: 高级功能增强          ███░░░░░░░░░  热更新基线 ✅ / reload 失败原子回滚 ✅ / 并发、健康检查待办
阶段 5: 生产就绪              ░░░░░░░░░░░░    0% 🚀
```

---

## ✅ 已完成功能

### 核心基础设施（M1）

- ✅ Rust app-server bridge（并发、乱序响应、审批）
- ✅ 线程生命周期（create/resume/fork/archive/delete）
- ✅ Turn 控制（start/steer/interrupt）
- ✅ 对话 rewind（thread/revert）
- ✅ 真实命令审批验证
- ✅ 桌面功能 discovery

### Paseo 集成（M2 部分）

- ✅ Codex required + 可选 custom provider 策略
- ✅ Settings > Providers 配置生命周期
- ✅ 真实模型 turn 验证
- ✅ **自定义 API provider 支持**（新）
- ✅ 本地 E2EE relay crypto、pairing offer、daemon 注册与 relay CLI 基线
- ✅ 实体 Android 16 通过本地 E2EE relay offer 注册；控制 RPC 与短暂会话恢复已观察到
- ✅ 隔离 relay worker 重启后，Android 自动重连并恢复已存在的 agent/timeline 投影
- ✅ timeline provisional live event 重连契约：携带 epoch、保持无 seq
- ✅ 本地 Wrangler relay 的真实 E2EE `DaemonClient` 断线重连、canonical timeline cursor catch-up 与 live 去重契约
- ✅ 本地 Wrangler relay 的真实 E2EE `DaemonClient` 终端创建、订阅、二进制输入/输出、resize 与终止契约
- ✅ 真实 Paseo Web + packaged daemon + 本地 Wrangler E2EE relay terminal 浏览器验收：创建与订阅、浏览器输入、PTY 输出、resize 均通过；浏览器未直连 daemon WebSocket，relay wire 中三个被检查的终端明文均未出现
- ✅ 真实 Paseo Web 的 relay deployment 流式恢复：`reconnectToastDelayMs=1331`、`reconnectToastVisibleMs=5112`、`totalReconnectMs=6443`、`relayStartupMs=533`；`streamPausedWhileDisconnected=true`、`runningStatePreserved=true`、`streamResumedWithoutUserAction=true`
- ✅ 正式 `test:e2e:relay-deployment` 结果为 `2 passed (40.4s)`；Codex CLI 默认新页面另由独立 `1/1 browser E2E` 验证
- ✅ 独立 Linux `relay-browser-e2e` CI job 已固定 relay commit、OTP/Elixir 版本，并门禁上述两个真实浏览器规格
- ✅ Rust bridge 默认 2048 条 replay 窗口的 2049 事件溢出与 `reset_required` 边界回归
- ✅ 新建工作区默认选择 Codex CLI inline terminal；桌面端复用现有平铺 pane/split
- ✅ Paseo Web 新建工作区首次渲染默认选中 Codex CLI terminal，并显示 terminal composer 与 `--no-alt-screen` launcher 预设（独立 `1/1 browser E2E`）
- ✅ Settings > Providers 支持 OpenAI-compatible、Anthropic-compatible、ACP custom provider 的新建和编辑
- ✅ Custom provider 支持启用、停用和删除
- ✅ 保存后触发 daemon 配置 reload 与 provider snapshot 刷新，daemon 进程保持运行
- ✅ Codex 在 UI 和 daemon 配置边界均不可停用或删除

### 自定义 API（阶段 1 - 新完成）

- ✅ Provider 管理逻辑修改
- ✅ 支持 3 种协议（OpenAI/Anthropic/ACP）
- ✅ Settings > Providers 可视化配置生命周期
- ✅ 配置 reload 与 provider snapshot 热更新基线
- ✅ JSON 保留为高级入口，不再是唯一管理路径
- ✅ 配置示例与完整文档
- ✅ 自动化验证脚本
- ✅ 所有测试通过（76 tests）

### 文档体系

- ✅ 完整实施计划（3 周路线图）
- ✅ 配置指南（150+ 行）
- ✅ 快速开始指南（300+ 行）
- ✅ 架构说明
- ✅ 功能矩阵

---

## 🚧 进行中

### 阶段 2：移动端核心验证（2026-08-25 ~ 08-27）

**目标**：确保移动端基础可用性

#### 任务列表

- [ ] **E2EE Relay 与配对**（Day 1）
  - [x] 准备并构建实体 Android Debug 测试设备
  - [x] 配置并验证隔离的本地 relay
  - [x] Android relay offer 注册、控制 RPC 与短暂会话恢复验证
  - [ ] iOS 设备准备与 relay 验证
  - [ ] QR 相机/输入配对、多设备和失败路径验证

- [ ] **断线重连机制**（Day 2）
  - [x] 本地 E2EE relay 客户端断线后自动重连并通过 timeline cursor 追赶已提交记录
  - [x] Android 在隔离 relay worker 重启后重新握手，并恢复缓存工作区中的已有 agent/timeline
  - [x] Rust bridge 2049 事件触发有界 replay `reset_required`（底层契约）
  - [ ] 网络切换测试（WiFi ↔ 4G）
  - [ ] 移动端 replay overflow 后完整 transcript 刷新
  - [ ] 长时离线重连
  - [ ] 边界情况测试

- [ ] **移动端 UI/UX**（Day 3）
  - [ ] Provider 管理（共享 UI 已实现，Android/iOS 真机待验）
  - [ ] 审批交互测试
  - [ ] 后台终端查看（Web relay terminal 已验收；移动端 terminal UI 仍待验）
  - [ ] 响应式布局验证

**预计完成**：2026-08-27

---

## 🔜 后续验收与增强

### 阶段 3：配置管理 UI（实现完成，验收进行中）

- [x] Web/Desktop 与共享 Settings > Providers 配置界面
- [x] OpenAI-compatible、Anthropic-compatible、ACP 的新建和编辑
- [x] Custom provider 启用、停用和删除
- [x] 已配置 custom provider 列表（含停用项）；启用项具备状态、诊断和附加模型入口
- [x] 保存后请求 daemon 配置 reload 并刷新 provider snapshot
- [x] Codex required provider 在 UI 和 daemon 边界均不可停用或删除
- [x] 真实浏览器完成 provider 生命周期 E2E（OpenAI 完整 CRUD；Anthropic key/token 与 ACP 参数路径）
- [ ] Android/iOS 真机完成共享 Provider UI 验收
- [ ] 浏览器错误反馈、保存成功率和操作时间验收

### 阶段 4：高级功能（2026-09-02 ~ 09-06）

- [x] 配置 reload 与 provider snapshot 热更新基线
- [x] reload 失败时回滚 live owner、内存配置和持久化文件
- [x] 热更新失败原子回滚验证
- [x] 同步嵌套配置更新基线保持一致
- [ ] 并发修改和活跃会话稳定性验证
- [ ] Provider 健康检查
- [ ] 批量配置管理
- [ ] 高级审批策略

### 阶段 5：生产就绪（2026-09-09 ~ 09-10）

- [ ] 性能优化
- [ ] 安全审计
- [ ] 文档完善
- [ ] Alpha 发布

---

## 📈 关键指标

| 指标 | 当前 | 目标 | 状态 |
|------|------|------|------|
| 代码测试覆盖率 | ~70% | >80% | 🔄 进行中 |
| 支持的 API 类型 | 3 | 3+ | ✅ 达标 |
| 移动端配对成功率 | 未测试 | >95% | ⏸️ 待测试 |
| 配置操作时间 | Settings UI 已实现，浏览器计时待验 | <2min | ⏸️ 待验收 |
| 文档完整度 | 80% | 100% | 🔄 完善中 |

---

## 🎯 里程碑

| 里程碑 | 日期 | 状态 | 交付物 |
|--------|------|------|--------|
| M1: 自定义 API 基础 | 2026-08-24 | ✅ 完成 | 配置支持、文档、脚本 |
| M2: 移动端核心验证 | 2026-08-27 | 🚧 Web relay terminal 已验收；Android 部分 relay 路径已验证 | QR/输入配对、多设备、双向对话、移动网络重连、移动 overflow、terminal UI、Desktop/iOS、hosted TLS |
| M3: 配置 UI 验收 | 2026-08-30 | 🚧 实现完成，验收中 | 三类 provider 生命周期 UI；真实浏览器生命周期已验收，移动真机待验 |
| M4: 高级功能完成 | 2026-09-06 | 🚧 部分完成 | 热更新基线与失败回滚已验证；并发、健康检查待完成 |
| M5: Alpha 发布 | 2026-09-10 | 🚀 未开始 | 完整产物、发布 |

---

## 📚 文档导航

### 新用户

1. 🚀 [快速开始指南](docs/QUICKSTART.md) - 5 分钟上手
2. 📖 [配置指南](docs/CUSTOM_PROVIDERS.md) - 添加自定义 API
3. 🔖 [版本快速参考](docs/VERSION_QUICK_REF.md) - 版本信息速查
4. ❓ [FAQ](docs/QUICKSTART.md#常见问题) - 常见问题

### 开发者

1. 🏗️ [架构说明](docs/ARCHITECTURE.md) - 系统架构
2. 📋 [完整实施计划](docs/MASTER_PLAN.md) - 3 周路线图
3. 🔖 [版本控制文档](docs/VERSION_CONTROL.md) - 版本管理规范
4. 🔨 [开发进度](docs/PROGRESS.md) - 历史记录
5. 📊 [功能矩阵](docs/FEATURE_MATRIX.md) - 完成度追踪

### 项目管理

1. ⭐ [完整实施计划](docs/MASTER_PLAN.md) - **主计划文档**
2. 🔖 [版本控制](docs/VERSION_CONTROL.md) - **版本管理**
3. 📝 [重建计划](PLAN.md) - 原始规划
4. 📈 [实施总结](docs/IMPLEMENTATION_SUMMARY.md) - 阶段 1 总结
5. 📄 [版本总览](docs/VERSION_SUMMARY.md) - 版本发布总览

---

## 🔥 快速操作

### 验证安装

```bash
# 运行完整验证
./scripts/verify-custom-providers.sh
```

### 启动 Daemon

```bash
# 启动开发环境
./scripts/start-harness-workbench.sh
```

### 添加自定义 API

1. 打开客户端的 Settings > Providers。
2. 选择新增，并选择 OpenAI-compatible、Anthropic-compatible 或 ACP。
3. 填写配置后保存；客户端会请求 daemon 配置 reload 并刷新 provider snapshot。
4. 在列表中确认最终启用状态；也可用以下命令交叉检查：

```bash
cd upstream/paseo
node packages/cli/bin/paseo provider ls --host 127.0.0.1:6877 --json
```

直接编辑 `.paseo-dev/config.json` 仅作为高级配置或故障排查入口。

---

## 🐛 已知问题

| 问题 | 影响 | 优先级 | 状态 |
|------|------|--------|------|
| 浏览器配置专项指标（错误反馈、操作时间、保存成功率）尚未验收 | 中 | P1 | 🚧 阶段 3 收尾 |
| 移动端完整验收未完成 | 高 | P0 | 🚧 Android 仅有部分 relay 控制与恢复证据；阶段 2 进行中 |
| 多客户端并发修改与活跃会话连续性尚未验证 | 中 | P1 | 🚧 阶段 4 待完成 |
| 部分文档缺失 | 低 | P2 | 🔄 持续完善 |

---

## 🤝 如何贡献

当前处于快速开发阶段，暂不接受外部贡献。

预计在 v1.0.0-alpha 发布后开放贡献通道。

---

## 📞 支持

- 📖 查看文档：`docs/`
- 🐛 报告问题：（待建立）
- 💬 讨论：（待建立）

---

## 📄 许可证

- Codex：Apache-2.0
- OMP：MIT（含第三方 notices）
- Paseo：AGPL-3.0
- 本项目：遵循上游许可证

---

## 🎖️ 致谢

- [Codex](https://github.com/openai/codex) - 核心 agent runtime
- [Paseo](https://github.com/getpaseo/paseo) - 多端客户端
- [Oh My Pi](https://github.com/can1357/oh-my-pi) - Rust primitives

---

**项目状态**：🚧 活跃开发中  
**当前版本**：无发布 tag（pre-tag）  
**预计 Alpha 发布**：2026-09-10
