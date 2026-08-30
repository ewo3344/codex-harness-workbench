# 作業状態

最終更新：2026-08-30

完了判定は `requirements.md` R5 に従う。日々の記録は `docs/PROGRESS.md`。
本文件は現時点の状態と残作業のみを示す。

## 完了（実測で確認済み）

- [x] **T1 Rust bridge**（R1.1/R1.3/R1.4）
      並行 JSON-RPC・順不同 response・承認往復・thread ライフサイクル・
      turn start/steer/interrupt・`thread/revert` rewind・有界 replay。
- [x] **T2 Codex-only 境界**（R1.2）
      発行 allowlist と required invariant。`codex.enabled=false` でも Codex 稼働。
- [x] **T3 カスタム provider**（R2.1〜R2.5）
      3 方式に対応。設定 UI で作成・編集・有効化・無効化・削除、daemon 再起動不要。
      実ブラウザで生命周期 E2E 通過。資格情報の漏洩なし。
- [x] **T4 reload 原子性**（R4.4）
      失敗時に owner・メモリ・永続設定を一括巻き戻し。
- [x] **T5 設定同時更新**（R4.1〜R4.3）
      UI が `expectedRevision` を送出。同一 provider の後着書き込みを CAS で拒否し、
      先着のフィールドを保持。異なる key の同時追加は双方残存。
      protocol は optional 維持。store + config-file **52 passed**（基準 49）、hook 3 passed。
- [x] **T6 リポジトリ保全と公開**（R6.1〜R6.3）
      親 public リポジトリと Paseo fork ブランチへ push 済み。gitlink 整合。
      `patches/paseo/` の順次適用を実測（0001 → commit → 0002 check 通過）、
      `SHA256SUMS` 全件一致。上流への push なし。公開前の資格情報走査で検出ゼロ。
- [x] **T7 Android 実機 provider フォーム検証**（R3.3/R5.2）
      k2-run4 `PASEO_MAESTRO_MANUAL=1`、serial `10AE6J03LC001JL`、隔离 daemon
      `127.0.0.1:37535`、`--no-relay`。表单用 adb（非 Maestro）。
      `$HOME/.maestro-2.8.0/k2-run4/provider-after.json` 仅 `codex`。
      harness `SCRIPT_EXIT=0`：`PASS: cancelling the editor left the isolated daemon with Codex only.`
      `--check` / 模拟器 / Waydroid 不算此通过。

## 進行中・阻害あり

### 阻害 A — Maestro の操作系が停止する（T7 完了後も独立して開いている）

Maestro 経由の操作直後に `viewHierarchy` が停止する
（120s ハング、または UNAVAILABLE で接続切断＋黒画面）。
T7 は `PASEO_MAESTRO_MANUAL=1` + adb で通過した。Maestro 操作系は未修復。

解決済みの副問題（再調査不要）：

- driver 導入は `adb install -r`、**`-t` を付けない**。
- `--no-reinstall-driver` で driver は終了後も残存。
- Metro 8081 + `adb reverse` は機能し、DevLauncher に一覧表示される。
- DevLauncher は自動接続しない。`http://localhost:8081` テキスト（clickable=false）
  や未選択の Connect は `Invalid URL host: ""`。`expo-dev-launcher://` は bundle を
  読まない。`exp+voice-mobile://expo-development-client/?url=http://127.0.0.1:8081`
  は bundle を読む（k2-run4 で Metro `Android Bundled`）。
- `add-host-modal` は開く。**機種固有のアプリ不具合ではない。**
- Host と port は別フィールド。Host に `127.0.0.1:PORT` を入れると
  `tcp://[127.0.0.1:PORT]:6767` になる。

否定された仮説（同じ方向へ戻らない）：

- Vivo による driver 強制終了ではない。doze allowlist は無効。
  失敗は「最終受信から 120002ms かつ接続は open」= ハングであり server 死亡ではない。
- アプリ側の不具合ではない。`launchApp` を除いた flow で `assertVisible` は完了し、
  直後の `tap` が 120s ハングした。読み取りは通り、操作系が止まる。
