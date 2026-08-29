# 后续目标指示（交接给 Codex）

编写日期：2026-08-29
适用仓库：`/home/e/workspace/codex-remote-workbench`

本文件是执行指示，不是计划草案。每个目标给出动机、验收命令和边界。
产品范围与阶段划分以 `docs/MASTER_PLAN.md` 和 `STATUS.md` 为准，本文件不重复其内容，
只补充它们尚未覆盖的基础设施缺口与勘误项。

## 交接时的已核实事实

以下状态在 2026-08-29 实测得出，是安排优先级的依据：

- 父仓库 `main` 分支**零提交**（`git log` 报「尚无任何提交」），`git tag` 为空，
  仅 3 个暂存条目：`.gitmodules`、`upstream/oh-my-pi`、`upstream/paseo`。
- 父仓库**没有配置任何 remote**。
- `upstream/paseo` 固定在 `b5f5832`，但工作区有 **67 files changed, 2980 insertions,
  819 deletions**，另有 15 个未跟踪文件和 2 个删除。这些改动承载了 custom provider
  UI、relay E2E、Android Maestro 脚本等全部近期成果。
- `upstream/paseo` 的 `origin` 直接指向上游 `https://github.com/getpaseo/paseo.git`，
  **没有自建 fork remote**。`upstream/oh-my-pi` 工作区干净。
- `docs/MASTER_PLAN.md`（更新至 08-27）、`STATUS.md`、`docs/PROGRESS.md`（更新至 08-28）、
  `docs/FEATURE_MATRIX.md`、`docs/RELAY_VALIDATION.md` 内容与实现一致，可信。
- `docs/VERSION_CONTROL.md`、`docs/VERSION_QUICK_REF.md`、`docs/VERSION_SUMMARY.md`、
  `docs/IMPLEMENTATION_SUMMARY.md`、`docs/INDEX.md`、`scripts/release.sh`、
  `.github/workflows/ci.yml` 写于 08-24 且未随后续开发更新，含已确认的事实错误，
  详见 G2 与 G3。

## G0 — 保全 `upstream/paseo` 本地改动（最高优先，阻塞其余一切）

### 动机

近期全部产品成果只存在于子模块工作区，不在任何 commit 中。父仓库零提交也无法记录它们。
当前状态下一次 `git checkout`、`git submodule update` 或 `npm version` 即可永久销毁
2980 行改动。`UPSTREAMS.toml` 只用一行 `local_patch` 文字描述补丁，不足以重建 82 个文件。

在此目标完成前，**不要**执行 `git submodule update`、`git checkout` 子模块内文件、
`scripts/release.sh`，也不要在子模块内切换分支。

### 要求

1. 先做一次非 Git 的物理备份（例如 `tar` 整个 `upstream/paseo` 工作区到仓库外），
   再开始任何 Git 操作。这是唯一一次无法回退的操作窗口。
2. 在子模块内提交改动。注意 15 个未跟踪文件必须显式 `git add`，
   其中至少包含 `packages/app/e2e/browser/custom-provider-lifecycle.spec.ts`、
   `packages/app/maestro/{check-provider-forms-android.mjs,provider-forms-android.yaml,test-provider-forms-android.sh}`、
   `packages/app/src/screens/settings/custom-provider-edit-sheet.test.tsx`。
   提交前逐一确认没有把 `.paseo-dev/`、密钥、APK 等产物纳入。
3. 建立可推送的去处。`origin` 指向上游，无推送权限，因此需要用户先在 GitHub 上
   创建 fork 并提供地址，再添加为 `fork` remote 并推送分支（建议分支名
   `codex-harness-workbench`）。**这一步需要用户的账号与凭证，不要代替用户决定
   fork 归属或擅自推送到 `origin`。** 若用户暂不提供 fork，退路是在父仓库内
   保存 `git format-patch` 系列补丁并在 `UPSTREAMS.toml` 记录基线 revision 与
   补丁应用顺序；但这只是过渡手段，82 文件规模下 rebase 成本高，仍应尽快转为 fork 分支。
4. 更新 `UPSTREAMS.toml` 的 `[paseo]`：记录 fork 地址、分支名、新 revision，
   并把 `local_patch` 从一行描述改为指向真实 commit 或补丁目录。

### 验收

```bash
cd upstream/paseo && git status --short   # 期望为空
cd upstream/paseo && git log --oneline -3 # 期望看到新提交，父提交为 b5f5832
```

以及：备份存在于仓库外；`UPSTREAMS.toml` 中的 revision 与 `git rev-parse HEAD` 一致。

### 边界

