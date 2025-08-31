ScanSnap → Discord Notifier (GAS + clasp)

概要
- Google Drive の特定フォルダ（例: ScanSnap）に新規ファイルが追加されたら、Discord のチャンネルへ Webhook 通知します。
- Google Apps Script (GAS) と clasp で管理・デプロイします。

フォルダ構成
- `src/Code.gs`: 本体スクリプト
- `src/appsscript.json`: マニフェスト（Advanced Drive v3 / スコープ設定）

事前準備
1) Discord で Webhook URL を取得（チャンネル設定 → 連携サービス → Webhook）
2) 監視対象の Google Drive フォルダ ID を確認（URL の `folders/<ID>` 部分）
3) Node.js + `@google/clasp` を用意

clasp セットアップ手順
1. ログイン
   - `clasp login`
2. 新規スクリプト作成（Standalone）
   - `clasp create --type standalone --title "ScanSnap Discord Notifier" --rootDir ./src`
   - 既存スクリプトに紐付ける場合は `.clasp.json` の `scriptId` を指定
3. Push（マニフェストとコードをアップロード）
   - `clasp push`

GAS 側セットアップ
1. Apps Script エディタを開いて `Code.gs` の `setConfig()` 内の以下2点を置換:
   - `FOLDER_ID`: 監視したいフォルダ ID
   - `DISCORD_WEBHOOK_URL`: 取得した Discord Webhook URL
2. `setConfig()` を1回実行
   - 初期実行時、現在時刻を基準にベースラインを保存（既存ファイルは通知しません）
   - 5分間隔の Time-driven Trigger が自動作成されます
3. テスト
   - 手動で `manualCheck()` を実行してエラーが無いか確認

動作仕様
- 5分毎に `checkForNewFiles()` が実行され、前回チェック時刻以降に作成されたファイルを Drive API(Advanced Service v3)で取得
- 新規ファイルを Discord に1件ずつ投稿（レート制御のため 200ms ウェイト）
- 冪等性向上のため、直近の処理済みファイル ID を最大 200 件まで Script Properties に保持

権限 / スコープ
- Drive メタデータの読み取り: `https://www.googleapis.com/auth/drive.metadata.readonly`
- 外部リクエスト（Discord Webhook）: `https://www.googleapis.com/auth/script.external_request`
- スクリプトプロパティ / トリガ: `https://www.googleapis.com/auth/script.properties`, `https://www.googleapis.com/auth/script.scriptapp`

運用メモ
- 初回 `setConfig()` 実行までは処理されません。
- フォルダ名が同名重複している可能性があるため、必ずフォルダ「ID」で指定してください。
- `webViewLink` で通知します。閲覧には対象ファイルの共有権限が必要です。

トラブルシュート
- Discord に投稿されない: Webhook URL の有効性、Apps Script の権限付与、プロパティ（FOLDER_ID/URL）を確認
- 既存ファイルが通知されてしまう: `LAST_CHECK` を一旦現在時刻に上書き（`setConfig()` を再実行）
- 高頻度で通知したい: `installTrigger()` の間隔を `everyMinutes(1)` に変更（注意: 実行上限）

