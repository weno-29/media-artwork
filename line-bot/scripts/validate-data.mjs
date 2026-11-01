// books.json の公開前チェック。Payment Link が Stripe のURLか、必須項目があるかを確認する。
import { readFileSync } from "node:fs";
const { books } = JSON.parse(readFileSync(new URL("../data/books.json", import.meta.url), "utf8"));
let bad = 0;
for (const b of books.filter((x) => x.status !== "draft")) {
  const errs = [];
  for (const k of ["id", "title", "summary"]) if (!b[k]) errs.push(`${k} が空`);
  if (b.paymentLink && !/^https:\/\/(buy|donate)\.stripe\.com\//.test(b.paymentLink)) errs.push("paymentLink が Stripe の URL ではない");
  if (!b.paymentLink && !b.kindleUrl) errs.push("購入導線(paymentLink/kindleUrl)がない");
  if (errs.length) { bad++; console.error(`✗ ${b.id}: ${errs.join(", ")}`); } else console.log(`✓ ${b.id}`);
}
console.log(`${books.length}冊中 公開${books.filter((x) => x.status !== "draft").length}冊 / エラー${bad}`);
process.exit(bad ? 1 : 0);
