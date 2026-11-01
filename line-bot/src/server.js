import express from "express";
import { readFileSync } from "node:fs";
import { messagingApi, middleware } from "@line/bot-sdk";
import * as F from "./flex.js";

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
if (!config.channelAccessToken || !config.channelSecret) {
  console.error("LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET を設定してください");
  process.exit(1);
}

const client = new messagingApi.MessagingApiClient({ channelAccessToken: config.channelAccessToken });
const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
// 再起動なしで更新を反映するため毎回読む（小規模JSONなので十分軽い）
const books = () => load("books.json").books;
const tracks = () => load("music.json").tracks;

const withQuick = (m) => ({ ...m, quickReply: F.quickReplies });

function route(key) {
  switch (key) {
    case "books": return F.bookCarousel(books(), "detail");
    case "buy": return F.bookCarousel(books(), "buy");
    case "music": return F.musicList(tracks());
    case "recommend": {
      const pick = books().find((b) => b.status !== "draft");
      return pick ? F.bookDetail(pick) : F.text("おすすめは準備中です。");
    }
    case "about": return F.about();
    case "contact": return F.contact();
    default: return null;
  }
}

const KEYWORDS = [
  [/書籍|本|kindle|電子書籍/i, "books"],
  [/購入|買|決済|stripe/i, "buy"],
  [/音楽|曲|music|departure/i, "music"],
  [/おすすめ|オススメ/, "recommend"],
  [/weno|ウェノ|について|事務所/i, "about"],
];

async function handle(event) {
  const reply = (messages) =>
    client.replyMessage({ replyToken: event.replyToken, messages: [].concat(messages).map(withQuick) });

  if (event.type === "follow") {
    return reply([
      F.text("コネクティングドット事務所へようこそ。\nWeno-29（上野ニッカ）の音楽と書籍をお届けします。"),
      route("books"),
    ]);
  }

  if (event.type === "postback") {
    const p = new URLSearchParams(event.postback.data);
    const action = p.get("action");
    if (action === "book") {
      const b = books().find((x) => x.id === p.get("id"));
      return reply(b ? F.bookDetail(b) : F.text("その書籍は見つかりませんでした。"));
    }
    const r = route(action);
    return r ? reply(r) : null;
  }

  if (event.type === "message" && event.message.type === "text") {
    const t = event.message.text;
    // 書籍タイトル一致 → 詳細
    const hit = books().find((b) => b.status !== "draft" && t.includes(b.title));
    if (hit) return reply(F.bookDetail(hit));
    for (const [re, key] of KEYWORDS) if (re.test(t)) return reply(route(key));
    // 該当なし → 人が読む問い合わせとして扱い、案内のみ返す
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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`listening on ${port}`));
