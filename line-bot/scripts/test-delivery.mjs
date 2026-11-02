// 受け渡しの試験: 署名・期限・改ざん・Stripe署名・実サーバーでのダウンロード
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import * as D from "../src/delivery.js";
import { readFileSync } from "node:fs";

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "✓" : "✗"} ${m}`); if (!c) fail++; };
const now = Date.now();

// 1. トークン
const t = D.signToken({ item: "book-160775369", uid: "U" + "a".repeat(32), sid: "cs_test_1" }, now);
ok(D.verifyToken(t, now).ok, "有効なトークンは通る");
ok(D.verifyToken(t, now + (D.TTL_HOURS * 3600e3 - 1000)).ok, `期限(${D.TTL_HOURS}h)の直前は通る`);
ok(D.verifyToken(t, now + D.TTL_HOURS * 3600e3 + 1000).reason === "expired", "期限後は expired");
ok(D.verifyToken(t.slice(0, -2) + "xx", now).reason === "invalid", "署名の改ざんは invalid");
const [pl, sg] = t.split(".");
const forged = Buffer.from(JSON.stringify({ i: "book-160775369", u: "x", s: "y", e: now + 9e12 })).toString("base64url");
ok(D.verifyToken(forged + "." + sg, now).reason === "invalid", "期限を書き換えた偽トークンは invalid");
ok(D.verifyToken("", now).reason === "invalid" && D.verifyToken("a.b", now).reason === "invalid", "空・不正形式は invalid");

// 2. 回数制限
D.useDownload("tok"); D.useDownload("tok"); D.useDownload("tok");
ok(D.useDownload("tok") === false, `${D.MAX_DOWNLOADS}回を超えると拒否`);

// 3. Stripe署名
const secret = "whsec_test_secret", body = '{"id":"evt_1"}';
const sign = (ts, b = body, s = secret) => `t=${ts},v1=${crypto.createHmac("sha256", s).update(`${ts}.${b}`).digest("hex")}`;
const ts = Math.floor(now / 1000);
ok(D.verifyStripe(body, sign(ts), secret, { now }), "正しいStripe署名は通る");
ok(!D.verifyStripe(body + " ", sign(ts), secret, { now }), "本文の改ざんは拒否");
ok(!D.verifyStripe(body, sign(ts, body, "whsec_other"), secret, { now }), "別の鍵の署名は拒否");
ok(!D.verifyStripe(body, sign(ts - 3600), secret, { now }), "古い署名（再送攻撃）は拒否");
ok(!D.verifyStripe(body, "", secret, { now }) && !D.verifyStripe(body, sign(ts), "", { now }), "署名なし・鍵なしは拒否");

// 4. 対応表
const plinks = JSON.parse(readFileSync(new URL("../data/plinks.json", import.meta.url)));
const ids = new Set([...JSON.parse(readFileSync(new URL("../data/books.json", import.meta.url))).books, ...JSON.parse(readFileSync(new URL("../data/music.json", import.meta.url))).tracks].map((x) => x.id));
ok(Object.keys(plinks).length === 132 && Object.values(plinks).every((i) => ids.has(i)), "Stripeリンク132本すべてが商品に対応");

// 5. 決済完了イベント（送信はモック）
const sent = [], admin = [];
const io = { push: async (to, m) => sent.push([to, m]), notifyAdmin: async (m) => admin.push(m) };
const plink = Object.entries(plinks).find(([, i]) => i === "book-160775369")[0];
const uid = "U" + "b".repeat(32);
process.env.PUBLIC_BASE_URL = "http://localhost:3199";
const r1 = await D.onCheckoutCompleted({ id: "cs_1", payment_link: plink, payment_status: "paid", client_reference_id: uid }, io);
ok(r1.delivered && sent[0][0] === uid && /\/dl\/[\w-]+\.[\w-]+/.test(sent[0][1]), "購入者にだけダウンロードリンクが送られる");
ok((await D.onCheckoutCompleted({ id: "cs_1", payment_link: plink, payment_status: "paid", client_reference_id: uid }, io)).skipped === "処理済み" && sent.length === 1, "Stripeの再送でも二重に送らない");
ok((await D.onCheckoutCompleted({ id: "cs_2", payment_link: plink, payment_status: "unpaid", client_reference_id: uid }, io)).skipped?.startsWith("payment_status"), "未払いでは送らない");
ok((await D.onCheckoutCompleted({ id: "cs_3", payment_link: "plink_other", payment_status: "paid", client_reference_id: uid }, io)).skipped, "無関係なリンクは無視");
await D.onCheckoutCompleted({ id: "cs_4", payment_link: plink, payment_status: "paid", client_reference_id: null }, io);
ok(admin.length === 1 && sent.length === 1, "LINEユーザーIDがない購入は運営者に通知（購入者へは送らない）");
const other = Object.entries(plinks).find(([, i]) => i === "book-160775305")[0];
await D.onCheckoutCompleted({ id: "cs_5", payment_link: other, payment_status: "paid", client_reference_id: uid }, io);
ok(admin.length === 2 && /ファイルのご用意/.test(sent[1][1]), "ファイル未登録なら、購入者へ『準備中』・運営者へ要対応を通知");

// 6. 実サーバーでダウンロード
const env = { ...process.env, PORT: "3199", STRIPE_WEBHOOK_SECRET: secret };
const srv = spawn("node", ["src/server.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
await new Promise((r) => setTimeout(r, 2500));
const base = "http://localhost:3199";
const link = sent[0][1].match(/http\S+/)[0];
let res = await fetch(link);
const buf = Buffer.from(await res.arrayBuffer());
ok(res.status === 200 && buf.subarray(0, 4).toString() === "%PDF", `有効なリンクでPDFが取得できる（${(buf.length / 1e6).toFixed(1)}MB）`);
ok(/attachment/.test(res.headers.get("content-disposition") || ""), "ファイルとして保存される");
ok((await fetch(link)).status === 200 && (await fetch(link)).status === 200, "2回目・3回目も取得できる");
ok((await fetch(link)).status === 429, "4回目は回数上限で拒否(429)");
ok((await fetch(base + "/dl/" + t.slice(0, -2) + "xx")).status === 404, "改ざんリンクは404");
ok((await fetch(base + "/dl/" + D.signToken({ item: "book-160775369", uid, sid: "x" }, now - 4 * 24 * 3600e3))).status === 410, "期限切れリンクは410");
const wb = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_x", payment_link: "plink_other", payment_status: "paid" } } });
ok((await fetch(base + "/stripe/webhook", { method: "POST", headers: { "content-type": "application/json", "stripe-signature": sign(Math.floor(Date.now() / 1000), wb) }, body: wb })).status === 200, "Webhook: 正しい署名は200");
ok((await fetch(base + "/stripe/webhook", { method: "POST", headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=bad" }, body: wb })).status === 400, "Webhook: 不正な署名は400");
srv.kill();
console.log(fail ? `\n失敗 ${fail}件` : "\nすべて成功");
process.exit(fail ? 1 : 0);
