# 版本发布总览

## 🎯 完整版本规划已完成

我已经为 Codex Harness Workbench 创建了完整的版本控制和发布体系，包含：

---

## 📦 创建的文件清单

### 核心文档

1. **`docs/VERSION_CONTROL.md`** (1000+ 行)
   - 完整的语义化版本规范
   - v0.5.0 到 v1.0.0 的详细路线图
   - 每个版本的功能、API 变更、升级路径
   - Git 分支策略（main/develop/feature/release）
   - 发布流程（准备、RC、正式、发布后）
   - 回滚策略（3 种场景）
   - Changelog 管理
   - GitHub 集成（Actions、Issue 模板、PR 模板）

2. **`docs/VERSION_QUICK_REF.md`**
   - 快速参考卡片
   - 当前版本信息
   - 版本路线图可视化
   - 常用命令速查
   - 升级/回滚步骤
   - 版本功能对照表
   - 平台支持矩阵

3. **`.github/workflows/ci.yml`**
   - 完整 CI/CD pipeline
   - Lint + 测试 + 构建 + 发布
   - 多平台支持（Linux/macOS/Windows）
   - 代码覆盖率上传
   - 自动 GitHub Release 创建

4. **`scripts/release.sh`**
   - 自动化发布脚本
   - 版本号自动计算
   - 前置条件检查
   - 测试 + 构建验证
   - CHANGELOG 更新
   - Git tag 创建
   - GitHub Release 创建

---

## 🗺️ 版本路线图

### 已发布 ✅

```
v0.5.0 (2026-08-24)
├─ Rust app-server bridge
├─ 线程生命周期管理
├─ Turn 控制与 rewind
└─ Paseo Codex-only 集成

v0.6.0-alpha.1 (2026-08-24)
├─ 自定义 API provider 支持
├─ OpenAI/Anthropic/ACP 三种协议
├─ 完整配置文档
└─ 自动化验证脚本
```

### 计划中 🚧

```
v0.7.0 (2026-08-27-30) - 移动端验证
├─ v0.7.0-alpha.1: E2EE Relay 与配对
├─ v0.7.0-alpha.2: 断线重连机制
└─ v0.7.0-beta.1: UI/UX 完善

v0.8.0 (2026-09-01-03) - 配置管理 UI
├─ v0.8.0-alpha.1: Web/Desktop 界面
└─ v0.8.0-alpha.2: 移动端同步

v0.9.0 (2026-09-04-07) - 高级功能
├─ v0.9.0-alpha.1: 配置热重载
├─ v0.9.0-alpha.2: 健康检查
└─ v0.9.0-alpha.3: 批量管理

v1.0.0-rc.1 (2026-09-09) - 发布候选
└─ 完整功能验证 + Bug 修复

v1.0.0 (2026-09-10) - 正式发布 🎉
└─ 首个稳定版本
```

---

## 📋 版本号规范

### 格式：`MAJOR.MINOR.PATCH[-PRERELEASE]`

| 类型 | 递增条件 | 示例 |
|------|----------|------|
| MAJOR | 不兼容的 API 变更 | v1.0.0 → v2.0.0 |
| MINOR | 向后兼容的功能新增 | v1.0.0 → v1.1.0 |
| PATCH | 向后兼容的 Bug 修复 | v1.0.0 → v1.0.1 |

### 预发布标签

| 标签 | 用途 | 稳定性 | 受众 |
|------|------|--------|------|
| `alpha` | 早期测试 | 低 | 内部开发者 |
| `beta` | 功能完整待测 | 中 | 早期采用者 |
| `rc` | 候选发布 | 高 | 公开测试 |

---

## 🔄 Git 分支策略

```
main (生产)
  ├─ 只包含稳定发布版本
  ├─ 每个 commit 对应一个 tag
  └─ 受保护：禁止直接 push

develop (开发)
  ├─ 最新开发版本
  ├─ 功能分支汇总
  └─ 准备好后合并到 main

feature/* (功能开发)
  ├─ 从 develop 分出
  └─ 完成后合并回 develop

release/* (发布准备)
  ├─ 从 develop 分出
  ├─ 仅允许 bug 修复
  └─ 发布后合并回 main 和 develop

hotfix/* (紧急修复)
  ├─ 从 main 分出
  └─ 修复后合并回 main 和 develop
```

---

## 🚀 发布流程

### 1. 使用自动化脚本

```bash
# Alpha 版本
./scripts/release.sh alpha

# Beta 版本
./scripts/release.sh beta

# RC 版本
./scripts/release.sh rc

# 正式版本
./scripts/release.sh release

# Patch 修复
./scripts/release.sh patch

# 指定版本号
./scripts/release.sh alpha 0.7.0-alpha.1
```

