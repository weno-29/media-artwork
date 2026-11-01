# コネクティングドット事務所 LINE公式アカウント

Weno-29（上野ニッカ）の音楽と書籍の発信用。カテゴリーから書籍を選び、内容紹介を読んで、Stripe決済リンクで購入する導線。

- チャネルID: `2012318867`
- 問い合わせの転送先ユーザーID: `Ucffac3d11d1a48b011bf29756420c648`（`ADMIN_USER_ID`）

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
2. LINE Official Account Manager で **アカウント名を「コネクティングドット事務所」に変更**。応答設定: Webhook オン／あいさつ・応答メッセージ オフ
3. `cp .env.example .env` に値を入れ、`npm install`
4. 公開サーバー（Render / Railway / Fly.io 等）で `npm start`。LINE Developers の Webhook URL に `https://<ドメイン>/webhook` を設定して「検証」
5. リッチメニュー反映: `npm run richmenu:image` → `npm run richmenu:deploy`（旧メニューは自動削除）

## 運用
- Payment Link追加: `links.txt`（`item_id URL` を1行ずつ）を作り `node scripts/merge-links.mjs links.txt` → `npm run check`
- JSONは再起動なしで反映される（リクエストごとに読込）

## 現状と未完了（2025年11月時点）
- Stripe本番で作成済みのPayment Linkは132本中**36本**（書籍29・音楽7）。残り96本は未作成で「準備中」表示
- 紹介文は Stripe の商品説明が元（`summarySource: "stripe-description"`）。原稿から書き起こした「へぇ」ポイントは未作成
- 表紙画像は未設定（`cover` が空。https の公開URLが入れば自動で表示）
- **購入後の受け渡し（ダウンロード案内）は未設計**。Payment Link だけでは本は届かない
- 既存の旧リンク（`purpose: note-membership-2026-11`）は価格0円なので使わない

## 注意
- `.env` はコミットしない（`.gitignore` 済み）。このリポジトリは GitHub Pages で全体が公開されるため、`data/` に非公開情報を入れない
- 事実（年代・数字・引用）は生成後に必ず確認する
