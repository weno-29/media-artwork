// リッチメニュー画像(2500x1686)を生成。Departureと同じ黒×淡青×シアンの配色。
// 使い方: node richmenu/make-image.mjs  → richmenu/richmenu.png
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");

const cells = [
  ["書籍", "BOOKS"], ["音楽", "MUSIC"], ["おすすめ", "PICK"],
  ["購入", "BUY"], ["Weno-29について", "ABOUT"], ["お問い合わせ", "CONTACT"],
];
const html = `<html><body style="margin:0;width:2500px;height:1686px;background:#0a0c0f;display:grid;
grid-template-columns:833fr 834fr 833fr;grid-template-rows:1fr 1fr;
font-family:'Noto Sans CJK JP','Noto Sans JP','Hiragino Sans',sans-serif;color:#f2f4f7">
${cells.map(([jp, en], i) => `
<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
border-right:${i % 3 < 2 ? 2 : 0}px solid rgba(242,244,247,.14);border-bottom:${i < 3 ? 2 : 0}px solid rgba(242,244,247,.14);
background:radial-gradient(circle at 50% 40%,rgba(156,196,228,${i % 2 ? .10 : .16}),transparent 70%)">
<div style="font-size:${jp.length > 6 ? 84 : 120}px;font-weight:700;letter-spacing:.08em">${jp}</div>
<div style="margin-top:28px;font-size:52px;letter-spacing:.4em;color:#6fd6d0">${en}</div></div>`).join("")}
</body></html>`;

const out = fileURLToPath(new URL("./richmenu.png", import.meta.url));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 2500, height: 1686 } });
await p.setContent(html);
await p.screenshot({ path: out });
await b.close();
console.log("wrote", out);