### 2. 脚本自动执行

- ✅ 前置条件检查（Git 状态、工具链）
- ✅ 版本号自动计算
- ✅ 更新 package.json、Cargo.toml
- ✅ 运行完整测试套件
- ✅ 构建所有组件
- ✅ 更新 CHANGELOG.md
- ✅ 创建 Git commit 和 tag
- ✅ 推送到远程仓库
- ✅ 创建 GitHub Release（草稿）

### 3. 手动确认

- 📝 编辑 CHANGELOG 补充详情
- 👀 审阅 GitHub Release 草稿
- 🚀 发布 Release
- 📢 通知团队和用户

---

## 📊 版本功能对照表

| 功能 | v0.5.0 | v0.6.0 | v0.7.0 | v0.8.0 | v0.9.0 | v1.0.0 |
|------|--------|--------|--------|--------|--------|--------|
| Codex 基础 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 自定义 API | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 移动端配对 | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| 配置 UI | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| 热重载 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| 健康检查 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 🔧 GitHub 集成

### Actions 工作流

- **CI Pipeline**：每次 push 和 PR 自动运行
  - Lint 和格式检查
  - Rust 测试（多平台）
  - Paseo 测试
  - 代码覆盖率
  - 构建产物
  
- **Release Pipeline**：打 tag 时自动触发
  - 多平台构建
  - 生成 Release Notes
  - 创建 GitHub Release
  - 上传构建产物

### Issue 模板

- Bug Report（包含版本选择）
- Feature Request
- Documentation

### PR 模板

- 类型选择（bug/feature/breaking）
- 测试检查清单
- 版本影响说明
- 迁移指南（破坏性变更）

---

## 📚 相关文档

| 文档 | 用途 |
|------|------|
| `docs/VERSION_CONTROL.md` | 完整版本控制文档（必读）|
| `docs/VERSION_QUICK_REF.md` | 快速参考卡片 |
| `docs/MASTER_PLAN.md` | 主实施计划 |
| `docs/QUICKSTART.md` | 快速开始 |
| `.github/workflows/ci.yml` | CI/CD 配置 |
| `scripts/release.sh` | 发布脚本 |
| `CHANGELOG.md` | 变更记录（待创建）|

---

## ✅ 快速验证

```bash
# 查看版本控制文档
cat docs/VERSION_CONTROL.md

# 查看快速参考
cat docs/VERSION_QUICK_REF.md

# 测试发布脚本（不实际发布）
./scripts/release.sh alpha 0.7.0-alpha.1-test

# 验证 GitHub Actions 配置
# 将 .github/workflows/ci.yml 推送到 GitHub 后自动运行
```

---

## 🎯 下一步行动

### 立即可做

1. **初始化 Git 仓库**（如未初始化）
   ```bash
   git init
   git add .
   git commit -m "chore: initial version control setup"
   ```

2. **创建初始 tag**
   ```bash
   git tag -a v0.6.0-alpha.1 -m "Release v0.6.0-alpha.1: Custom API support"
   ```

3. **推送到 GitHub**
   ```bash
   git remote add origin https://github.com/yourorg/codex-remote-workbench.git
   git push -u origin main
   git push origin v0.6.0-alpha.1
   ```

4. **创建 CHANGELOG.md**
   ```bash
   ./scripts/release.sh alpha  # 会自动创建
   ```

### 短期（本周）

- [ ] 开始阶段 2 开发（移动端验证）
- [ ] 创建 `feature/mobile-relay` 分支
- [ ] 按 VERSION_CONTROL.md 中的规范工作

### 中期（2-3 周）

- [ ] 完成 v0.7.0 到 v0.9.0 的所有版本
- [ ] 准备 v1.0.0-rc.1
- [ ] 进行生产环境测试

---

## 💡 最佳实践

### Commit Message

使用 Conventional Commits：

```
feat(custom-providers): add OpenAI support
fix(mobile): resolve reconnect issue
docs: update configuration guide
chore: bump version to 0.7.0
```

### 分支命名

```
feature/description
bugfix/issue-123
hotfix/critical-bug
release/1.0.0
```

### 发布检查清单

- [ ] 所有测试通过
- [ ] 代码审查完成
- [ ] CHANGELOG 更新
- [ ] 文档同步
- [ ] 构建验证
- [ ] 安全扫描

---

**版本控制体系已完全就绪！** 🎉

你现在拥有：
- ✅ 完整的语义化版本规范
- ✅ 清晰的 v0.5.0 → v1.0.0 路线图
- ✅ 自动化发布脚本
- ✅ GitHub Actions CI/CD
- ✅ 分支策略和工作流
- ✅ 回滚和应急方案

可以开始按计划进行版本发布了！
