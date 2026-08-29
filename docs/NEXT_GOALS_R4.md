# 后续目标指示 第四轮（交接给 Grok）

编写日期：2026-08-29
适用仓库：`/home/e/workspace/codex-remote-workbench`
前序：R1 G0–G2 完成、R2 H2 完成、R3 J1 完成 / J2 阻塞

## 一、上一轮核实结论（J1 已完成，不需重做）

2026-08-29 实测：

- 父仓库 `origin` = `https://github.com/ewo3344/codex-harness-workbench.git`（public），
  `origin/main` = `71c609b`，与本地一致，工作区干净。
- Paseo fork 上 `refs/heads/codex-harness-workbench` = `84acf5a`，
  **与本地 HEAD 字节一致**，异地备份生效。
- 本地 `upstream/paseo` 检出 `codex-harness-workbench`，追踪
  `fork/codex-harness-workbench`；`main` 已还原为上游 `b5f5832`。
  R3 第 4 步标记的 `git pull` 风险已消除。
- `origin` 仍为 `getpaseo/paseo`，未向其推送。
- `UPSTREAMS.toml` 已加 `fork_repository`，`branch` 去掉 pending 标记，
  `patches/paseo/` 保留为离线冗余。
- 公开前密钥复扫：`5b93ad4..71c609b` 共 7 个文件**全为文档**，无代码；
  唯一 grep 命中为 `NEXT_GOALS_R3.md` 中描述扫描模式的文本自身（假阳性）。

## 二、J2 阻塞的准确定性（不要误诊）

失败为 `INSTALL_FAILED_ABORTED: User rejected permissions`（Maestro driver APK），
`adb install -r -g` 同样被拒。这是**设备侧安装拦截**，非脚本、非环境、非 Maestro 版本问题。

**用户曾推测是「未开 USB 文件传输（MTP）模式」。这个推测不成立**：`adb` 已认出设备
（`10AE6J03LC001JL`）且隔离 daemon 已启动，USB 调试通道是通的；MTP 与 `adb install`
无关。若只切 MTP 再重跑仍会失败。真正要开的是 Vivo 开发者选项里独立的
**「USB 安装」**开关，并关闭**「验证应用」**；部分 Vivo 机型需登录 vivo 账号才允许开启。
安装时手机会弹确认框，需人工点允许（driver APK 装一次即可）。

因此 J2 只能等用户完成设备侧操作。**不要尝试用模拟器、`--check` 静态契约检查、
或改写脚本绕过 driver 安装来「完成」J2。**

## K1 — 配置并发写入覆盖（当前最高价值的无阻塞项，优先做）

### 已定位的具体缺口（含对先前描述的修正）

以下为 2026-08-29 **实测**结论，已用可运行测试验证，不要重新调研：

**成立的部分：**

- `packages/server/src/server/daemon-config-store.ts:627` 的
  `assertExpectedRevision()` 在 `expectedRevision === undefined` 时**直接 return**，
  即 CAS 是 opt-in。
- `packages/protocol/src/messages.ts:1518`、`:2608` 将 `expectedRevision` 定义为
  `.optional()`；`:1532` 为 `.nullable()`。
- wire 路径为 `session.ts:2341`
  `handleSetDaemonConfigRequest` → `store.patch(msg.config, msg.expectedRevision)`。
- **`packages/app/src/` 不在 `expectedRevision` 的调用方列表中**——UI 盲写，
  因此 CAS 在真实客户端路径上从不生效。

**必须修正的部分（先前描述不准确，照旧执行会修错东西）：**

- `PROGRESS.md` 2026-08-28 与本文件初稿称「多客户端提交**整段数组**时最后写入覆盖」。
  **这个机制不成立。**实测 `patch({ providers: ... })` 对 provider map 是
  **按 key 合并**，两个客户端并发**新增**不同 provider（alpha / beta）时互不丢失。
  不要去修一个不存在的「数组整体替换」。
- **真实缺口在 per-provider 对象层**：单个 provider 的对象是**整体替换**的。
  两个客户端各自打开同一 provider 的表单、各改一个字段、都盲写保存时，
  后写入者会把前者的字段改动静默还原。
- CAS 本身**是有效的**：当 `expectedRevision` 被传入且已过期时，
  写入会被 `DaemonConfigRevisionConflictError` 正确拒绝。所以修复方向是
  **让 UI 传 revision**，不是改 store 的比较逻辑。

### 已备好的失败测试（起点，请直接用）

`upstream/paseo/packages/server/src/server/k1-gap-probe.test.ts`（未提交，未跟踪）
含 3 个用例，当前 **1 failed / 2 passed**：

