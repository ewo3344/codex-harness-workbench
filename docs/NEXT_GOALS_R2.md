# 后续目标指示 第二轮（交接给 Grok）

编写日期：2026-08-29
适用仓库：`/home/e/workspace/codex-remote-workbench`
前序文件：`docs/NEXT_GOALS.md`（G0–G2 已完成，见下文核实结论）

本文件是执行指示。产品范围与阶段划分以 `docs/MASTER_PLAN.md` 和 `STATUS.md` 为准。

## 一、上一轮成果核实（2026-08-29 实测）

G0–G2 已完成，以下为复核结论，不需重做：

- 子模块改动已保全。`upstream/paseo` HEAD `84acf5a`，祖先 `b5f5832`，工作区干净。
- `patches/paseo/` 的两个 patch **实测序列可重建**：在临时克隆中 0001 干净应用到
  `b5f5832`，提交后 0002 `--check` 通过；`SHA256SUMS` 两项校验成功。
- 父仓库 3 个提交、2305 个文件。`git ls-files | grep -c paseo-dev` 为 0，密钥未泄漏。
- VERSION_* 虚构「已发布」记录已删除；`release.sh` 移除了整个 `update_version`
  函数（版本身份改由 git tag + CHANGELOG 承载，不再改写任何清单，也不再污染子模块）；
  4 个缺失 helper 引用已清除；`ci.yml` 只调用 `lint` 与 `build:server`，均存在。
- `docs/IMPLEMENTATION_SUMMARY.md` 已重写，28–29 行已声明被删除 helper 的取代关系。

## 二、GitHub 凭证现状（这是 H1 的关键前提，先读）

**不需要重新登录。** `gh auth status` 显示已登录账号 `ewo3344`（keyring 存储），
token scopes 为 `gist`、`read:org`、`repo`，Git 操作协议为 **ssh**。

但实测发现两个会直接导致推送失败的问题，必须先由用户处理：

1. **SSH 认证不通。**`ssh -T git@github.com` 返回
   `Permission denied (publickey)`。而 `gh auth status` 表明 git 操作走 SSH，
   因此按现状推送必然失败。本机现有两个公钥
   （`id_ed25519_smart_box_pi.pub`、`ssh-95.133.242.141-11451-root-ed25519.pub`），
   从命名看均为其他用途，且未注册到该账号。
2. **无法代为查询或注册密钥。**`gh ssh-key list` 报错，要求 `admin:public_key`
   或 `read:public_key` scope，当前 token 不具备。
3. **缺 `workflow` scope。**父仓库与 paseo fork 都包含 `.github/workflows/` 文件，
   用 HTTPS + token 推送含 workflow 的提交会被 GitHub 拒绝。

## H1 — 建立远端备份（需要用户先做一次授权）

### 动机

commits 目前只在本地，丢失风险已消除但**无异地备份**。这是当前唯一的单点故障。

### 必须先向用户索取的决策

不要尝试推送直到用户明确选定路线并完成授权。二选一：

- **路线 A（SSH，与现有 `gh` 协议设置一致）**：用户在 GitHub Settings → SSH keys
  添加一个本机可用的公钥；或授权补充 `admin:public_key` scope
  （`gh auth refresh -h github.com -s admin:public_key,workflow`）以便注册新密钥。
- **路线 B（HTTPS + token）**：用户执行
  `gh auth refresh -h github.com -s workflow` 补 scope，并将
  `gh auth setup-git` 配置为 credential helper（当前 `credential.helper` 未配置）。

**不要代替用户生成密钥、添加密钥或改动 `gh` 的账号与 scope。**
这些操作涉及用户账号权限，必须由用户自己执行或明确授权后进行。
建议直接提示用户在会话中运行 `! gh auth refresh -h github.com -s workflow`
（`!` 前缀会把命令输出带回会话）。

### 授权完成后的执行步骤

1. **父仓库远端。**由用户决定仓库名与**私有/公开**。仓库含 AGPL-3.0 派生代码，
   公开涉及许可合规判断，**这个判断权归用户，不要代为决定**。
   创建后 `git remote add origin <url>` 并推送 `main`。
2. **子模块 fork。**为 `ewo3344` 创建 `getpaseo/paseo` 的 fork
   （`gh repo fork getpaseo/paseo --remote=false --clone=false`），
   在 `upstream/paseo` 内 `git remote add fork <url>`，
   推送 `codex-harness-workbench` 分支到 `fork`。
   **绝对不要向 `origin`（`getpaseo/paseo`）推送。**
3. **修正分支状态。**当前 `upstream/paseo` 检出在 `main` 上，而 `main` 追踪
   `origin/main`（上游）。两个本地提交叠在追踪上游的分支上，一次 `git pull`
   即可能触发与上游的合并/变基。`codex-harness-workbench` 分支已存在且指向同一
   commit `84acf5a`。推送后应切换到该分支并设置上游为 `fork`，
   使 `main` 回到纯净的上游追踪状态。
4. **更新 `UPSTREAMS.toml`。**把
   `branch = "codex-harness-workbench (local-only; fork remote pending)"`
   改为真实 fork 地址与分支。patch 文件在 fork 可用后仍建议保留为离线冗余。

### 验收

```bash
git -C . remote -v                            # 期望有 origin
git -C upstream/paseo remote -v               # 期望有 fork，且 origin 仍为上游
git -C upstream/paseo branch --show-current    # 期望 codex-harness-workbench
git -C upstream/paseo status --short           # 期望为空
```

以及：远端可见对应 commit；`git log origin/main --oneline -1` 与本地一致。

