import express from "express";
import { readFileSync } from "node:fs";
import { messagingApi, middleware, SignatureValidationFailed } from "@line/bot-sdk";
import * as F from "./flex.js";

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

const KEYWORDS = [
  [/音楽|曲|アルバム|music|departure/i, () => F.musicList(tracks())],
  [/小説|物語/, () => F.categoryCarousel(books(), "novel")],
  [/資格|試験|検定|過去問/, () => F.categoryCarousel(books(), "exam")],
  [/語学|英語|外国語/, () => F.categoryCarousel(books(), "lang")],
  [/仕事|実用|notion|excel|ai/i, () => F.categoryCarousel(books(), "work")],
  [/教養|歴史|書籍|本|kindle|おすすめ/i, () => F.categoryCarousel(books(), "culture")],
  [/weno|ウェノ|について|事務所/i, () => F.about()],
];

async function handle(event) {
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
        return reply(b ? F.bookDetail(b) : F.text("その書籍は見つかりませんでした。"));
      }
      case "music": return reply(F.musicList(tracks()));
      case "about": return reply(F.about());
      case "contact": return reply(F.contact());
      default: return null;
    }
  }

  if (event.type === "message" && event.message.type === "text") {
    const t = event.message.text.trim();
    const hit = books().find((b) => b.status !== "draft" && t.length >= 3 && b.title.includes(t)) ||
      books().find((b) => b.status !== "draft" && t.includes(b.title.split(/[\s　｜|—]/)[0]) && b.title.split(/[\s　｜|—]/)[0].length >= 3);
    if (hit) return reply(F.bookDetail(hit));
    for (const [re, fn] of KEYWORDS) if (re.test(t)) return reply(fn());
    if (ADMIN_USER_ID && event.source?.userId) {
      await client.pushMessage({ to: ADMIN_USER_ID, messages: [F.text(`【問い合わせ】\n${t.slice(0, 1500)}\n(from ${event.source.userId})`)] });
    }
    return reply(F.text("メッセージありがとうございます。内容を確認して返信します。\n書籍・音楽は下のボタンからどうぞ。"));
  }
  return null;
}

const app = express();
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
