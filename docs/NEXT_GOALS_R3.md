# 后续目标指示 第三轮（交接给 Grok）

编写日期：2026-08-29
适用仓库：`/home/e/workspace/codex-remote-workbench`
前序：`docs/NEXT_GOALS.md`（G0–G2 完成）、`docs/NEXT_GOALS_R2.md`（H2 完成，H1/H3 待授权）

## 一、用户已做出的决策（本轮的授权前提）

用户在 2026-08-29 明确选定：

1. **GitHub 认证走「补 token scope」路线**，不加 SSH 密钥。
2. **父仓库建为公开（public）**。用户已知悉仓库含 AGPL-3.0 派生代码，
   公开触发的开源许可合规义务由用户承担；不要再就此反复确认。
3. **允许安装 Maestro** 以跑 Android 实机验收。

用户明确表示技术操作希望尽量由 AI 完成。因此除必须由用户本人在浏览器完成的
授权动作外，其余步骤不要再抛回给用户决定。

## 二、上一轮 H2 核实结论（已完成，不需重做）

- `STATUS.md:280` 已改为「无发布 tag（pre-tag）」。
- `docs/IMPLEMENTATION_SUMMARY.md:54` 已记录设备 `10AE6J03LC001JL`（V2352A）
  已接入、Maestro 未安装。
- `docs/NEXT_GOALS.md:3` 已加状态头，标注 G0–G2 完成并指向 R2。
- `docs/PROGRESS.md` 新增 604 行条目记录本轮。

## 三、公开前的密钥扫描（已通过，作为放行依据）

2026-08-29 实测：`git ls-files` 中高危文件名命中项**全部为
`protocol/codex-app-server-0.149.0/` 下的协议 schema**（token usage / credential
类型定义），非真实凭证；`sk-ant-api03` / `sk-proj-` / `gho_` / `ghp_` 前缀扫描
在非文档路径下**零命中**；`paseo-dev` 计数为 0。

**若在 J1 推送前又新增了提交，必须重跑一次该扫描再推。**

## J1 — 完成远端备份（公开仓库）

### 第 1 步：token scope（必须由用户执行）

推送前需要 `workflow` scope，因为父仓库与 paseo fork 都含 `.github/workflows/`。
当前 token scopes 仅 `gist`、`read:org`、`repo`。

提示用户在会话中输入（`!` 前缀会把输出带回会话）：

```
! gh auth refresh -h github.com -s workflow
```

这会打开浏览器授权页。完成后用 `gh auth status` 确认 scopes 已含 `workflow`。

**同时必须处理协议问题**：`gh auth status` 显示 git 操作协议为 **ssh**，而
`ssh -T git@github.com` 实测返回 `Permission denied (publickey)`。用户既然选择
不加 SSH 密钥，就要把协议切到 HTTPS 并配置 credential helper
（当前 `credential.helper` 未配置）：

```bash
gh config set git_protocol https
gh auth setup-git
```

这两条 AI 可以直接执行，不改动用户账号权限。执行后用
`git ls-remote https://github.com/ewo3344/<repo>.git` 之类的只读操作验证凭证生效，
不要用推送来试探。

### 第 2 步：创建父仓库并推送

仓库名由 AI 自行决定，建议 `codex-harness-workbench`（与项目工作名一致；
目录名仍是 `codex-remote-workbench`，这是迁移期的已知差异，见 `README.md`）。

```bash
gh repo create codex-harness-workbench --public --source=. --remote=origin --push
```

若该命令因已有 remote 或名称冲突失败，改为分步：`gh repo create ... --public`，
再 `git remote add origin <url>`、`git push -u origin main`。

### 第 3 步：paseo fork 并推送

```bash
gh repo fork getpaseo/paseo --remote=false --clone=false
cd upstream/paseo
git remote add fork https://github.com/ewo3344/paseo.git
git push -u fork codex-harness-workbench
```

**绝对不要向 `origin`（`getpaseo/paseo`）推送。**

### 第 4 步：修正子模块分支状态

当前 `upstream/paseo` 检出在 `main` 上，而 `main` 追踪上游 `origin/main`，
两个本地提交（`e9ff317`、`84acf5a`）叠在追踪上游的分支上——一次 `git pull`
即可能触发与上游的合并/变基。`codex-harness-workbench` 已存在且指向同一 commit。

```bash
cd upstream/paseo
git checkout codex-harness-workbench
git branch --set-upstream-to=fork/codex-harness-workbench
git branch -f main origin/main   # 让 main 回到纯净的上游追踪状态
```

最后一条会移动 `main`；执行前确认 `codex-harness-workbench` 已成功推送到 `fork`，
否则两个提交将只存在于 reflog。

### 第 5 步：更新 `UPSTREAMS.toml`

把 `branch = "codex-harness-workbench (local-only; fork remote pending)"`
改为真实 fork 地址与分支。`patches/paseo/` 保留为离线冗余，不要删。

