import express from "express";
import { readFileSync } from "node:fs";
import { messagingApi, middleware, SignatureValidationFailed } from "@line/bot-sdk";
import * as F from "./flex.js";
import { startScheduler } from "./broadcast.js";
import * as D from "./delivery.js";
import { Readable } from "node:stream";

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
if (!config.channelAccessToken || !config.channelSecret) {
  console.error("LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET を設定してください");
  process.exit(1);
}
// 未設定でも動く。設定すると、自動応答で拾えない問い合わせをこのユーザーIDへ転送する
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

const client = new messagingApi.MessagingApiClient({ channelAccessToken: config.channelAccessToken });
const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const books = () => load("books.json").books;
const tracks = () => load("music.json").tracks;

const withQuick = (m) => ({ ...m, quickReply: F.quickReplies });

const KEYWORDS = [  // [正規表現, (uid) => 返信]
  [/音楽|曲|アルバム|music|departure/i, (uid) => F.musicList(tracks(), uid)],
  [/小説|物語/, () => F.categoryCarousel(books(), "novel")],
  [/資格|試験|検定|過去問/, () => F.categoryCarousel(books(), "exam")],
  [/語学|英語|外国語/, () => F.categoryCarousel(books(), "lang")],
  [/仕事|実用|notion|excel|ai/i, () => F.categoryCarousel(books(), "work")],
  [/教養|歴史|書籍|本|kindle|おすすめ/i, () => F.categoryCarousel(books(), "culture")],
  [/weno|ウェノ|について|事務所/i, () => F.about()],
];

async function handle(event) {
  const uid = event.source?.userId;
  const reply = (messages) =>
    client.replyMessage({ replyToken: event.replyToken, messages: [].concat(messages).map(withQuick) });

  if (event.type === "follow") {
    return reply([F.text("コネクティングドット事務所へようこそ。\nWeno-29（上野ニッカ）の音楽と書籍をお届けします。\n下のメニューからお選びください。")]);
  }

  if (event.type === "postback") {
    const p = new URLSearchParams(event.postback.data);
    switch (p.get("action")) {
      case "cat": return reply(F.categoryCarousel(books(), p.get("c"), Number(p.get("p") || 0)));
      case "book": {
        const b = books().find((x) => x.id === p.get("id"));
        return reply(b ? F.bookDetail(b, uid) : F.text("その書籍は見つかりませんでした。"));
      }
      case "music": return reply(F.musicList(tracks(), uid));
      case "buy": {
        const it = [...books(), ...tracks()].find((x) => x.id === p.get("id"));
        return reply(F.buyCard(it, uid));
      }
      case "about": return reply(F.about());
      case "contact": return reply(F.contact());
      default: return null;
    }
  }

  if (event.type === "message" && event.message.type === "text") {
    const t = event.message.text.trim();
    const hit = books().find((b) => b.status !== "draft" && t.length >= 3 && b.title.includes(t)) ||
      books().find((b) => b.status !== "draft" && t.includes(b.title.split(/[\s　｜|—]/)[0]) && b.title.split(/[\s　｜|—]/)[0].length >= 3);
    if (hit) return reply(F.bookDetail(hit, uid));
    for (const [re, fn] of KEYWORDS) if (re.test(t)) return reply(fn(uid));
    if (ADMIN_USER_ID && event.source?.userId) {
      await client.pushMessage({ to: ADMIN_USER_ID, messages: [F.text(`【問い合わせ】\n${t.slice(0, 1500)}\n(from ${event.source.userId})`)] });
    }
    return reply(F.text("メッセージありがとうございます。内容を確認して返信します。\n書籍・音楽は下のボタンからどうぞ。"));
  }
  return null;
}

const app = express();

// ---- Stripe: 決済完了 → 購入者のLINEへ期限付きリンクを送る ----
const push = (to, t) => client.pushMessage({ to, messages: [F.text(t)] });
const notifyAdmin = async (t) => { if (ADMIN_USER_ID) await push(ADMIN_USER_ID, t); };
app.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const raw = req.body.toString("utf8");
  if (!D.verifyStripe(raw, req.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET)) return res.sendStatus(400);
  try {
    const event = JSON.parse(raw);
    if (event.type === "checkout.session.completed") console.log("stripe:", JSON.stringify(await D.onCheckoutCompleted(event.data.object, { push, notifyAdmin })));
    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(500); // Stripeが再送する
  }
});

// ---- 期限付きダウンロード ----
app.get("/dl/:token", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const v = D.verifyToken(req.params.token);
  if (!v.ok) return res.status(v.reason === "expired" ? 410 : 404).type("text").send(v.reason === "expired" ? "このリンクは有効期限が切れています。LINEのトークでお知らせください。" : "リンクが正しくありません。");
  if (!D.useDownload(v.id)) return res.status(429).type("text").send(`ダウンロード回数の上限（${D.MAX_DOWNLOADS}回）に達しました。LINEのトークでお知らせください。`);
  const fileId = D.fileMap()[v.item];
  if (!fileId) return res.status(404).type("text").send("ファイルの準備中です。");
  try {
    const f = await D.openFile(fileId);
    res.set("Content-Type", f.type);
    if (f.length) res.set("Content-Length", f.length);
    res.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(f.name || `${v.item}.pdf`)}`);
    Readable.fromWeb(f.body).pipe(res);
  } catch (e) {
    console.error("download error:", e.message);
    res.status(502).type("text").send("ファイルを取得できませんでした。しばらくしてからもう一度お試しください。");
  }
});
app.get("/healthz", (_, res) => res.send("ok"));
app.post("/webhook", middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handle));
    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

// 署名不正は401（それ以外は500）
app.use((err, req, res, next) => {
  if (err instanceof SignatureValidationFailed) return res.sendStatus(401);
  console.error(err);
  res.sendStatus(500);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`listening on ${port}`));
if (process.env.BROADCAST_ENABLED === "true") startScheduler(config.channelAccessToken);
