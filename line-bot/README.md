# コネクティングドット事務所 LINE公式アカウント

Weno-29（上野ニッカ）の音楽と書籍の発信用。カテゴリーから書籍を選び、内容紹介を読んで、Stripe決済リンクで購入する導線。

- チャネルID: `2010816736`
- ベーシックID: `@473egnpc`（友だち追加用）
- 問い合わせの転送先ユーザーID: `U07eff7d5cd4929153a1ec149c0a9a8a0`（`ADMIN_USER_ID`）

## 構成
| 場所 | 役割 |
|---|---|
| `richmenu/` | リッチメニュー（教養・歴史／小説／資格・試験／語学／仕事・実用／音楽／事務所について／お問い合わせ）の定義・画像・反映スクリプト |
| `src/` | Webhookボット（カテゴリー一覧→詳細→購入ボタン、ページ送り、キーワード応答、問い合わせ転送） |
| `data/books.json` | 書籍125冊（category, 紹介文, 価格, `paymentLink`）。`paymentLink` が空の本は「購入リンクは準備中です」と表示 |
| `data/music.json` | 音楽アルバム7点＋Departure |
| `scripts/` | `validate-data`（公開前チェック）、`merge-links`（Payment Link反映）、`import-book`（原稿から紹介文生成） |

## セットアップ（初回のみ）
1. LINE Developers で上記チャネルの **チャネルシークレット** と **チャネルアクセストークン（長期）** を取得（チャットに貼らず、環境変数／ホスティング側のシークレットに設定）
2. アカウントは旧「コネクティングドット音楽事務所」を改名して使用（名前変更は済み）。LINE Official Account Manager の応答設定で Webhook オン／あいさつ・応答メッセージ オフ。対象は旧「コネクティングドット音楽事務所」（改名後）のチャネル
3. `cp .env.example .env` に値を入れ、`npm install`
4. **Renderで公開**（リポジトリ直下の `render.yaml` を使用。無料プラン）
   1. https://render.com にGitHubでログイン → **New → Blueprint** → `weno-29/media-artwork` を選ぶ
   2. 入力欄に `LINE_CHANNEL_SECRET` と `LINE_CHANNEL_ACCESS_TOKEN` を入れて **Apply**
   3. 公開URL（`https://connecting-dots-line-bot.onrender.com` など）を確認し、LINE Developers の Webhook URL に `https://<そのURL>/webhook` を設定して「検証」→ Webhookの利用をオン
   4. 無料プランは15分アクセスがないと停止し、次の最初の返信が遅れる（30〜60秒）。UptimeRobot（無料）で `https://<URL>/healthz` を5分おきに監視すると防げる
5. リッチメニュー反映: `npm run richmenu:image` → `npm run richmenu:deploy`（旧メニューは自動削除。画像はLINEの制限で1MB以下＝JPEG）
   - クラウド環境から実行する場合は `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` を付ける（Node標準fetchはプロキシ設定を読まないため）

## 定期便（週1回）
- 毎週**日曜 21:00（日本時間）**に、購入リンクのある本・音楽を1点ずつ、カテゴリーを順に回して全友だちへ配信（本2点ごとに音楽1点）。日本語タイトルのみが対象（翻訳版は除外）
- 有効化: Render の Environment に `BROADCAST_ENABLED` = `true` を追加（未設定なら配信しない）。UptimeRobotで常時起動しておくこと
- 今月の無料枠（月200通＝友だち数×配信回数）を使い切っていれば自動で送らない
- 確認: `npm run broadcast -- --dry`（内容のみ）／`-- --admin`（運営者だけに送る）／`-- --all`（全員に送る・枠を消費）
- 配信対象は `paymentLink` が入った商品のみ。Payment Linkを増やすと配信候補も増える

## 購入後の受け渡し（期限付きダウンロード）
1. 「購入する」ボタンのURLに、友だちのLINEユーザーIDを付ける（`?client_reference_id=`）。一斉配信など、IDがない場面では「購入する」→ その人専用のボタンを返信
2. Stripeが決済完了を `POST /stripe/webhook` に通知（署名を検証）
3. ボットが、購入者のLINEにだけ、期限付きリンク `/dl/<署名つきトークン>` を送る（既定: **72時間・3回まで**。`DOWNLOAD_TTL_HOURS` / `DOWNLOAD_MAX`）
4. リンクを開くと、サーバーがDriveのファイルを取得して配信（ファイルのURLは購入者に見えない）
- 期限は署名に入っているので、サーバーが再起動しても有効。回数はサーバー内で数えるため、再起動すると戻る（期限が本命の制限）
- ファイルが未登録の本が買われたら、購入者へ「準備でき次第お送りします」、運営者へ【要対応】を通知
- LINE経由でない購入（リンク直アクセス等）は、運営者に通知（自動では送らない）
- 試験: `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/test-delivery.mjs`（27項目）
- **配信ファイルのID対応表は公開しない**: `private/delivery-files.json`（gitignore済み）か、Renderの環境変数 `DELIVERY_FILES`
- 設定（Render）: `STRIPE_WEBHOOK_SECRET`（必須）、`DELIVERY_FILES`、`GOOGLE_SERVICE_ACCOUNT_JSON`（Driveのファイルを「制限付き」にする場合）

## 運用
- Payment Link追加: `links.txt`（`item_id URL` を1行ずつ）を作り `node scripts/merge-links.mjs links.txt` → `npm run check`
- JSONは再起動なしで反映される（リクエストごとに読込）

## 現状と未完了（2026年11月2日時点）
- **ボットは Render で公開済み**: `https://connecting-dots-line-bit.onrender.com`（Webhook: `/webhook`、監視用: `/healthz`）。LINE側のWebhook URLも設定・疎通テスト済み
- **リッチメニューはLINEに反映済み**（`connecting-dots-v2`、8エリア、既定メニュー）
- LINE Developers の「Webhookの利用」トグルはAPIから変更できないため手動でオンにする
- **Stripe本番のPayment Link 132本（書籍125・音楽7）をすべて作成済み**。価格は商品メタデータの `original_price_jpy` どおり。Stripe側と全件照合済み（URL・金額・商品の不一致0、重複0）。リンクのメタデータは `purpose: line-bot-2026-11`
- 紹介文は Stripe の商品説明が元（`summarySource: "stripe-description"`）。原稿から書き起こした「へぇ」ポイントは未作成
- 表紙画像は未設定（`cover` が空。https の公開URLが入れば自動で表示）
- **購入後の受け渡しは実装・試験済み（本番設定待ち）**。配信ファイルを登録した本から自動で届く（登録済み: 7冊 / 125冊）。Stripe Webhookの登録と、Renderの環境変数の設定が必要
- 既存の旧リンク（`purpose: note-membership-2026-11`）は価格0円なので使わない

## 注意
- `.env` はコミットしない（`.gitignore` 済み）。このリポジトリは GitHub Pages で全体が公開されるため、`data/` に非公開情報を入れない
- 事実（年代・数字・引用）は生成後に必ず確認する