### 边界

推送失败不会损坏本地仓库，但会掩盖真实原因——**不要用重试或改协议的方式绕过
认证失败**，先回到 H1 的授权步骤。不要为通过推送而删除或改写 workflow 文件。

## H2 — 三处文档遗留（无外部依赖，可立即执行）

1. **`STATUS.md:280` 的 `**当前版本**：v0.5.0 (Alpha)` 是虚构声明**，无 tag 支撑
   （`git tag -l` 为空）。改为「无发布 tag（pre-tag）」或等价表述。
   同文件 `**预计 Alpha 发布**：2026-09-10` 若仍成立可保留。
   上一轮记录「未改 STATUS.md」是遵守了前序文件「不要反向改动」的措辞，
   那条指示有歧义，不算疏漏；**本轮明确授权修改此文件的这一处**。
2. **`docs/IMPLEMENTATION_SUMMARY.md:54` 的「当前无在线设备」已过时**。
   `adb devices -l` 现显示 `10AE6J03LC001JL`（V2352A）。同步为设备已接入、
   Maestro 未安装。
3. **给 `docs/NEXT_GOALS.md` 加状态头**，标注 G0–G2 已完成并指向本文件，
   避免后续把已完成项当待办重做。

### 验收

```bash
grep -n "v0\.5\.0" STATUS.md          # 期望无虚构版本声明
grep -rn "无在线设备" docs/           # 期望无过时表述
```

## H3 — Android 实机 provider 生命周期验收（产品线最高优先）

### 动机

这是 `MASTER_PLAN.md` 阶段 2 剩余的最高优先项，且**当前只差一个工具**：
设备已接入（`10AE6J03LC001JL`），脚本 `packages/app/maestro/test-provider-forms-android.sh`
在 08-28 已备好并通过 `--check`，当时的唯一阻塞是无设备，现已解除。

### 要求

1. **安装 Maestro**（`command -v maestro` 当前为空）。这会下载二进制并改动 PATH，
   属中等风险——**先向用户说明来源与改动范围，再执行**。记录版本号以便复现。
2. 运行：
   ```bash
   cd upstream/paseo
   PASEO_MAESTRO_SERIAL=10AE6J03LC001JL bash packages/app/maestro/test-provider-forms-android.sh
   ```
3. 按脚本既有设计核验产物：截图、logcat、`provider-after.json`。
   脚本会在 Maestro 取消自定义 provider 表单后查询隔离 daemon 的
   `provider ls --json`，断言未写入 provider 且只保留必需的 `codex`。
4. 保持既有隔离契约：随机端口、临时 `PASEO_HOME`、退出时清理 `adb reverse`。
   **不要为跑验证而改 `config/paseo.dev.json` 打开 relay。**

### 边界

本项只覆盖 **provider 表单可达性与取消后的持久化状态**。不得据此声称
QR/手动配对、多设备、完整聊天投递、Wi-Fi/4G 切换、replay overflow 恢复、
iOS 配对、hosted TLS relay 已完成——这些在 `docs/RELAY_VALIDATION.md`
已明确列为未证明项，须逐项独立验收。设备掉线或 Maestro 失败要如实记为待验。

## H4 — 承接既有计划

H1–H3 完成后回到 `docs/MASTER_PLAN.md` 与 `STATUS.md`。按当前证据，
下列为真实剩余优先级：

1. `docs/RELAY_VALIDATION.md` 自列的未证明项（配对、多设备、网络切换、
   replay overflow、iOS、hosted TLS）。
2. 配置面：CAS 已实现 stale `expectedRevision` 拒写（49/49 通过），
   但**多客户端并发提交整段数组仍可能最后写入覆盖**；活跃会话连续性、
   重复更新压力、reload 失败日志审计未做。
3. Desktop relay-terminal reconnect case 仍有 renderer 生命周期失败日志
   （`IMPLEMENTATION_SUMMARY.md:49-50`），未达完成标准。
4. 额度恢复后（2026-08-31 08:16）复跑依赖真实模型 turn 的验收，
   含 rewind 成功双 turn E2E。

`MASTER_PLAN.md` 中阶段 3「0% 🔜」、阶段 4「🔮 未来」等标记已过时，
执行前先按 `STATUS.md` 校正，不要照旧标记重做已完成的工作。

## 通用约束

- **记录规范**：每次开发后按 `docs/PROGRESS.md` 既有格式追加日期、完成事项、
  验证命令、边界与下一步。只有经真实 app-server 或真实 Paseo 客户端验证的项
  才能标为完成（`PLAN.md` 既有规则）。
- **不要声称未验证的结论**。`FEATURE_MATRIX.md` 的验收原则写明「源码里有一个
  case」不等于完成。阻塞要如实记录为待验。
- **安全边界**：Codex 始终是 required provider，不可通过配置禁用；审批保持双向
  server request 语义；API key 不进日志、不同步移动端。详见 `docs/ARCHITECTURE.md`。
- **需要用户确认的动作**：涉及用户 GitHub 账号（登录、scope、密钥、仓库可见性）、
  向任何远端推送、安装改动 PATH 的系统级工具——先说明再执行。

## 执行顺序

```
H2（文档遗留，无阻塞，可立即做）
H1（远端备份）—— 等用户选定 SSH/HTTPS 路线并授权
H3（Android 实机）—— 等用户批准安装 Maestro
      └─> H4（回到 MASTER_PLAN）
```

H1 与 H3 各自等待一个独立的用户决策，彼此不依赖，**谁先获得授权就先做谁**。
H2 无外部依赖，应先完成以免遗漏。
