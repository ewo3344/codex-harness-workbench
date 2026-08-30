# 設計

最終更新：2026-08-30

`requirements.md` の要件に対する実装方針。詳細な背景は `docs/ARCHITECTURE.md`。

## D1 — 全体構成（現行）

```text
Paseo Web / Desktop / Android / iOS
        │ Paseo protocol（LAN 直結 or E2EE relay）
        ▼
Paseo TypeScript daemon ── provider registry
        ├─ claude / copilot / opencode / pi（builtin）
        ├─ codex（required / 既定）──→ codex app-server 0.149.0
        ├─ custom: extends codex   → OpenAI 互換
        ├─ custom: extends claude  → Anthropic 互換
        └─ custom: extends acp     → ACP エージェント
```

Rust `crates/codex-bridge` は同等機能に達するまで並行構築の代替カーネルとして扱い、
稼働経路を強制的に置き換えない（strangler seam）。

## D2 — provider 発行と required Codex（R1.2 / R2.2）

`bootstrap.ts` で発行集合を組む：

- 起点は製品 builtin：`claude` / `codex` / `copilot` / `opencode` / `pi`。
  Codex-only 定数では種まきしない。`omp` は発行しない（OMP plugin/runtime なし）。
- 設定で `enabled: true` のカスタム provider を追加。
- dev 時のみ `mock` を追加。
- `requiredProviderIds` は常に `codex` のみ。

`ProviderSnapshotManager` は最終 registry 構築後に発行集合で絞り、
required provider を `enabled: true` に固定する。よって永続設定・ACP・
hot reload のいずれからも Codex を無効化できない。builtin は「Codex でない」
ことだけを理由に削除しない。

カスタム provider は snapshot 上で `source: "custom"` として区別し、
設定 UI は発行済み builtin と custom を表示する。Codex には無効化・削除
コントロールを出さない。他 builtin は有効化スイッチのみ。

## D3 — 設定の同時更新（R4）

- ストアは `revision` を保持し、`patch(partial, expectedRevision?)` で CAS 判定する。
- `expectedRevision` 省略時は判定を行わない（プロトコル optional のため、R4.2）。
- wire: `set_daemon_config_request` → `store.patch(config, expectedRevision)`。
  `get_daemon_config_response` は revision を返す。
- UI hook は直前に読んだ revision を送信し、`DaemonConfigRevisionConflictError` を
  クライアント側の競合エラーへ変換して「再読込後に再試行」を促す。入力は保持する。
- provider map は key 単位でマージ。異なる provider の同時追加は失われない。
  一方 **単一 provider のオブジェクトは全体置換**であり、ここが競合点。
  同一 provider の同時編集はフィールド単位でマージせず、CAS で後着を拒否する
  （混在状態を作らないため）。
- reload は永続設定と live owner を単一トランザクションとして扱い、失敗時は
  適用済み owner・メモリ設定・永続スナップショットを一括で巻き戻す。

## D4 — モバイルと relay（R3）

- 通常の開発入口 `scripts/start-harness-workbench.sh` は relay 無効・`.paseo-dev`・
  loopback 6877 を維持する。
- relay 検証は `scripts/verify-relay.sh` が専用の一時 `PASEO_HOME`、一時作業ディレクトリ、
  ローカル Wrangler relay、ランダムポートを用いる。
  **検証のために `config/paseo.dev.json` の relay を有効化しない。**
- replay は有界。cursor 失効時は `reset_required` を返し、クライアントに
  thread projection の再取得を要求する。

## D5 — Android 実機ハーネス（R5.2）

`packages/app/maestro/test-provider-forms-android.sh` が担う：

1. 隔離 daemon 起動（一時 `PASEO_HOME`、ランダムポート、`--no-relay`）。
2. `adb reverse` で daemon ポートと Metro 8081 を転送。
3. Maestro driver を `maestro-client.jar` から取り出し `adb install -r` で導入。
   **`-t` を付けない**（Vivo が test APK を拒否するため）。
   `--no-reinstall-driver` で Maestro 終了後も残す。
4. アプリ起動と画面操作。`launchApp` / `stopApp` / `clearState` は使わない
   （`pm clear` が device server を落とすため adb 側で行う）。
5. UI 操作後、隔離 daemon へ `provider ls --json` を発行し、
   「キャンセル後に `codex` のみ」を assert する。

`PASEO_MAESTRO_MANUAL=1` は 1〜2 を行って一時停止し、Maestro を飛ばして
5 の assert のみ実行する。UI 自動化が通らない環境で実機証拠を得るための経路で、
成果は **半手動実機検証** と明示する。

Expo dev build（`sh.paseo.debug`）は DevLauncher を経由する。DevLauncher は
Metro を一覧に出すが自動接続しないため、明示的なタップが必要
（`expo-dev-launcher://` deep link ではバンドルが読み込まれない）。

## D6 — バージョン管理（R6）

- 親リポジトリ：`ewo3344/codex-harness-workbench`（public）。
- `upstream/paseo`：fork `ewo3344/paseo` のブランチ `codex-harness-workbench` を追跡。
  `origin` は上流のまま残し、push しない。`main` は純粋な上流追跡へ戻す。
- `patches/paseo/` に順序付き patch と `SHA256SUMS` を保持（オフライン冗長）。
- `UPSTREAMS.toml` に `upstream_revision` / `revision` / `fork_repository` /
  `branch` / `local_patch` を記録する。
- バージョン識別は git tag と `CHANGELOG.md` が担い、リリース手順は
  マニフェストのバージョン文字列を書き換えない。
