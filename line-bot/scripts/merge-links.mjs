// Stripeで作成したPayment Linkを books.json / music.json に反映する。
// 使い方: node scripts/merge-links.mjs links.txt   （1行1件: "<item_id> <https://buy.stripe.com/...>"）
// item_id は Stripe商品メタデータの item_id（例: book-160775369 / music-M01）と books.json の id が一致している前提。
import { readFileSync, writeFileSync } from "node:fs";
const [file] = process.argv.slice(2);
if (!file) throw new Error("リンク一覧ファイルを指定してください");
const map = Object.fromEntries(
  readFileSync(file, "utf8").split("\n").map((l) => l.trim().split(/\s+/)).filter((p) => p.length === 2)
    .map(([id, u]) => [id, u.startsWith("http") ? u : `https://buy.stripe.com/${u}`])
);
let n = 0;
for (const [f, key] of [["books.json", "books"], ["music.json", "tracks"]]) {
  const path = new URL(`../data/${f}`, import.meta.url);
  const db = JSON.parse(readFileSync(path, "utf8"));
  for (const x of db[key]) if (map[x.id] && x.paymentLink !== map[x.id]) { x.paymentLink = map[x.id]; n++; }
  writeFileSync(path, JSON.stringify(db, null, 1) + "\n");
}
console.log(`${n}件更新`);
