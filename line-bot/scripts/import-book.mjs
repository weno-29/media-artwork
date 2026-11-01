// 原稿(.md/.txt)を読み、内容紹介・フック・「へぇ」ポイントを生成して books.json に追加する。
// 使い方: ANTHROPIC_API_KEY=... node scripts/import-book.mjs <原稿> --id <id> --title <題> [--price 980] [--link <Stripe Payment Link>] [--cover <https画像>]
// 生成物は draft で保存される。人が確認し status を "published" にすること。
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { positionals, values: v } = parseArgs({
  allowPositionals: true,
  options: { id: { type: "string" }, title: { type: "string" }, subtitle: { type: "string" },
    price: { type: "string" }, link: { type: "string" }, cover: { type: "string" }, kindle: { type: "string" } },
});
const [file] = positionals;
if (!file || !v.id || !v.title) throw new Error("原稿パス, --id, --title は必須です");

const manuscript = readFileSync(file, "utf8").slice(0, 150_000);
const client = new Anthropic();
const res = await client.messages.create({
  model: "claude-sonnet-5-5",
  max_tokens: 1500,
  system:
    "あなたはKindle書籍の編集者です。与えられた原稿に書かれている内容だけを根拠に、LINEで読む紹介文をJSONで返します。" +
    "原稿にない事実・数字・引用は絶対に作らない。『非常に興味深い』等の中身のない表現は使わない。",
  messages: [{ role: "user", content:
    `次の原稿から、JSONのみを返してください。\n{"hook":"読者を引き込む問い。60字以内","summary":"内容紹介。200〜300字","points":["原稿内の具体的な『へぇ』を3つ。各40字以内"]}\n\n--- 原稿 ---\n${manuscript}` }],
});
const raw = res.content.find((c) => c.type === "text")?.text ?? "";
const gen = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);

const path = new URL("../data/books.json", import.meta.url);
const db = JSON.parse(readFileSync(path, "utf8"));
db.books = db.books.filter((b) => b.id !== v.id && b.id !== "sample-book-1");
db.books.push({
  id: v.id, title: v.title, subtitle: v.subtitle ?? "", price: Number(v.price ?? 0), currency: "JPY",
  cover: v.cover ?? "", ...gen, sampleUrl: "", paymentLink: v.link ?? "", kindleUrl: v.kindle ?? "", status: "draft",
});
writeFileSync(path, JSON.stringify(db, null, 2) + "\n");
console.log(`追加しました(draft): ${v.title}\n確認後、data/books.json の status を "published" に変更してください。`);
