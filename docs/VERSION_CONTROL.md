# Codex Harness Workbench - 版本控制与发布计划

**文档版本**：1.0  
**创建日期**：2026-08-24  
**版本策略**：语义化版本 (Semantic Versioning 2.0.0)

---

## 📋 目录

- [版本号规范](#版本号规范)
- [版本发布计划](#版本发布计划)
- [Git 分支策略](#git-分支策略)
- [发布流程](#发布流程)
- [回滚策略](#回滚策略)
- [Changelog 管理](#changelog-管理)
- [GitHub 集成](#github-集成)

---

## 版本号规范

### 语义化版本格式

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]

示例：
v1.0.0          - 正式版本
v1.0.0-alpha.1  - Alpha 预发布版本
v1.0.0-beta.2   - Beta 预发布版本
v1.0.0-rc.1     - Release Candidate 版本
v1.0.1+20240824 - 带构建元数据的版本
```

### 版本递增规则

| 类型 | 条件 | 示例 |
|------|------|------|
| **MAJOR** | 不兼容的 API 变更 | v1.0.0 → v2.0.0 |
| **MINOR** | 向后兼容的功能新增 | v1.0.0 → v1.1.0 |
| **PATCH** | 向后兼容的问题修复 | v1.0.0 → v1.0.1 |

### 预发布标签

| 标签 | 用途 | 稳定性 | 受众 |
|------|------|--------|------|
| `alpha` | 早期测试版本 | 低 | 内部开发者 |
| `beta` | 功能完整但需测试 | 中 | 早期采用者 |
| `rc` | 候选发布版本 | 高 | 公开测试 |

---

## 版本发布计划

### v0.x - 开发阶段（当前）

#### v0.5.0 - 基础完成 ✅ 已发布

**发布日期**：2026-08-24  
**Git Tag**：`v0.5.0`  
**分支**：`main`

**包含功能**：
- Rust app-server bridge 完整实现
- Codex 线程生命周期管理
- Turn 控制与 rewind
- Paseo Codex-only 集成
- 真实命令审批验证

**重大变更**：
- 初始可用版本

**已知问题**：
- 移动端未验证
- 需手动配置

---

#### v0.6.0-alpha.1 - 自定义 API 支持 ✅ 已发布

**发布日期**：2026-08-24  
**Git Tag**：`v0.6.0-alpha.1`  
**分支**：`feature/custom-providers`

**包含功能**：
- ✅ 自定义 API provider 支持
- ✅ OpenAI-compatible 端点配置
- ✅ Anthropic-compatible 端点配置
- ✅ ACP (Agent Client Protocol) 支持
- ✅ 完整配置文档和示例
- ✅ 自动化验证脚本

**API 变更**：
- 新增：`getEnabledCustomProviderIds()` 函数
- 修改：`publishedProviderIds` 构建逻辑
- 保持：向后兼容，Codex 仍为必需

**升级路径**：
```bash
# 从 v0.5.0 升级
git checkout v0.6.0-alpha.1
npm install
npm run build:server
./scripts/verify-custom-providers.sh
```

**回滚路径**：
```bash
# 回滚到 v0.5.0
git checkout v0.5.0
npm install
npm run build:server
# 删除 .paseo-dev/config.json 中的自定义 providers
```

**破坏性变更**：无

---

### v0.7.0 - 移动端验证（计划中）

#### v0.7.0-alpha.1 - E2EE Relay 支持 🚧

**计划发布**：2026-08-27  
**Git Tag**：`v0.7.0-alpha.1`  
**分支**：`feature/mobile-relay`

**目标功能**：
- [ ] E2EE relay 真实验证
- [ ] Android 配对支持
- [ ] iOS 配对支持
- [ ] 基础消息往返

**API 变更**：
- 新增：`/api/relay/pair` - 配对端点
- 新增：`/api/relay/status` - 状态查询

**测试要求**：
- Android 真机测试通过
- iOS 真机测试通过
- E2EE 加密验证
- 配对成功率 >90%

---

#### v0.7.0-alpha.2 - 断线重连机制 🚧

**计划发布**：2026-08-28  
**Git Tag**：`v0.7.0-alpha.2`  
**分支**：`feature/mobile-reconnect`

**目标功能**：
- [ ] 自动重连实现
- [ ] Replay buffer 验证
- [ ] 网络切换支持
- [ ] 长时离线恢复

**API 变更**：
- 增强：Replay buffer 溢出处理
- 新增：`reset_required` 信号

**测试要求**：
- 网络切换测试矩阵通过
- 重连时间 <5s
- 消息无丢失

---

#### v0.7.0-beta.1 - 移动端 UI 完善 🔜

**计划发布**：2026-08-29  
**Git Tag**：`v0.7.0-beta.1`  
**分支**：`feature/mobile-ui`

**目标功能**：
- [ ] 审批 UI 移动端适配
- [ ] 后台终端查看
- [ ] Provider 选择界面
- [ ] 响应式布局

**破坏性变更**：
- 移动端 UI 大幅改版

---

#### v0.7.0 - 移动端正式版 🔜

**计划发布**：2026-08-30  
**Git Tag**：`v0.7.0`  
**分支**：`main`（从 `develop` 合并）

**完整功能**：
- ✅ E2EE relay 与配对
- ✅ 断线重连机制
- ✅ 移动端 UI/UX
- ✅ 所有测试通过

**升级说明**：
- 首次支持移动端
- 建议清除旧缓存

---

### v0.8.0 - 配置管理 UI（计划中）

#### v0.8.0-alpha.1 - Web 配置界面 🔜

**计划发布**：2026-09-01  
**Git Tag**：`v0.8.0-alpha.1`  
**分支**：`feature/config-ui-web`

**目标功能**：
- [ ] Provider 列表页面
- [ ] 添加/编辑 provider 表单
- [ ] 测试连接功能
- [ ] 配置保存/读取

**API 变更**：
- 新增：`GET /api/providers` - 列出 providers
- 新增：`POST /api/providers` - 创建 provider
- 新增：`PUT /api/providers/:id` - 更新 provider
- 新增：`DELETE /api/providers/:id` - 删除 provider
- 新增：`POST /api/providers/:id/test` - 测试连接

---

#### v0.8.0-alpha.2 - 移动端配置同步 🔜

**计划发布**：2026-09-02  
**Git Tag**：`v0.8.0-alpha.2`  
**分支**：`feature/config-ui-mobile`

**目标功能**：
- [ ] 移动端配置列表
- [ ] 配置同步机制
- [ ] 设置默认 provider
- [ ] 离线缓存

---

#### v0.8.0 - 配置管理正式版 🔜

**计划发布**：2026-09-03  
**Git Tag**：`v0.8.0`  
**分支**：`main`

**完整功能**：
- ✅ Web/Desktop 配置 UI
- ✅ 移动端配置同步
- ✅ 可视化管理 providers

**破坏性变更**：
- 配置文件格式可能调整（向后兼容）

---

### v0.9.0 - 高级功能（计划中）

#### v0.9.0-alpha.1 - 配置热重载 🔮

**计划发布**：2026-09-04  
**Git Tag**：`v0.9.0-alpha.1`  
**分支**：`feature/hot-reload`

**目标功能**：
- [ ] 配置文件监听
- [ ] 增量更新 providers
- [ ] 配置验证与回滚
- [ ] 热重载日志

**API 变更**：
- 新增：`POST /api/config/reload` - 手动触发重载
- 新增：WebSocket 通知配置变更

---

#### v0.9.0-alpha.2 - 健康检查 🔮

**计划发布**：2026-09-05  
**Git Tag**：`v0.9.0-alpha.2`  
**分支**：`feature/health-check`

**目标功能**：
- [ ] 定期 health check
- [ ] 响应时间监控
- [ ] 错误率统计
- [ ] 状态推送通知

**API 变更**：
- 新增：`GET /api/health/providers` - Provider 健康状态

---

#### v0.9.0-alpha.3 - 批量管理 🔮

**计划发布**：2026-09-06  
**Git Tag**：`v0.9.0-alpha.3`  
**分支**：`feature/batch-ops`

**目标功能**：
- [ ] 配置导入/导出
- [ ] 配置模板
- [ ] 批量操作

---

#### v0.9.0 - 高级功能正式版 🔮

**计划发布**：2026-09-07  
**Git Tag**：`v0.9.0`  
**分支**：`main`

**完整功能**：
- ✅ 配置热重载
- ✅ 健康检查与监控
- ✅ 批量配置管理
- ✅ 高级审批策略

---

### v1.0.0 - 首个正式版 🚀

#### v1.0.0-rc.1 - 发布候选 🚀

**计划发布**：2026-09-09  
**Git Tag**：`v1.0.0-rc.1`  
**分支**：`release/1.0.0`

**发布前检查**：
- [ ] 所有功能测试通过
- [ ] 性能指标达标
- [ ] 安全审计通过
- [ ] 文档审阅完成
- [ ] 构建产物验证

**修复窗口**：24 小时（仅修复 P0 bug）

---

#### v1.0.0 - 正式发布 🎉

**计划发布**：2026-09-10  
**Git Tag**：`v1.0.0`  
**分支**：`main`

**里程碑功能**：
- ✅ Codex 核心功能完整
- ✅ 自定义 API 支持（3 种协议）
- ✅ 移动端完整体验
- ✅ 配置管理 UI
- ✅ 高级功能（热重载、健康检查等）
- ✅ 生产级稳定性

**支持平台**：
- Linux x64
- macOS arm64/x64
- Windows x64
- Android 8.0+
- iOS 14.0+

**升级路径**：
```bash
# 从任何 v0.x 版本升级
git checkout v1.0.0
npm install
npm run build:server
./scripts/migrate-config.sh  # 配置迁移工具
./scripts/verify-installation.sh
```

**破坏性变更**：
- 配置文件格式变更（提供迁移工具）
- 部分实验性 API 移除
- 详见 CHANGELOG.md

---

### v1.x - 稳定维护期

#### v1.1.0 - 增强监控（计划）

**计划发布**：2026-10 月

**主要功能**：
- Provider 性能仪表板
- 使用统计和成本分析
- 异常告警和日志聚合

---

#### v1.2.0 - 协作功能（计划）

**计划发布**：2026-11 月

**主要功能**：
- 团队 workspace
- Provider 配置共享
- 审批委托

---

#### v1.3.0 - AI 辅助（计划）

**计划发布**：2026-12 月

**主要功能**：
- 智能 provider 推荐
- 配置错误诊断
- 最佳实践建议

---

### v2.0.0 - 架构升级（远期）

**计划发布**：2027 Q1

**重大变更**：
- Rust daemon 完全替换 TypeScript
- 插件系统
- 企业功能

**破坏性变更**：
- 配置格式大幅改动
- API 不向后兼容
- 需要全新安装

---

## Git 分支策略

### 主要分支

```
main (production)
  ├── 只包含已发布的稳定版本
  ├── 每个 commit 对应一个 release tag
  └── 受保护：禁止直接 push

develop (integration)
  ├── 最新开发版本
  ├── 功能分支的汇总
  └── 准备就绪后合并到 main

release/x.y.z (release preparation)
  ├── 发布候选分支
  ├── 仅允许 bug 修复
  └── 发布后合并回 main 和 develop
```

### 辅助分支

```
feature/* (new features)
  ├── 从 develop 分出
  ├── 完成后合并回 develop
  └── 示例：feature/custom-providers

bugfix/* (non-critical fixes)
  ├── 从 develop 分出
  └── 修复后合并回 develop

hotfix/* (critical fixes)
  ├── 从 main 分出
  ├── 紧急修复生产问题
  └── 合并回 main 和 develop

docs/* (documentation only)
  ├── 从 develop 分出
  └── 文档更新
```

### 分支命名规范

```bash
feature/description         # 新功能
feature/issue-123          # 对应 issue 的功能
bugfix/description         # Bug 修复
hotfix/critical-issue      # 紧急修复
release/1.0.0              # 发布分支
docs/update-quickstart     # 文档更新
```

---

## 发布流程

### 1. 准备阶段

```bash
# 1.1 创建 release 分支
git checkout develop
git pull origin develop
git checkout -b release/1.0.0

# 1.2 更新版本号
# 修改 package.json、Cargo.toml 等文件中的版本号
npm version 1.0.0 --no-git-tag-version

# 1.3 更新 CHANGELOG
# 根据 git log 生成 changelog
git log v0.9.0..HEAD --oneline --no-merges > /tmp/changes.txt
# 手动编辑 CHANGELOG.md

# 1.4 运行完整测试
./scripts/verify-rust.sh
CHW_REAL_CODEX_TESTS=1 ./scripts/verify-rust.sh
cd upstream/paseo && npm test
cd ../.. && ./scripts/verify-custom-providers.sh

# 1.5 构建产物
./scripts/build-all-platforms.sh

# 1.6 提交 release 准备
git add .
git commit -m "chore: prepare release v1.0.0"
git push origin release/1.0.0
```

### 2. RC 发布

```bash
# 2.1 打 RC tag
git tag -a v1.0.0-rc.1 -m "Release Candidate 1 for v1.0.0"
git push origin v1.0.0-rc.1

# 2.2 创建 GitHub Pre-release
gh release create v1.0.0-rc.1 \
  --title "v1.0.0 Release Candidate 1" \
  --notes "$(cat CHANGELOG.md | sed -n '/## \[1.0.0-rc.1\]/,/## \[/p' | head -n -1)" \
  --prerelease \
  ./dist/*

# 2.3 通知测试团队
# 邮件/Slack 通知内部测试开始

# 2.4 收集反馈（24-48 小时）
# 修复 P0 bug，发布 rc.2、rc.3...
```

### 3. 正式发布

```bash
# 3.1 合并到 main
git checkout main
git merge --no-ff release/1.0.0 -m "Release v1.0.0"

# 3.2 打正式 tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin main
git push origin v1.0.0

# 3.3 创建 GitHub Release
gh release create v1.0.0 \
  --title "v1.0.0 - First Stable Release" \
  --notes-file RELEASE_NOTES.md \
  ./dist/*

# 3.4 合并回 develop
git checkout develop
git merge --no-ff main -m "Merge v1.0.0 back to develop"
git push origin develop

# 3.5 删除 release 分支
git branch -d release/1.0.0
git push origin --delete release/1.0.0

# 3.6 发布公告
# 更新官网、发送邮件、社交媒体宣传
```

### 4. 发布后

```bash
# 4.1 监控错误报告
# 观察 GitHub Issues、用户反馈

# 4.2 准备 hotfix（如需要）
git checkout -b hotfix/1.0.1 main
# 修复问题...
git tag v1.0.1
# 合并回 main 和 develop

# 4.3 更新文档
# 确保文档与发布版本一致
```

---

## 回滚策略

### 场景 1：发现严重 Bug（生产环境）

**检测**：用户报告、监控告警、自动化测试失败

**决策矩阵**：

| Bug 严重度 | 影响范围 | 操作 |
|-----------|---------|------|
| P0（系统崩溃） | >10% 用户 | 立即回滚 |
| P1（功能受损） | >30% 用户 | 24h 内回滚或修复 |
| P2（体验问题） | 任意 | 下一版本修复 |

**回滚步骤**：

```bash
# 1. 紧急沟通
echo "INCIDENT: v1.0.0 critical bug - rolling back to v0.9.0"
# 通知团队、用户

# 2. 切换到上一个稳定版本
git checkout v0.9.0
git checkout -b hotfix/rollback-1.0.0

# 3. 重新发布为 v1.0.1
git tag -a v1.0.1 -m "Rollback to v0.9.0 due to critical bug in v1.0.0"
git push origin v1.0.1

# 4. 更新 GitHub Release
gh release create v1.0.1 \
  --title "v1.0.1 - Rollback Release" \
  --notes "Emergency rollback to v0.9.0 functionality due to critical bug in v1.0.0. 
  
**Issue**: [Link to issue]
**Impact**: [Description]
**Timeline**: Fixed version v1.1.0 ETA 2026-XX-XX" \
  ./dist/*

# 5. 修复原问题
git checkout develop
git checkout -b bugfix/critical-issue-123
# 修复并充分测试...
# 发布 v1.1.0 with 修复
```

### 场景 2：部分功能回退

**适用**：某个功能有问题，但整体版本稳定

**策略**：Feature flag 禁用问题功能

```typescript
// 临时禁用功能
const FEATURE_FLAGS = {
  customProviders: false,  // 暂时禁用
  mobileRelay: true,
  configUI: true,
}

// 或通过配置文件
{
  "features": {
    "customProviders": {
      "enabled": false,
      "reason": "Investigating stability issues"
    }
  }
}
```

### 场景 3：数据迁移失败

**问题**：升级导致配置文件损坏

**恢复步骤**：

```bash
# 1. 备份当前状态
cp .paseo-dev/config.json .paseo-dev/config.json.broken

# 2. 恢复备份（升级前自动备份）
cp .paseo-dev/config.json.v0.9.0 .paseo-dev/config.json

# 3. 降级到旧版本
git checkout v0.9.0

# 4. 验证功能
./scripts/verify-installation.sh

# 5. 调查失败原因
# 修复迁移脚本，重新尝试升级
```

---

## Changelog 管理

### CHANGELOG.md 格式

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Feature in progress

## [1.0.0] - 2026-09-10

### Added
- 自定义 API provider 支持（OpenAI/Anthropic/ACP）
- 移动端 E2EE relay 与配对
- 配置管理 Web UI
- 配置热重载功能
- Provider 健康检查

### Changed
- 配置文件格式升级（提供迁移工具）
- 移动端 UI 全面改版

### Deprecated
- 旧的 `thread/rollback` API（使用 `thread/revert` 替代）

### Removed
- 实验性 PTY 黑盒模式

### Fixed
- 修复断线重连时消息丢失问题 (#123)
- 修复移动端审批 UI 卡顿 (#145)

### Security
- 加强 API key 存储加密
- 修复 E2EE 密钥交换漏洞

## [0.9.0] - 2026-09-07

### Added
- 配置热重载
- Provider 健康检查
- 批量配置管理

## [0.8.0] - 2026-09-03

### Added
- Web/Desktop 配置管理 UI
- 移动端配置同步

## [0.7.0] - 2026-08-30

### Added
- 移动端 E2EE relay 支持
- 断线自动重连
- 移动端审批 UI

## [0.6.0-alpha.1] - 2026-08-24

### Added
- 自定义 API provider 基础支持
- 配置文档和示例

## [0.5.0] - 2026-08-24

### Added
- 初始版本
- Rust app-server bridge
- Codex 线程管理
- Paseo 集成

[Unreleased]: https://github.com/yourorg/codex-remote-workbench/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yourorg/codex-remote-workbench/compare/v0.9.0...v1.0.0
[0.9.0]: https://github.com/yourorg/codex-remote-workbench/compare/v0.8.0...v0.9.0
```

### 自动生成 Changelog

```bash
# 使用 conventional-changelog
npm install -g conventional-changelog-cli

# 生成自上个 tag 以来的 changelog
conventional-changelog -p angular -i CHANGELOG.md -s

# 或使用 git-cliff
git cliff --tag v1.0.0 > CHANGELOG.md
```

---

## GitHub 集成

### 1. GitHub Actions - CI/CD

**文件**：`.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
    tags: ['v*']
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      
      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd upstream/paseo
          npm install
      
      - name: Run tests
        run: |
          ./scripts/verify-rust.sh
          cd upstream/paseo && npm test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  release:
    needs: test
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build artifacts
        run: ./scripts/build-all-platforms.sh
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: dist/*
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 2. 版本自动化

**文件**：`.github/workflows/version-bump.yml`

```yaml
name: Version Bump

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version bump type'
        required: true
        type: choice
        options:
          - patch
          - minor
          - major

jobs:
  bump:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Bump version
        run: |
          npm version ${{ github.event.inputs.version }} --no-git-tag-version
          NEW_VERSION=$(node -p "require('./package.json').version")
          echo "NEW_VERSION=$NEW_VERSION" >> $GITHUB_ENV
      
      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v5
        with:
          commit-message: "chore: bump version to v${{ env.NEW_VERSION }}"
          branch: release/v${{ env.NEW_VERSION }}
          title: "Release v${{ env.NEW_VERSION }}"
          body: |
            Automated version bump to v${{ env.NEW_VERSION }}
            
            Please review and merge when ready.
```

### 3. Issue 模板

**文件**：`.github/ISSUE_TEMPLATE/bug_report.yml`

```yaml
name: Bug Report
description: Report a bug
title: "[Bug]: "
labels: ["bug", "triage"]
body:
  - type: dropdown
    id: version
    attributes:
      label: Version
      description: Which version are you using?
      options:
        - v1.0.0
        - v0.9.0
        - v0.8.0
        - v0.7.0
        - v0.6.0-alpha.1
        - v0.5.0
    validations:
      required: true
  
  - type: dropdown
    id: component
    attributes:
      label: Component
      options:
        - Custom API
        - Mobile (Android)
        - Mobile (iOS)
        - Web UI
        - Desktop
        - Rust Bridge
        - Configuration
    validations:
      required: true
  
  - type: textarea
    id: description
    attributes:
      label: Bug Description
      description: What happened?
    validations:
      required: true
  
  - type: textarea
    id: reproduction
    attributes:
      label: Steps to Reproduce
      placeholder: |
        1. Go to...
        2. Click on...
        3. See error
    validations:
      required: true
  
  - type: textarea
    id: logs
    attributes:
      label: Logs
      render: shell
```

### 4. Pull Request 模板

**文件**：`.github/PULL_REQUEST_TEMPLATE.md`

```markdown
## Description
<!-- Describe your changes -->

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Related Issues
<!-- Link to issues: Fixes #123, Closes #456 -->

## Testing
<!-- How has this been tested? -->
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing
- [ ] Real device testing (for mobile)

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] All tests passing
- [ ] CHANGELOG.md updated

## Screenshots (if applicable)
<!-- Add screenshots for UI changes -->

## Version Impact
<!-- Will this require a version bump? -->
- [ ] Patch (bug fixes)
- [ ] Minor (new features)
- [ ] Major (breaking changes)

## Migration Guide (for breaking changes)
<!-- How do users upgrade? -->
```

### 5. GitHub Projects 看板

**设置 Projects 看板**：

```
Project: Codex Harness Workbench v1.0

Columns:
├── Backlog (待办)
├── Sprint (当前冲刺)
├── In Progress (进行中)
├── Review (代码审查)
├── Testing (测试中)
└── Done (已完成)

Labels:
├── version:v0.6 (绿色)
├── version:v0.7 (蓝色)
├── version:v0.8 (紫色)
├── version:v0.9 (橙色)
├── version:v1.0 (红色)
├── priority:P0 (红色)
├── priority:P1 (橙色)
├── priority:P2 (黄色)
├── type:feature (绿色)
├── type:bug (红色)
├── type:docs (灰色)
└── platform:mobile (蓝色)
```

### 6. Release Notes 自动生成

**脚本**：`scripts/generate-release-notes.sh`

```bash
#!/usr/bin/env bash
# 生成 Release Notes

VERSION=$1
PREVIOUS_VERSION=$2

if [[ -z "$VERSION" ]] || [[ -z "$PREVIOUS_VERSION" ]]; then
    echo "Usage: $0 <new-version> <previous-version>"
    echo "Example: $0 v1.0.0 v0.9.0"
    exit 1
fi

echo "# Release Notes for $VERSION"
echo
echo "**Release Date**: $(date +%Y-%m-%d)"
echo

# 生成 Features
echo "## ✨ New Features"
git log $PREVIOUS_VERSION..$VERSION --oneline --no-merges \
    | grep -E "^[a-f0-9]+ feat:" \
    | sed 's/^[a-f0-9]* feat: /- /'
echo

# 生成 Bug Fixes
echo "## 🐛 Bug Fixes"
git log $PREVIOUS_VERSION..$VERSION --oneline --no-merges \
    | grep -E "^[a-f0-9]+ fix:" \
    | sed 's/^[a-f0-9]* fix: /- /'
echo

# 生成 Breaking Changes
echo "## ⚠️ Breaking Changes"
git log $PREVIOUS_VERSION..$VERSION --oneline --no-merges \
    | grep -E "BREAKING CHANGE" \
    | sed 's/^[a-f0-9]* /- /'
echo

# 贡献者
echo "## 👏 Contributors"
git log $PREVIOUS_VERSION..$VERSION --format='%aN' | sort -u | sed 's/^/- @/'
echo

# 下载链接
echo "## 📦 Downloads"
echo "- [Linux x64](https://github.com/yourorg/codex-remote-workbench/releases/download/$VERSION/codex-harness-linux-x64.tar.gz)"
echo "- [macOS arm64](https://github.com/yourorg/codex-remote-workbench/releases/download/$VERSION/codex-harness-macos-arm64.dmg)"
echo "- [Windows x64](https://github.com/yourorg/codex-remote-workbench/releases/download/$VERSION/codex-harness-windows-x64.exe)"
echo

# 文档链接
echo "## 📚 Documentation"
echo "- [Quick Start Guide](https://github.com/yourorg/codex-remote-workbench/blob/$VERSION/docs/QUICKSTART.md)"
echo "- [Configuration Guide](https://github.com/yourorg/codex-remote-workbench/blob/$VERSION/docs/CUSTOM_PROVIDERS.md)"
echo "- [Migration Guide](https://github.com/yourorg/codex-remote-workbench/blob/$VERSION/docs/MIGRATION.md)"
```

---

## 版本控制最佳实践

### Commit Message 规范

使用 Conventional Commits：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型**：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具链

**示例**：
```bash
feat(custom-providers): add OpenAI-compatible API support

Implement provider management logic that allows users to configure
custom OpenAI-compatible endpoints.

Closes #123
```

### Tag 命名规范

```bash
# 正式版本
git tag -a v1.0.0 -m "Release v1.0.0"

# 预发布版本
git tag -a v1.0.0-alpha.1 -m "Alpha release 1"
git tag -a v1.0.0-beta.1 -m "Beta release 1"
git tag -a v1.0.0-rc.1 -m "Release Candidate 1"

# 带构建元数据
git tag -a v1.0.0+20240824 -m "Release v1.0.0 build 20240824"
```

---

## 附录

### A. 版本发布检查清单

```markdown
## Pre-Release Checklist

- [ ] 所有测试通过（单元/集成/E2E）
- [ ] 代码审查完成
- [ ] CHANGELOG.md 更新
- [ ] 版本号已更新（package.json、Cargo.toml）
- [ ] 文档与代码同步
- [ ] 构建产物验证
- [ ] 安全扫描通过
- [ ] 性能测试达标
- [ ] 迁移脚本测试（如有破坏性变更）
- [ ] Release notes 准备完成

## Post-Release Checklist

- [ ] GitHub Release 创建
- [ ] 文档网站更新
- [ ] 发布公告发送
- [ ] 监控错误报告
- [ ] 社交媒体宣传
- [ ] 更新 roadmap
```

### B. 快速命令参考

```bash
# 查看当前版本
git describe --tags --abbrev=0

# 查看所有版本
git tag -l "v*"

# 比较两个版本
git diff v0.9.0..v1.0.0

# 切换到特定版本
git checkout v1.0.0

# 创建新版本
npm version minor  # 0.9.0 -> 0.10.0
npm version patch  # 0.9.0 -> 0.9.1
npm version major  # 0.9.0 -> 1.0.0

# 发布到 GitHub
git push origin v1.0.0
gh release create v1.0.0
```

---

**文档维护者**：开发团队  
**最后审阅**：2026-08-24  
**下次审阅**：每个主要版本发布前
