# ScanSnap → Discord Notifier (GAS + clasp)

Google Drive の特定フォルダ（例: ScanSnap の保存先）に新規ファイルが追加されたら、Discord のチャンネルへ Webhook 通知する Google Apps Script プロジェクトです。clasp を用いてローカルから管理・デプロイします。

## 特長 / 動作概要

- 新規ファイルのみ通知: 初回にベースラインを現在時刻へ設定し、既存ファイルは通知しません。
- 5 分間隔で監視: 時間主導トリガーを 5 分おきに実行し新規を検出します。
- Discord へ簡潔に投稿: ファイル名、作成時刻（JST）、webViewLink を送信します。
- 冪等性担保: 直近の処理済みファイル ID を最大 200 件まで保持します。

## フォルダ構成

- `src/Code.gs`: 本体スクリプト
- `src/appsscript.json`: マニフェスト（Advanced Drive v3 / OAuth スコープ）
- `.clasp.example.json`: clasp 用サンプル設定（`.clasp.json` は Git で無視）

## 事前準備

1. Discord で任意チャンネルの Webhook URL を作成して控える。
2. 監視対象の Google Drive フォルダ ID を確認する（URL の `folders/<ID>` の部分）。
3. Node.js と `@google/clasp` をインストールしておく。

## clasp 初期設定

1. ログイン
   - `clasp login`
2. `.clasp.json` の用意（このリポジトリでは Git 管理外）
   - PowerShell 例: `Copy-Item .clasp.example.json .clasp.json`
   - `.clasp.json` の `scriptId` を自身のスクリプト ID に置き換える
   - まだスクリプトを持っていない場合は新規作成:
     `clasp create --type standalone --title "ScanSnap Discord Notifier" --rootDir ./src`
3. コードとマニフェストを push
   - `clasp push`
4. スクリプトエディタを開く（確認用）
   - `clasp open`

## GAS 側の設定

1. スクリプト プロパティを設定
   - `FOLDER_ID`: 監視対象のフォルダ ID
   - `DISCORD_WEBHOOK_URL`: Discord の Webhook URL
   - 設定は Apps Script エディタの「プロジェクトの設定」→「スクリプト プロパティ」で追加
2. 初期化を実行
   - エディタの関数選択で `setConfig` を選び「実行」
   - 初回実行でベースライン（現在時刻）を保存し、5 分間隔のトリガーをセットします
3. 動作確認
   - 必要に応じて `manualCheck` を手動実行し、エラーがないか確認

## 仕組み（主要関数）

- `setConfig()`: スクリプト プロパティの検証、ベースライン保存、トリガー登録
- `installTrigger()`: `checkForNewFiles` を 5 分間隔で実行するトリガーを 1 つだけ維持
- `checkForNewFiles()`: 前回以降に作成された新規ファイルを Drive v3 で列挙し Discord へ通知
- `manualCheck()`: 上記の手動実行ヘルパー

## 必要な権限 / スコープ

- Drive メタデータ読み取り: `https://www.googleapis.com/auth/drive.metadata.readonly`
- 外部リクエスト（Discord Webhook）: `https://www.googleapis.com/auth/script.external_request`
- スクリプト プロパティ / トリガ: `https://www.googleapis.com/auth/script.scriptapp`

これらは `src/appsscript.json` に定義済みです。Advanced Service として Drive v3 を有効化しています。

## 運用メモ

- 初回 `setConfig()` 実行までは通知されません。
- 通知リンクは `webViewLink` です。対象ファイルの共有権限により閲覧可否が決まります。
- フォルダ名の重複を避け、必ず「フォルダ ID」で監視対象を指定してください。

## トラブルシュート

- Discord に投稿されない: Webhook URL、権限付与、`FOLDER_ID` の設定を再確認。
- 既存ファイルまで通知された: `setConfig()` を再実行して `LAST_CHECK` を現在時刻に更新。
- 通知頻度を上げたい: `installTrigger()` の間隔はコード上で `everyMinutes(5)` を変更可能（実行上限に注意）。
