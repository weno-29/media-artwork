# コネクティングドット事務所 LINE公式アカウント

Weno-29（上野ニッカ）の音楽と書籍の発信用。書籍データから内容紹介を返し、Stripe決済リンクへ誘導する。

## 導線
リッチメニュー → 書籍一覧 → 「内容を見る」 → 紹介文＋「へぇ」ポイント → **購入する（Stripe Payment Link）**

## セットアップ
1. LINE Developers で Messaging API チャネルを開き、チャネルシークレットとアクセストークン（長期）を取得
2. LINE Official Account Manager で **アカウント名を「コネクティングドット事務所」に変更**（コード側では変更不可）。応答設定は「Webhook: オン」「あいさつメッセージ・応答メッセージ: オフ」
3. `cp .env.example .env` に値を入れて `npm install`
4. `npm start` を公開サーバーで起動（Render / Railway / Fly.io 等）し、Webhook URL に `https://<ドメイン>/webhook` を設定
5. リッチメニュー反映: `npm run richmenu:image` → `npm run richmenu:deploy`（旧メニューは自動削除）

## 書籍の追加
```bash
node scripts/import-book.mjs ./原稿.md --id book-1 --title "題名" --price 980 \
  --link https://buy.stripe.com/xxxx --cover https://.../cover.jpg
```
原稿だけを根拠に hook/summary/points を生成し `data/books.json` に **draft** で追加。内容を人が確認し `status` を `published` に変更 → `npm run check` で公開前チェック。

## 注意
- `.env` は絶対にコミットしない（.gitignore済み）。このリポジトリは GitHub Pages で全体公開されるため、`data/` に非公開情報を入れない
- 事実（年代・数字・引用）は生成後に必ず確認する