- `concurrent edits to the same provider lose one client's field` — **失败**，
  即缺口证据。实测输出：client A 的 `label: "Alpha renamed by A"` 被 client B
  的盲写还原为 `"Alpha"`，而 B 的 `description` 生效。
- 另两个用例通过，分别记录「CAS 在传入 stale revision 时正确拒绝」与
  「省略 revision 即绕过检查」这两项当前行为。

请把该文件的用例**整理并合入** `daemon-config-store.test.ts`（或另建正式测试文件），
然后删除这个临时探针文件。它是我为定位缺口写的，命名与位置都不适合长期保留。

### 要求

1. 让 UI 的配置写入路径携带 `expectedRevision`：读取时记录 revision，
   提交时回传。`get_daemon_config_response` 已返回 revision（`session.ts:2331`），
   客户端侧接上即可。
2. 处理冲突反馈：`DaemonConfigRevisionConflictError` 需在 UI 侧转为可理解的提示
   （建议：提示配置已被其他客户端修改并刷新后重试），不要静默丢弃用户输入。
3. **保持向后兼容**：`expectedRevision` 在协议层是 optional，旧客户端仍会省略。
   不要把它改为 required 而使旧客户端全部失败——这会破坏移动端与 CLI。
   如需强制，须先确认所有 in-tree 调用方都已携带，并单独记录该决定。
4. 上述 per-provider 失败用例必须转为通过；同时保留「新增不同 provider 互不丢失」
   的用例，防止修复时把合并语义改成整体替换而引入新的丢失。

### 要求

1. 让 UI 的配置写入路径携带 `expectedRevision`：读取时记录 revision，
   提交时回传。重点覆盖 provider 数组这类整段替换的写入。
2. 处理冲突反馈：`DaemonConfigRevisionConflictError` 需在 UI 侧转为可理解的提示
   （建议：提示配置已被其他客户端修改并刷新后重试），不要静默丢弃用户输入。
3. **保持向后兼容**：`expectedRevision` 在协议层是 optional，旧客户端仍会省略。
   不要把它改为 required 而使旧客户端全部失败——这会破坏移动端与 CLI。
   如需强制，须先确认所有 in-tree 调用方都已携带，并单独记录该决定。
4. 加回归测试：两个模拟客户端基于同一初始 revision 先后提交不同的 provider 数组，
   断言后到者被拒而非静默覆盖，且首个写入结果完好。

### 验收

```bash
cd upstream/paseo
npx vitest run packages/server/src/server/daemon-config-store.test.ts \
  packages/server/src/utils/paseo-config-file.test.ts --maxWorkers=1
npm run typecheck --workspace=@getpaseo/app
npm run lint -- <改动到的文件>
```

**已实测基线（2026-08-29）**：上述两个套件当前为
`Test Files 2 passed (2)`、`Tests 49 passed (49)`。修复后不得低于此数，
且合入的 per-provider 并发用例须由失败转为通过——这一对照请写入 PROGRESS，
否则无法证明缺口真实存在。探针文件已确认不影响现有 49 个用例。

### 边界

本项不涉及 Codex required 约束、审批语义或 relay。不要顺手改动 provider 逻辑本身。
仓库已公开，提交前按 R3 第三节做密钥扫描。

## K2 — J2 续跑（诊断已修正：只差安装弹窗被点一次）

### 修正前一轮的诊断

R4 初稿曾建议用户去 Vivo 开发者选项开「USB 安装」、关「验证应用」。
**用户反馈此前 Codex 已能正常在该设备安装应用，只需手动点安装按钮，没有其他项可开。**
因此这些开关应已就绪，那条建议多余，不要再让用户去翻设置。

真实原因：`adb install` / Maestro 推 driver APK 时设备会弹安装确认框，
**上一轮是无人值守运行，没人点，`adb` 等不到确认即报
`INSTALL_FAILED_ABORTED: User rejected permissions`。**

### 环境事实（实测）

- Maestro **2.9.0** 已装在 `~/.maestro/bin/maestro`（来源 `https://get.maestro.mobile.dev`）。
  **它不在本会话 shell 的 PATH 中**——本机 shell 是 fish，安装器写的是 bash/zsh 配置。
  调用请用绝对路径 `~/.maestro/bin/maestro`，或先 `set -x PATH ~/.maestro/bin $PATH`（fish 语法）。
- driver APK 打包在 `~/.maestro/lib/` 的 jar 内，运行时才解出，**无法预先手动 `adb install`**。
- 设备上当前没有 maestro 相关包（`pm list packages` 无命中），driver 确实未装成。

