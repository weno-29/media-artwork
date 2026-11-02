// リッチメニュー画像(2500x1686)を生成。Departureと同じ黒×淡青×シアンの配色。
// 使い方: node richmenu/make-image.mjs  → richmenu/richmenu.jpg
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");

const cells = [
  ["教養・歴史", "CULTURE"], ["小説", "NOVEL"], ["資格・試験", "EXAM"],
  ["語学", "LANGUAGE"], ["仕事・実用", "WORK"], ["音楽", "MUSIC"],
  ["事務所について", "ABOUT"], ["お問い合わせ", "CONTACT"],
];
// 上2段=3列(各562px)、最下段=2列。richmenu.json の bounds と一致させる
const cell = ([jp, en], i) => {
  const wide = i >= 6;
  const col = wide ? i - 6 : i % 3;
  const last = wide ? col === 1 : col === 2;
  return `<div style="grid-column:${wide ? `${col * 3 + 1} / span 3` : `${col * 2 + 1} / span 2`};display:flex;flex-direction:column;align-items:center;justify-content:center;
border-right:${last ? 0 : 2}px solid rgba(242,244,247,.14);border-bottom:${i < 6 ? 2 : 0}px solid rgba(242,244,247,.14);
background:radial-gradient(circle at 50% 50%,rgba(156,196,228,${(i + Math.floor(i / 3)) % 2 ? .08 : .15}),transparent 70%)">
<div style="font-size:${jp.length > 5 ? 96 : 118}px;font-weight:700;letter-spacing:.08em">${jp}</div>
<div style="margin-top:14px;font-size:44px;letter-spacing:.4em;color:#6fd6d0">${en}</div></div>`;
};
const html = `<html><body style="margin:0;width:2500px;height:1686px;background:#0a0c0f;display:grid;
grid-template-columns:repeat(6,1fr);grid-template-rows:1fr 1fr 1fr;
font-family:'Noto Sans CJK JP','Noto Sans JP','Hiragino Sans',sans-serif;color:#f2f4f7">
${cells.map(cell).join("")}
</body></html>`;

const out = fileURLToPath(new URL("./richmenu.jpg", import.meta.url));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 2500, height: 1686 } });
await p.setContent(html);
await p.screenshot({ path: out, type: "jpeg", quality: 90 }); // LINEの制限: 1MB以下
await b.close();
console.log("wrote", out);
