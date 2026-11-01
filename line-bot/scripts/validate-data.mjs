// data/*.json の公開前チェック。カテゴリー、必須項目、Payment LinkがStripeのURLか、重複を確認する。
import { readFileSync } from "node:fs";
import { CATEGORIES } from "../src/flex.js";
const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const { books } = read("books.json");
const { tracks } = read("music.json");
const stripe = /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/;
let bad = 0;
const err = (id, m) => { bad++; console.error(`✗ ${id}: ${m}`); };

const ids = new Set();
for (const b of books) {
  if (ids.has(b.id)) err(b.id, "id重複");
  ids.add(b.id);
  if (!CATEGORIES[b.category]) err(b.id, `不明なcategory: ${b.category}`);
  for (const k of ["title", "summary"]) if (!b[k]) err(b.id, `${k}が空`);
  if (b.paymentLink && !stripe.test(b.paymentLink)) err(b.id, "paymentLinkがStripe URLではない");
  if (b.price && b.price < 50) err(b.id, "価格が50円未満（Stripe最低額）");
}
for (const t of tracks) if (t.paymentLink && !stripe.test(t.paymentLink)) err(t.id, "paymentLinkがStripe URLではない");

const linked = books.filter((b) => b.paymentLink).length;
console.log(`書籍${books.length}冊（購入リンクあり${linked} / 準備中${books.length - linked}）, 音楽${tracks.length}件`);
for (const [k, v] of Object.entries(CATEGORIES)) console.log(`  ${v.label}: ${books.filter((b) => b.category === k).length}冊`);
console.log(bad ? `エラー${bad}件` : "OK");
process.exit(bad ? 1 : 0);