### 执行方式：把「点一次」与「跑测试」拆开

不要直接无人值守跑完整脚本。分两步，可显著降低失败面：

1. **先只触发 driver 安装。**请用户手持设备、解锁、保持亮屏，然后执行一条轻量
   maestro 命令（例如 `~/.maestro/bin/maestro --device 10AE6J03LC001JL hierarchy`）
   使其推送并安装 driver。**在执行前告知用户「现在看手机，出现安装框就点允许/继续安装」。**
   driver 装一次即可，后续不再弹。
2. **确认 driver 已在设备上**再跑正式脚本：
   ```bash
   adb -s 10AE6J03LC001JL shell pm list packages | grep -i maestro   # 期望有命中
   cd upstream/paseo
   PASEO_MAESTRO_SERIAL=10AE6J03LC001JL bash packages/app/maestro/test-provider-forms-android.sh
   ```

核验产物：截图、logcat、`provider-after.json`。脚本会在取消自定义 provider 表单后
查询隔离 daemon 的 `provider ls --json`，断言未写入 provider 且只保留必需的 `codex`。

保持既有隔离契约：随机端口、临时 `PASEO_HOME`、退出时清理 `adb reverse`。
**不要为跑验证而改 `config/paseo.dev.json` 打开 relay。**

### 边界

本项只覆盖 provider 表单可达性与取消后的持久化状态。不得据此声称
QR/手动配对、多设备、完整聊天投递、Wi-Fi/4G 切换、replay overflow 恢复、iOS、
hosted TLS relay 已完成——这些在 `docs/RELAY_VALIDATION.md` 已列为未证明项。

若 driver 安装框根本没弹出（而非弹出未点），才回头查设备安装策略；
在此之前不要让用户去改设置。若设备中途掉线或再次拒绝，如实记为待验并停在这里，
**不要改写脚本绕过 driver 安装，也不要用模拟器或 `--check` 冒充真机结论。**


## K3 — 其余无阻塞项（K1 完成后按序）

均不需要设备、不需要模型额度：

1. **Desktop relay-terminal reconnect**：`IMPLEMENTATION_SUMMARY.md:49-50` 记录
   该 case 仍有 renderer 生命周期失败日志，未达完成标准。定位并修复，
   或如实降级为已知缺陷并记录复现步骤。
2. **reload 失败日志审计**：`PROGRESS.md` 2026-08-28 条目列为未完成。
   reload 失败已能原子回滚（41/41 通过），但失败路径的日志可审计性未验证。
3. **活跃会话连续性与重复更新压力**：同上条目所列，与 K1 相邻但独立——
   K1 解决的是并发覆盖，这两项是长时重复更新下的稳定性。

## K4 — 需等额度恢复

`PROGRESS.md` 记录本机 ChatGPT/Codex 账户 usage limit 于 **2026-08-31 08:16** 恢复。
今天是 08-29，**未到**。届时复跑依赖真实模型 turn 的验收，含 rewind 成功双 turn E2E
（`codex-rewind.real.e2e.test.ts`）。在此之前不要因额度报错而判定实现失败。

## 通用约束

- **记录规范**：每次开发后按 `docs/PROGRESS.md` 既有格式追加日期、完成事项、
  验证命令、边界与下一步。只有经真实 app-server 或真实 Paseo 客户端验证的项
  才能标为完成。
- **不要声称未验证的结论**。设备不可用、额度未恢复等阻塞如实记为待验。
- **仓库已公开**：任何新提交前按 R3 第三节做密钥扫描（高危文件名 + 真实 key 前缀）。
- **安全边界**：Codex 始终是 required provider；审批保持双向 server request 语义；
  API key 不进日志、不同步移动端。详见 `docs/ARCHITECTURE.md`。
- **子模块推送去向**：只推 `fork`，绝不推 `origin`（`getpaseo/paseo`）。
  父仓库提交后记得更新 gitlink 并推 `origin`（已是用户自己的 public 仓库）。
- 用户希望尽量由 AI 执行；除设备侧物理操作与浏览器授权外不要抛回用户。

## 执行顺序

```
K1（配置并发覆盖，无阻塞，立即做）
K2（J2 续跑）—— 等用户在手机上开「USB 安装」
K3（Desktop reconnect / reload 日志审计 / 会话连续性）
K4（额度 08-31 08:16 后）
```

K1 与 K2 无依赖关系。用户完成设备操作前先做 K1；设备一旦就绪，K2 优先级高于 K3。

