# 文档总览

**所有文档的索引和导航**

当前入口是剩余工作与如何运行，不是 08-24 的三周 `MASTER_PLAN` 或 G0–G2 交接。

---

## 当前入口（必读）

| 文档 | 描述 |
|------|------|
| [tasks.md](tasks.md) | 剩余工作（T8–T11） |
| [QUICKSTART.md](QUICKSTART.md) | 如何运行：`./scripts/start-harness-workbench.sh` |
| [../STATUS.md](../STATUS.md) | 项目状态总览 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 系统架构与不可破坏约束 |

---

## 📚 配置与参考

| 文档 | 描述 | 更新日期 |
|------|------|----------|
| [VERSION_CONTROL.md](VERSION_CONTROL.md) | 版本控制与发布规范 | 2026-08-29 |
| [CUSTOM_PROVIDERS.md](CUSTOM_PROVIDERS.md) | 自定义 API 配置指南 | 2026-08-24 |

---

## 📖 档案（不是当前必读）

| 文档 | 用途 |
|------|------|
| [MASTER_PLAN.md](MASTER_PLAN.md) | 2026-08-24 三周实施计划快照 |
| [NEXT_GOALS.md](NEXT_GOALS.md) | G0–G2 交接（已完成，勿当待办） |
| [CUSTOM_API_PLAN.md](CUSTOM_API_PLAN.md) | 自定义 API 专项计划快照 |
| [../PLAN.md](../PLAN.md) | 原始重建计划 |

---

## 🏗️ 架构文档

| 文档 | 用途 |
|------|------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 系统架构与组件边界 |
| [FEATURE_MATRIX.md](FEATURE_MATRIX.md) | 桌面体验功能矩阵 |
| [OMP_RUST_ASSESSMENT.md](OMP_RUST_ASSESSMENT.md) | OMP Rust 评估 |

---

## 📝 开发文档

| 文档 | 用途 |
|------|------|
| [PROGRESS.md](PROGRESS.md) | 开发进度日志 |
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | 实现与验证摘要 |
| [../STATUS.md](../STATUS.md) | 项目状态总览 |

---

## 🔧 操作指南

| 文档 | 用途 |
|------|------|
| [QUICKSTART.md](QUICKSTART.md) | 快速开始（安装、配置、验证）|
| [CUSTOM_PROVIDERS.md](CUSTOM_PROVIDERS.md) | 自定义 API 配置指南 |
| [VERSION_QUICK_REF.md](VERSION_QUICK_REF.md) | 版本信息快速参考 |
| [VERSION_SUMMARY.md](VERSION_SUMMARY.md) | 版本发布总览 |

---

## 🎯 按角色导航

### 🆕 新用户

**目标**：5 分钟内启动并运行

1. [QUICKSTART.md](QUICKSTART.md) - 安装和启动
2. [CUSTOM_PROVIDERS.md](CUSTOM_PROVIDERS.md) - 配置自定义 API
3. [VERSION_QUICK_REF.md](VERSION_QUICK_REF.md) - 查看版本信息

### 👨‍💻 开发者

**目标**：理解架构并参与开发

1. [ARCHITECTURE.md](ARCHITECTURE.md) - 了解系统架构
2. [tasks.md](tasks.md) - 当前剩余工作
3. [VERSION_CONTROL.md](VERSION_CONTROL.md) - 学习版本管理规范
4. [PROGRESS.md](PROGRESS.md) - 查看开发历史
5. [FEATURE_MATRIX.md](FEATURE_MATRIX.md) - 了解功能完成度

### 📊 项目经理

**目标**：掌握项目进度和计划

1. [tasks.md](tasks.md) - 剩余工作
2. [../STATUS.md](../STATUS.md) - 项目状态总览
3. [VERSION_CONTROL.md](VERSION_CONTROL.md) - 版本发布计划
4. [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - 阶段总结（档案）

### 🔧 运维人员

**目标**：部署和维护系统

1. [QUICKSTART.md](QUICKSTART.md) - 部署指南
2. [VERSION_QUICK_REF.md](VERSION_QUICK_REF.md) - 版本管理
3. [VERSION_CONTROL.md](VERSION_CONTROL.md) - 回滚策略

---

## 📂 按主题导航

### 自定义 API

- [CUSTOM_PROVIDERS.md](CUSTOM_PROVIDERS.md) - 配置指南
- [CUSTOM_API_PLAN.md](CUSTOM_API_PLAN.md) - 实施计划
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - 实施总结

### 移动端

- [tasks.md](tasks.md) - T8 relay 未证明项；T7 Android 真机表单已通过
- [FEATURE_MATRIX.md](FEATURE_MATRIX.md) - 移动端功能矩阵
- [RELAY_VALIDATION.md](RELAY_VALIDATION.md) - 本地 E2EE relay 验证

### 版本管理

- [VERSION_CONTROL.md](VERSION_CONTROL.md) - 完整版本控制文档
- [VERSION_QUICK_REF.md](VERSION_QUICK_REF.md) - 快速参考
- [VERSION_SUMMARY.md](VERSION_SUMMARY.md) - 版本总览

### 架构与设计

- [ARCHITECTURE.md](ARCHITECTURE.md) - 系统架构
- [../PLAN.md](../PLAN.md) - 重建计划
- [OMP_RUST_ASSESSMENT.md](OMP_RUST_ASSESSMENT.md) - OMP 评估

---

## 📈 文档统计

| 类型 | 数量 | 总页数 |
|------|------|--------|
| 规划文档 | 4 | 2000+ |
| 架构文档 | 3 | 500+ |
| 开发文档 | 3 | 400+ |
| 操作指南 | 4 | 800+ |
| **总计** | **14** | **3700+** |

---

## 🔄 文档更新周期

| 文档 | 更新频率 |
|------|----------|
| PROGRESS.md | 每次开发后 |
| STATUS.md | 每周 |
| MASTER_PLAN.md | 档案，不再当当前计划更新 |
| VERSION_*.md | 每次版本发布 |
| 其他 | 按需更新 |

---

## ✅ 文档质量检查

- [x] 所有文档包含目录
- [x] 所有文档包含更新日期
- [x] 交叉引用链接正确
- [x] 代码示例可执行
- [x] 截图清晰可见（如有）
- [x] 版本信息准确

---

## 🤝 贡献文档

如需更新文档，请遵循：

1. **格式规范**：使用 Markdown
2. **命名规范**：大写字母 + 下划线
3. **更新日期**：文档顶部注明
4. **交叉引用**：使用相对路径链接
5. **中英混排**：英文前后加空格

---

**维护者**：开发团队  
**最后审阅**：2026-08-29  
**下次审阅**：2026-09-05