不要为了让状态变干净而丢弃任何改动。不要 rebase 或 squash 到上游历史之上。
不要向 `getpaseo/paseo` 的 `origin` 推送。

## G1 — 父仓库首次提交与 remote

### 动机

父仓库零提交，导致子模块 pointer、`protocol/` 快照、`docs/`、`crates/` 全部无版本记录，
G2 之后的任何版本号或 tag 都无处附着。

### 要求

1. 在 G0 完成后进行，使首次提交能记录到正确的子模块 revision。
2. 提交前检查 `.gitignore` 是否覆盖 `.paseo-dev/`、`target/`、`node_modules/`、
   构建产物与日志。当前 `.paseo-dev/` 内有 `daemon-keypair.json`、`daemon.log`、
   `config.json` 等运行态与密钥文件，**必须确认它们不被提交**。
3. 同时清理我遗留的临时配置：`.paseo-dev/config.test.json` 与
   `.paseo-dev/config.verify.json` 是我在 08-24 写入的测试残留，确认无用后删除，
   不要提交。
4. remote 由用户提供后再添加与推送；在此之前只做本地提交。

### 验收

```bash
git log --oneline                      # 期望有提交
git status --short                     # 期望为空或仅剩有意忽略项
git ls-files | grep -c paseo-dev       # 期望 0
git submodule status                   # 期望指向 G0 的新 revision
```

## G2 — 修正失效的版本文档（含勘误）

### 动机

08-24 写入的一组版本文档含已确认的事实错误。它们目前是仓库中关于版本状态的唯一说明，
会误导后续操作，且 `scripts/release.sh` 与 `.github/workflows/ci.yml` 在当前形态下
必然执行失败。

### 逐项勘误要求

1. **删除虚构的版本历史。**`docs/VERSION_CONTROL.md` 声称 v0.5.0 与 v0.6.0-alpha.1
   「✅ 已发布」并附发布日期；`docs/VERSION_QUICK_REF.md` 与 `docs/VERSION_SUMMARY.md`
   同步了这一说法。实际零提交、零 tag，这些记录无事实依据，必须删除而非改写日期。
   保留其中的语义化版本规范、分支策略、回滚流程等仍然有效的规范性内容。

2. **修正版本号来源。**文档称 Rust 组件为 `0.6.0`，实际 `crates/codex-bridge` 与
   `crates/omp-primitives` 均为 `0.1.0`。根 `Cargo.toml` 是纯 workspace 清单，
   **没有 `version` 字段**，因此 `scripts/release.sh` 中那条 `sed -i "s/^version = ...`
   匹配不到任何内容却静默返回成功，是死代码。要么改为写入两个 crate 的 `Cargo.toml`
   或引入 `[workspace.package] version` + `version.workspace = true`，要么移除该步骤；
   不要保留静默失败的分支。

3. **补齐或移除缺失脚本引用。**`scripts/release.sh` 引用 4 个不存在的脚本：
   `generate-release-notes.sh`、`build-all-platforms.sh`、`migrate-config.sh`、
   `verify-installation.sh`。`.github/workflows/ci.yml` 也 `chmod +x` 并调用第一个。
   任选其一：实现这些脚本，或从 `release.sh` 与 `ci.yml` 中删除引用。
   在多平台构建尚无需求前，倾向后者，避免维护空壳。

4. **修正 CI 中不存在的 npm 脚本。**`ci.yml` 的 coverage 步骤调用
   `npm run test:coverage`，该脚本在 `upstream/paseo/package.json` 中不存在
   （`lint`、`build:server`、`build:daemon-web-ui` 存在）。改为真实可用的命令或移除该步骤。

5. **纠正阶段 1 的成果归属。**`docs/IMPLEMENTATION_SUMMARY.md` 把 custom provider
   支持记作 08-24 的产出，但当时加入的 `getEnabledCustomProviderIds()`
   **已不在代码中**，被 08-27 起的完整实现取代（现 `bootstrap.ts:890-895` 为
   Codex 恒发布 + dev-only `mock` 分支，配套 `source: "custom"` 快照语义与完整 UI
   生命周期）。改为指向 `docs/PROGRESS.md` 中 08-27/08-28 的真实条目，
   或删除该文件以免与 PROGRESS.md 重复。

6. **更新陈旧日期与进度。**这批文档标注「最后更新 2026-08-24」，且把阶段 3、阶段 4
   记为未开始。实际阶段 3 配置 UI 与阶段 4 热重载均已实现并有浏览器 E2E 与
   41/41 单测证据。`STATUS.md` 与 `MASTER_PLAN.md` 已反映真实状态，
   **以它们为准同步这批文档，不要反向改动它们。**

