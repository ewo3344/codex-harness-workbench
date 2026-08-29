# 版本发布快速参考

**快速查找版本信息和操作命令**

---

## 📌 当前版本

| 项目 | 版本 | 状态 | 发布日期 |
|------|------|------|----------|
| 主项目 | `v0.6.0-alpha.1` | ✅ 已发布 | 2026-08-24 |
| Rust Bridge | `0.6.0` | ✅ 稳定 | 2026-08-24 |
| Paseo Fork | `0.5.0` | ✅ 稳定 | 2026-08-24 |

---

## 🗺️ 版本路线图一览

```
v0.5.0 ━━━━━━━━━━━━━━━━━━━━━━ ✅ 基础完成
  │
v0.6.0-alpha.1 ━━━━━━━━━━━━━ ✅ 自定义 API
  │
v0.7.0 ━━━━━━━━━━━━━━━━━━━━━ 🚧 移动端验证 (Aug 25-30)
  ├─ v0.7.0-alpha.1: E2EE Relay
  ├─ v0.7.0-alpha.2: 断线重连
  └─ v0.7.0-beta.1: UI 完善
  │
v0.8.0 ━━━━━━━━━━━━━━━━━━━━━ 🔜 配置 UI (Sep 1-3)
  ├─ v0.8.0-alpha.1: Web UI
  └─ v0.8.0-alpha.2: 移动端同步
  │
v0.9.0 ━━━━━━━━━━━━━━━━━━━━━ 🔮 高级功能 (Sep 4-7)
  ├─ v0.9.0-alpha.1: 热重载
  ├─ v0.9.0-alpha.2: 健康检查
  └─ v0.9.0-alpha.3: 批量管理
  │
v1.0.0-rc.1 ━━━━━━━━━━━━━━━━ 🚀 候选版本 (Sep 9)
  │
v1.0.0 ━━━━━━━━━━━━━━━━━━━━━ 🎉 正式发布 (Sep 10)
```

---

## ⚡ 常用命令

### 版本信息查询

```bash
# 当前版本
git describe --tags --abbrev=0

# 所有版本列表
git tag -l "v*" | sort -V

# 查看版本详情
git show v0.6.0-alpha.1

# 比较版本差异
git log --oneline v0.5.0..v0.6.0-alpha.1
git diff v0.5.0..v0.6.0-alpha.1 -- docs/
```

### 版本切换

```bash
# 切换到特定版本
git checkout v0.6.0-alpha.1

# 创建基于特定版本的分支
git checkout -b hotfix/fix-issue v1.0.0

# 回到最新开发版
git checkout develop
```

### 发布新版本

```bash
# Alpha 版本（功能开发）
./scripts/release.sh alpha

# Beta 版本（测试阶段）
./scripts/release.sh beta

# RC 版本（候选发布）
./scripts/release.sh rc

# 正式版本
./scripts/release.sh release
```

---

## 📦 版本标签说明

| 标签格式 | 含义 | 稳定性 | 示例 |
|---------|------|--------|------|
| `v0.x.y` | 开发版本 | 低-中 | v0.5.0 |
| `v0.x.y-alpha.n` | 内部测试 | 低 | v0.6.0-alpha.1 |
| `v0.x.y-beta.n` | 公开测试 | 中 | v0.7.0-beta.1 |
| `v1.x.y-rc.n` | 候选发布 | 高 | v1.0.0-rc.1 |
| `v1.x.y` | 正式发布 | 最高 | v1.0.0 |

---

## 🔄 升级路径

### 从 v0.5.0 升级到 v0.6.0-alpha.1

```bash
# 1. 备份配置
cp .paseo-dev/config.json .paseo-dev/config.json.backup

# 2. 切换版本
git checkout v0.6.0-alpha.1

# 3. 更新依赖
cd upstream/paseo && npm install && cd ../..

# 4. 重新构建
cd upstream/paseo && npm run build:server && cd ../..

# 5. 验证
./scripts/verify-custom-providers.sh

# 6. 启动
./scripts/start-harness-workbench.sh
```

### 回滚到 v0.5.0

```bash
# 1. 停止服务
pkill -f paseo

# 2. 切换版本
git checkout v0.5.0

# 3. 恢复配置（如需要）
cp .paseo-dev/config.json.backup .paseo-dev/config.json

# 4. 重新构建
cd upstream/paseo && npm install && npm run build:server && cd ../..

# 5. 启动
./scripts/start-harness-workbench.sh
```

---

## 🏷️ 版本功能对照表

| 功能 | v0.5.0 | v0.6.0 | v0.7.0 | v0.8.0 | v0.9.0 | v1.0.0 |
|------|--------|--------|--------|--------|--------|--------|
| Codex 基础 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 自定义 API | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 移动端配对 | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| 配置 UI | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| 热重载 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| 健康检查 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 🐛 已知问题与修复版本

| 问题 | 影响版本 | 修复版本 | Issue |
|------|----------|----------|-------|
| 配置需手动编辑 | v0.5.0 - v0.7.0 | v0.8.0 | - |
| 移动端未测试 | v0.5.0 - v0.6.0 | v0.7.0 | - |
| 无配置热重载 | v0.5.0 - v0.8.0 | v0.9.0 | - |

---

## 📱 平台支持矩阵

| 平台 | v0.5.0 | v0.6.0 | v0.7.0 | v1.0.0 |
|------|--------|--------|--------|--------|
| Linux x64 | ✅ | ✅ | ✅ | ✅ |
| macOS arm64 | ✅ | ✅ | ✅ | ✅ |
| macOS x64 | ✅ | ✅ | ✅ | ✅ |
| Windows x64 | ⚠️ | ⚠️ | ✅ | ✅ |
| Android 8.0+ | ❌ | ❌ | ✅ | ✅ |
| iOS 14.0+ | ❌ | ❌ | ✅ | ✅ |
| Web | ✅ | ✅ | ✅ | ✅ |

**图例**：✅ 完全支持 | ⚠️ 部分支持 | ❌ 不支持

---

## 📄 重要文件

| 文件 | 用途 |
|------|------|
| `CHANGELOG.md` | 详细变更记录 |
| `docs/VERSION_CONTROL.md` | 完整版本控制文档 |
| `docs/MASTER_PLAN.md` | 实施计划 |
| `package.json` | Node.js 版本号 |
| `Cargo.toml` | Rust 版本号 |
| `.github/workflows/release.yml` | 自动发布流程 |

---

## 🔗 快速链接

- 📚 [完整版本控制文档](VERSION_CONTROL.md)
- 🗺️ [主实施计划](MASTER_PLAN.md)
- 🚀 [快速开始](QUICKSTART.md)
- 📊 [项目状态](../STATUS.md)
- 🐛 [Issue Tracker](https://github.com/yourorg/codex-remote-workbench/issues)
- 📦 [Releases](https://github.com/yourorg/codex-remote-workbench/releases)

---

**最后更新**：2026-08-24  
**维护者**：开发团队
