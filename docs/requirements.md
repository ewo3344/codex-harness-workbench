# 需求定義

最終更新：2026-08-30

本文件は `docs/MASTER_PLAN.md` と `STATUS.md` を要件視点で整理したもの。
実装方法は `design.md`、作業状態は `tasks.md` を参照。

## R1 — Codex を既定の agent runtime とする

- R1.1 公式 `codex app-server`（v2 双方向 JSON-RPC）を Codex provider の
  唯一の agent runtime とする。Codex core を fork・複製・再実装しない。
  これは「製品が Codex だけを発行する」ことではない。
- R1.2 `codex` は **required / 既定の provider**。設定で無効化・削除できない。
  永続設定に `codex.enabled=false` があっても Codex は利用可能であること。
  Paseo が実装済みの他 builtin（少なくとも `claude` / `copilot` / `opencode` /
  `pi`）は発行され、利用できる。OMP plugin/runtime は導入しない。
- R1.3 承認（command/file approval）は双方向 server request のまま扱う。
  元の request id を保持し、通常のログや notification に降格しない。
- R1.4 Codex binary は app-server プロトコル最低バージョン（0.149.0）を検査する。
  明示的な command override は権威として尊重する。

## R2 — カスタム API provider（ユーザー要望）

背景：新しい Codex は API 設定を直接サポートしないため、第三者・ローカルモデルを
利用する経路が必要。

- R2.1 次の 3 方式を設定で追加できること。
  - `extends: "codex"` — OpenAI Responses API 互換エンドポイント
  - `extends: "claude"` — Anthropic 互換エンドポイント
  - `extends: "acp"` — Agent Client Protocol 準拠エージェント
- R2.2 カスタム provider は `enabled: true` を明示した場合のみ発行される（opt-in）。
- R2.3 標準プロトコルのみ対象。非標準エンドポイントの検証はユーザー責任とする。
- R2.4 API key はローカル設定に保持し、モバイル側へ同期しない。
- R2.5 設定 UI から作成・編集・有効化・無効化・削除ができ、daemon 再起動を要さない。
- R2.6 旧クライアント互換性を壊さないこと（後述 R4.2 参照）。

## R3 — モバイル遠隔体験（ユーザー要望）

- R3.1 E2EE relay 経由で Android / iOS がペアリングできること。
- R3.2 回線切断後に自動再接続し、会話状態を失わないこと。
  replay buffer 溢れ時は `reset_required` を返し、無音の欠落を起こさない。
- R3.3 承認要求（コマンド・ファイル・ユーザー入力）をモバイル UI で操作できること。
- R3.4 provider 一覧がモバイルへ同期されること（資格情報は除く、R2.4）。
- R3.5 バックグラウンドターミナルの出力を閲覧できること。

## R4 — 設定の同時更新安全性

- R4.1 複数クライアントが同一 provider を同時編集した際、後着の書き込みが
  先着の変更を無言で破棄しないこと。
- R4.2 `expectedRevision` はプロトコル上 optional を維持する。
  required 化して旧クライアント・CLI・モバイルを一括で失敗させてはならない。
- R4.3 競合時はユーザーに理解可能な形で提示し、入力内容を破棄しないこと。
- R4.4 reload 失敗時は永続設定と live owner を単一トランザクションとして巻き戻すこと。

## R5 — 検証と記録の基準

- R5.1 「上流ソースに該当箇所がある」ことは完了の証明にならない。
  実プロセス・実プロトコル・実クライアントのいずれかによる証拠を要する。
- R5.2 実機検証は実機で行う。エミュレータ結果で代替する場合は **非実機** と明示する。
  静的契約チェック（`--check`）を実機通過として扱わない。
- R5.3 デバイス不在・API 額度切れ等の阻害要因は「待検証」として正直に記録する。
- R5.4 各作業後 `docs/PROGRESS.md` に日付・完了項目・検証コマンド・境界・次手を追記する。

## R6 — リポジトリと公開

- R6.1 `upstream/paseo` への改変は失われない形で保全する
  （fork ブランチ、加えて `patches/` によるオフライン冗長）。
- R6.2 上流 `getpaseo/paseo` へ push しない。
- R6.3 親リポジトリは public。公開前に毎回、資格情報の走査を行う。
- R6.4 ライセンス境界を維持する（Codex: Apache-2.0 / OMP: MIT / Paseo: AGPL-3.0）。