7. **CI 与子模块的关系必须说明。**`ci.yml` 检出 pinned submodule revision，
   而全部近期改动在 G0 前不在任何 commit 中，故 CI 测到的是不含这些改动的代码。
   G0 完成后需把 workflow 指向 fork 分支或新 revision，否则 CI 结果无意义。
   注意 `upstream/paseo` 自身已有 `.github/workflows/ci.yml`（当前处于修改状态）
   与 `scripts/ci-workflow.test.mjs`，以及 08-27 新增的 `relay-browser-e2e` job；
   父仓库 workflow 不要与其重复或冲突。

### 验收

```bash
bash -n scripts/release.sh
grep -rn "已发布\|v0\.6\.0-alpha" docs/VERSION_*.md   # 期望无虚构发布记录
for f in generate-release-notes.sh build-all-platforms.sh migrate-config.sh verify-installation.sh; do
  grep -rn "$f" scripts/ .github/ && echo "仍有引用: $f"
done
```

以及：`ci.yml` 中每个 `npm run <x>` 都能在对应 `package.json` 中找到。

### 边界

这是文档与脚本的勘误，不改动任何产品代码行为。不要借此机会调整 provider 逻辑。

## G3 — 产品工作（承接 MASTER_PLAN，不重复其细节）

G0–G2 是基础设施与勘误，完成后回到 `docs/MASTER_PLAN.md` 与 `STATUS.md` 既定优先级。
按当前证据，尚未完成且优先级最高的是移动端实机验收：

1. **Android 实机 provider 表单与生命周期**。`docs/PROGRESS.md` 08-28 条目已备好
   `packages/app/maestro/test-provider-forms-android.sh`，但当时 `adb devices -l` 无设备。
   设备恢复后执行 `PASEO_MAESTRO_SERIAL=<serial> bash packages/app/maestro/test-provider-forms-android.sh`，
   核验截图、logcat 与 `provider-after.json`。
2. **`docs/RELAY_VALIDATION.md` 明确列为未证明的项**：QR 相机与手动输入配对、
   多设备配对、完整聊天投递、Wi-Fi/4G 网络切换、replay overflow 恢复、iOS 配对、
   hosted TLS relay。逐项完成并按既有格式留存 `verification/` 证据。
3. **配置面残留缺口**（PROGRESS.md 08-28 记录）：协议级 `expectedRevision`/CAS
   缺失导致多客户端并发提交可能最后写入覆盖；活跃会话连续性、重复更新压力、
   reload 失败日志审计未做。

`docs/MASTER_PLAN.md` 中阶段 3「0% 🔜」、阶段 4「🔮 未来」等标记已过时，
执行前先按 `STATUS.md` 校正，不要照旧标记重做已完成的工作。

## 通用约束

- **记录规范**：每次开发后按 `docs/PROGRESS.md` 既有格式追加日期、完成事项、
  验证命令、边界与下一步。只有经真实 app-server 或真实 Paseo 客户端验证的项
  才能从「进行中」改为「完成」——这条规则在 `PLAN.md` 中已确立，继续遵守。
- **不要声称未验证的结论**。`FEATURE_MATRIX.md` 的验收原则写明「Paseo 源码里有一个
  case」不等于完成。设备不可用、额度耗尽等阻塞要如实记录为待验，而非标记通过。
- **额度状态**：08-24 记录本机 ChatGPT/Codex 账户 usage limit 于 2026-08-31 08:16 恢复。
  依赖真实模型 turn 的验收（如 rewind 双 turn E2E）需在该时间后复跑。
- **隔离契约**：`scripts/start-harness-workbench.sh` 保持 relay 关闭、`.paseo-dev`、
  loopback `6877`。relay 验收由 `scripts/verify-relay.sh` 用临时 `PASEO_HOME`
  与本地 Wrangler relay 完成，**不要为跑验证而在 `config/paseo.dev.json` 打开 relay**。
- **安全边界**：Codex 始终是 required provider，不可通过配置禁用；审批必须保持
  双向 server request 语义；API key 不进日志、不同步到移动端。详见
  `docs/ARCHITECTURE.md` 的不可破坏约束。

## 执行顺序

```
G0（保全子模块改动，先做仓库外备份）
  └─> G1（父仓库首次提交，确认不含 .paseo-dev 与密钥）
        └─> G2（版本文档与脚本勘误）
              └─> G3（回到 MASTER_PLAN：Android 实机 → relay 未证项 → 配置并发）
```

G0 未完成前不要执行 `scripts/release.sh`、`git submodule update` 或子模块内分支切换。

