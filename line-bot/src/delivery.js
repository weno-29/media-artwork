// 購入後の受け渡し: Stripe決済完了 → 期限付きダウンロードリンクを購入者のLINEにだけ送る
import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
export const TTL_HOURS = Number(process.env.DOWNLOAD_TTL_HOURS || 72);
export const MAX_DOWNLOADS = Number(process.env.DOWNLOAD_MAX || 3);

const b64u = (s) => Buffer.from(s).toString("base64url");
const key = () =>
  process.env.DOWNLOAD_SECRET ||
  crypto.createHash("sha256").update("dl:" + (process.env.LINE_CHANNEL_SECRET || "")).digest("hex");
const hmac = (data) => crypto.createHmac("sha256", key()).update(data).digest("base64url");
const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// ---- 署名付きトークン（期限は署名の中に入っているので、サーバーが再起動しても有効）----
export function signToken({ item, uid, sid }, now = Date.now()) {
  const payload = b64u(JSON.stringify({ i: item, u: uid, s: sid, e: now + TTL_HOURS * 3600e3 }));
  return `${payload}.${hmac(payload)}`;
}
export function verifyToken(token, now = Date.now()) {
  const [payload, sig] = String(token).split(".");
  if (!payload || !sig || !safeEq(sig, hmac(payload))) return { ok: false, reason: "invalid" };
  let p;
  try { p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return { ok: false, reason: "invalid" }; }
  if (!p.e || p.e < now) return { ok: false, reason: "expired" };
  return { ok: true, item: p.i, uid: p.u, sid: p.s, id: sig };
}

// ---- Stripeの署名検証（Stripe-Signature: t=...,v1=...）----
export function verifyStripe(rawBody, header, secret, { tolerance = 300, now = Date.now() } = {}) {
  if (!header || !secret) return false;
  const parts = header.split(",").map((s) => s.split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(now / 1000 - Number(t)) > tolerance) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return sigs.some((s) => safeEq(s, expected));
}

// ---- 配信するファイル（購入前は誰にも見えない場所に置く）----
export function fileMap() {
  try { if (process.env.DELIVERY_FILES) return JSON.parse(process.env.DELIVERY_FILES); } catch (e) { console.error("DELIVERY_FILES が不正:", e.message); }
  const p = new URL("../private/delivery-files.json", import.meta.url);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
}

let cached = { token: "", exp: 0 };
async function driveToken() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null; // 未設定なら「リンクを知る全員」のファイルを直接取得（移行期間用）
  if (cached.exp > Date.now() + 60_000) return cached.token;
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64u(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/drive.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${claim}`).sign(sa.private_key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${sig}` }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${j.error_description || j.error}`);
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in - 120) * 1000 };
  return cached.token;
}

export async function openFile(fileId) {
  const token = await driveToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const url = token
    ? `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`
    : `https://drive.google.com/uc?export=download&id=${fileId}`;
  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`Drive fetch ${res.status}`);
  let name = "";
  const cd = res.headers.get("content-disposition") || "";
  const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i);
  if (m) name = decodeURIComponent(m[1]);
  return { body: res.body, type: res.headers.get("content-type") || "application/octet-stream", length: res.headers.get("content-length"), name };
}

// ---- ダウンロード回数（再起動で戻る。期限が本命の制限） ----
const counts = new Map();
export function useDownload(id) {
  const n = (counts.get(id) || 0) + 1;
  if (n > MAX_DOWNLOADS) return false;
  counts.set(id, n);
  return true;
}

// ---- Stripe「決済完了」 → 購入者のLINEへ送る ----
const done = new Set(); // 同じ決済の二重送信を防ぐ（Stripeの再送対策）
export const publicBase = () => (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");

export async function onCheckoutCompleted(session, { push, notifyAdmin }) {
  const item = load("plinks.json")[session.payment_link];
  if (!item) return { skipped: "line-bot以外のリンク" };
  if (session.payment_status !== "paid") return { skipped: `payment_status=${session.payment_status}` };
  if (done.has(session.id)) return { skipped: "処理済み" };
  done.add(session.id);

  const all = [...load("books.json").books, ...load("music.json").tracks];
  const title = all.find((x) => x.id === item)?.title ?? item;
  const uid = session.client_reference_id;

  if (!/^U[0-9a-f]{32}$/.test(uid || "")) {
    await notifyAdmin(`【要対応】LINE経由でない購入です。手動でお渡しください。\n${title}\n決済: ${session.id}`);
    return { skipped: "LINEユーザーIDなし" };
  }
  const fileId = fileMap()[item];
  if (!fileId) {
    await notifyAdmin(`【要対応】配信ファイル未登録のため送れていません。\n${title}\n購入者: ${uid}\n決済: ${session.id}`);
    await push(uid, `ご購入ありがとうございます。\n『${title}』\nファイルのご用意ができ次第、このトークでお送りします。しばらくお待ちください。`);
    return { delivered: false, reason: "no-file" };
  }
  const url = `${publicBase()}/dl/${signToken({ item, uid, sid: session.id })}`;
  await push(uid, `ご購入ありがとうございます。\n『${title}』\n\n▼ダウンロード（${TTL_HOURS}時間・${MAX_DOWNLOADS}回まで）\n${url}\n\n期限を過ぎた場合は、このトークでお知らせください。`);
  return { delivered: true, item, uid };
}