- release build（DevLauncher 回避）では解決しない。driver 層の問題であるため。
- Maestro のバージョン差でも解決しない。2.8.0 では単純な tap/assert は完了するが、
  shipped 経路の `launchApp` は同じく 120s ハング。
- 端末アニメーション設定でも解決しない。Vivo は `adb settings put` を無視し、
  読み戻しは 0 / 0 / 1.25 のまま。開発者オプションでの手動変更のみ有効。

対照として確認済み：adb のみで
「アプリ起動 → Metro 読込 → welcome → 直接接続 → Settings → Providers →
カスタムフォーム → Cancel」まで到達し、T7 の cancel 断言を通した。
同じ操作列で Maestro は `tap` / `launchApp` 後に停止する。

### 阻害 B — 端末がアプリを断続的に無効化する

前景 5 分 poll（2026-08-30T09:09:21+08:00 起、60 样本、约 7s 间隔）全程 `enabled=1`、未翻转。
空闲/后台仍可能翻到 `enabled=3`。不要连打 `pm enable` 制造假通过。
T7 通过时包保持 `enabled=1`。

判明していること：

- バックグラウンド消費の許可では止まらない（ユーザーが許可後も反転）。
- 該当する端末設定は見つかっていない。
- 無効化の瞬間の logcat に痕跡なし（disable / freeze / hibernate 等で該当ゼロ）。
  したがって記録を残さないシステム側の処理と推測される。
- device owner なし、有効な device admin なし。管理アプリ由来ではない。
- `installerPackageName=null`（sideload）。

**注意**：この阻害は先行する診断結果を部分的に無効化しうる。
黒画面の failure screenshot と一部の `UNAVAILABLE` は、Maestro の非互換ではなく
アプリが途中で無効化された結果である可能性がある。阻害 A の切り分けは
アプリが有効な状態を維持できる環境で再確認すること。

副次的な撹乱要因：前景が他アプリに繰り返し奪われる
（VPN、動画アプリ、メッセージアプリ等）。UI 自動化の手段を問わず安定しない。

### 次手

1. 阻害 A：Maestro 操作系は未修復。T7 は adb 半手動で通過済み。置換判断は独立。
2. 阻害 B：前景 5 分は未翻转。空闲/后台の `enabled=3` は残る。連打 `pm enable` しない。
3. 上流へ報告：`DEADLINE_EXCEEDED` かつ接続 open（最終受信から 120002ms）。

## 未着手

- [ ] **T8 relay 未証明項**（R3.1/R3.2）
      QR・手入力ペアリング、複数デバイス、チャット全経路の配送、
      Wi-Fi / モバイル回線の切替、replay 溢れ後の復旧、iOS、ホスト型 TLS relay。
      ローカル relay 基線と Web relay terminal、Android の一部復旧経路は取得済み。
- [ ] **T9 Desktop relay-terminal 再接続**
      2026-08-30 既知の不具合として記録（未完成）。Linux Wayland+Vulkan で
      renderer が `chrome-error` / `ERR_FAILED` になり、host runtime 到達後も
      `new-workspace-launch-menu` が CDP から開かない。再現は PROGRESS
      2026-08-30 K3.1 と shipped `test:e2e:relay-terminal`。reconnect 本体は未証明。
- [ ] **T10 設定面の残件**
      プロトコル級の版数競合（複数クライアントの一括送信）、
      稼働セッションの継続性、長時間の反復更新耐性、reload 失敗ログの監査性。
- [ ] **T11 実モデル turn 依存の検証**
      rewind の成功 2 turn E2E ほか。API 額度の回復（2026-08-31 08:16）を待つ。

## 環境の注意点

- 端末アニメーション比率は 0 / 0 / 1.25 の混在。`adb` からは変更できない。
  後続判断の撹乱要因になるため、開発者オプションで揃えることが望ましい。
- Maestro は 2 系統併存。`~/.maestro`（2.9.0）と `~/.maestro-2.8.0`（2.8.0）。
  前者を上書きしない。
- 相互作用のない一時プロセス（wrangler / workerd / 隔離 daemon）が残留しうる。
  検証前に確認する。