### 验收

```bash
git remote -v && git log origin/main --oneline -1
git -C upstream/paseo remote -v
git -C upstream/paseo branch --show-current   # 期望 codex-harness-workbench
git -C upstream/paseo rev-parse --abbrev-ref '@{upstream}'  # 期望 fork/...
git -C upstream/paseo status --short          # 期望为空
```

### 边界

推送失败不要用重试或换协议绕过——回到第 1 步查 scope 与 helper。
不要为通过推送而删改 workflow 文件。父仓库公开后，后续任何提交都要先过
第三节的密钥扫描。

## J2 — Android 实机 provider 生命周期验收（用户已批准安装 Maestro）

### 动机

`MASTER_PLAN.md` 阶段 2 剩余的最高优先项。设备 `10AE6J03LC001JL`（V2352A）已在线，
脚本 `packages/app/maestro/test-provider-forms-android.sh` 在 08-28 已通过 `--check`，
当时唯一阻塞是无设备，现已解除。用户已批准安装 Maestro。

### 步骤

1. **安装 Maestro**。用户已授权，可直接执行，但**必须记录安装来源与版本号**
   （`maestro --version`）以便复现。安装会改动 PATH；若安装器写入 shell 配置，
   在当前会话用绝对路径或 `export PATH` 而不是要求用户重开终端。
   注意本机 shell 是 fish，`~/.bashrc` 类改动不会生效。
2. **运行验收**：
   ```bash
   cd upstream/paseo
   PASEO_MAESTRO_SERIAL=10AE6J03LC001JL bash packages/app/maestro/test-provider-forms-android.sh
   ```
3. **核验产物**：截图、logcat、`provider-after.json`。脚本会在 Maestro 取消自定义
   provider 表单后查询隔离 daemon 的 `provider ls --json`，断言未写入 provider
   且只保留必需的 `codex`。
4. 保持既有隔离契约：随机端口、临时 `PASEO_HOME`、退出时清理 `adb reverse`。
   **不要为跑验证而改 `config/paseo.dev.json` 打开 relay。**

### 边界

本项只覆盖 **provider 表单可达性与取消后的持久化状态**。不得据此声称 QR/手动配对、
多设备、完整聊天投递、Wi-Fi/4G 切换、replay overflow 恢复、iOS 配对、hosted TLS relay
已完成——这些在 `docs/RELAY_VALIDATION.md` 已列为未证明项，须逐项独立验收。

若 Maestro 安装失败或设备中途掉线，**如实记为待验**，不要用模拟器结果替代真机结论，
也不要把脚本的 `--check`（静态契约检查）当作真机通过。

## J3 — 承接既有计划

J1、J2 完成后回到 `docs/MASTER_PLAN.md` 与 `STATUS.md`。当前真实剩余优先级：

1. `docs/RELAY_VALIDATION.md` 自列的未证明项：配对（QR/手动）、多设备、
   完整聊天投递、Wi-Fi/4G 切换、replay overflow 恢复、iOS、hosted TLS relay。
2. **配置面并发**：CAS 已实现 stale `expectedRevision` 拒写（49/49 通过），
   但多客户端并发提交整段数组仍可能最后写入覆盖；活跃会话连续性、重复更新压力、
   reload 失败日志审计未做。
3. Desktop relay-terminal reconnect case 仍有 renderer 生命周期失败日志
   （`IMPLEMENTATION_SUMMARY.md:49-50`），未达完成标准。
4. **额度恢复后（2026-08-31 08:16）**复跑依赖真实模型 turn 的验收，
   含 rewind 成功双 turn E2E。今天是 08-29，该时间点未到。

`MASTER_PLAN.md` 中阶段 3「0% 🔜」、阶段 4「🔮 未来」标记已过时，
执行前按 `STATUS.md` 校正，不要重做已完成的工作。

## 通用约束

- **记录规范**：每次开发后按 `docs/PROGRESS.md` 既有格式追加日期、完成事项、
  验证命令、边界与下一步。只有经真实 app-server 或真实 Paseo 客户端验证的项
  才能标为完成。
- **不要声称未验证的结论**。阻塞如实记录为待验。
- **安全边界**：Codex 始终是 required provider；审批保持双向 server request 语义；
  API key 不进日志、不同步移动端。详见 `docs/ARCHITECTURE.md`。
- **仓库现已公开**（J1 完成后）：任何新提交前先过第三节的密钥扫描。
- 用户希望尽量由 AI 执行。除浏览器授权外不要把技术步骤抛回用户。

## 执行顺序

```
J1 第1步（用户跑 gh auth refresh）
  └─> J1 第2–5步（AI 建仓、推送、修分支、更新 UPSTREAMS.toml）
J2（AI 装 Maestro 跑真机验收）—— 与 J1 无依赖，可并行或先做
      └─> J3（回到 MASTER_PLAN）
```

J2 不依赖 J1，若用户尚未完成授权，**先做 J2**。

