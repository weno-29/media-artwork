// data/intros.json（原稿から書いた紹介文）を books.json に反映する。
// 使い方: node scripts/merge-intros.mjs
import { readFileSync, writeFileSync } from "node:fs";
const p = (f) => new URL(`../data/${f}`, import.meta.url);
const intros = JSON.parse(readFileSync(p("intros.json"), "utf8"));
const db = JSON.parse(readFileSync(p("books.json"), "utf8"));
let n = 0;
for (const b of db.books) {
  const x = intros[b.id];
  if (!x) continue;
  Object.assign(b, { hook: x.hook, summary: x.summary, points: x.points ?? [], summarySource: "manuscript", driveFileId: x.driveFileId });
  if (x.category) b.category = x.category;
  n++;
}
writeFileSync(p("books.json"), JSON.stringify(db, null, 1) + "\n");
console.log(`${n}冊に反映（原稿ベース: ${db.books.filter((b) => b.summarySource === "manuscript").length} / ${db.books.length}）`);
