// 定期便: おすすめの本・音楽を1点ずつ全友だちへ配信する
import { readFileSync } from "node:fs";
import * as F from "./flex.js";

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const isHttps = (u) => typeof u === "string" && /^https:\/\//.test(u);

// 日本語の友だち向け: ハングル・簡体字・英語のみのタイトル（翻訳版）は定期便の対象外
const isJapanese = (t) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(t) && !/[\uac00-\ud7af]/.test(t) && !/[试验预备对库诉从总论态国关还认为这]/.test(t);

// 購入できる商品だけを対象に、カテゴリーを順番に回し、本2点ごとに音楽1点を挟む
export function playlist() {
  const books = load("books.json").books.filter((b) => b.status !== "draft" && isHttps(b.paymentLink) && isJapanese(b.title));
  const music = load("music.json").tracks.filter((t) => isHttps(t.paymentLink));
  const groups = Object.keys(F.CATEGORIES).map((c) => books.filter((b) => b.category === c)).filter((g) => g.length);
  const rr = [];
  for (let i = 0; groups.some((g) => i < g.length); i++) for (const g of groups) if (i < g.length) rr.push({ kind: "book", item: g[i] });
  const out = [];
  let m = 0;
  rr.forEach((x, i) => {
    out.push(x);
    if (i % 2 === 1 && music.length) out.push({ kind: "music", item: music[m++ % music.length] });
  });
  return out;
}

// 日本時間の「通算週」。週が変わるたびに次の1点へ進む
export function weekIndex(now = Date.now()) {
  const jstDays = Math.floor((now + 9 * 3600e3) / 86400e3);
  return Math.floor((jstDays + 3) / 7); // 日曜起点（1970-01-01は木曜）
}

export function pick(week = weekIndex()) {
  const list = playlist();
  return list.length ? list[week % list.length] : null;
}

export function buildMessage(entry) {
  if (entry.kind === "music") {
    const msg = F.musicList([entry.item]);
    msg.altText = `今週のおすすめ（音楽）：${entry.item.title}`;
    return msg;
  }
  const msg = F.bookDetail(entry.item);
  msg.altText = `今週のおすすめ：${entry.item.title}`;
  msg.contents.header = {
    type: "box", layout: "vertical", paddingBottom: "none",
    contents: [{ type: "text", text: "今週のおすすめ", size: "xs", weight: "bold", color: "#6fd6d0" }],
  };
  return msg;
}

const API = "https://api.line.me/v2/bot";
async function line(path, token, init) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers } });
  const body = await res.text();
  if (!res.ok) throw new Error(`LINE ${path} -> ${res.status} ${body}`);
  return body ? JSON.parse(body) : {};
}

// 今月の無料枠を使い切っていれば送らない
async function quotaLeft(token) {
  const [q, c] = await Promise.all([line("/message/quota", token), line("/message/quota/consumption", token)]);
  return q.type === "none" ? Infinity : q.value - c.totalUsage;
}

// opts: { token, week, to: "all" | userId, dryRun }
export async function send({ token, week = weekIndex(), to = "all", dryRun = false }) {
  const entry = pick(week);
  if (!entry) return { sent: false, reason: "配信できる商品（購入リンクあり）がありません" };
  const message = buildMessage(entry);
  const label = `${entry.kind}:${entry.item.id} ${entry.item.title}`;
  if (dryRun) return { sent: false, dryRun: true, label, message };
  if (to === "all") {
    const left = await quotaLeft(token);
    if (left <= 0) return { sent: false, reason: `今月の無料メッセージ枠を使い切っています（残り${left}）`, label };
    await line("/message/broadcast", token, { method: "POST", headers: { "X-Line-Retry-Key": crypto.randomUUID() }, body: JSON.stringify({ messages: [message] }) });
  } else {
    await line("/message/push", token, { method: "POST", headers: { "X-Line-Retry-Key": crypto.randomUUID() }, body: JSON.stringify({ to, messages: [message] }) });
  }
  return { sent: true, to, label };
}

// 毎週日曜 21:00（日本時間）に配信。BROADCAST_ENABLED=true のときだけ起動
export function startScheduler(token) {
  let lastKey = "";
  const tick = async () => {
    const jst = new Date(Date.now() + 9 * 3600e3);
    const key = jst.toISOString().slice(0, 10);
    if (jst.getUTCDay() !== 0 || jst.getUTCHours() !== 21 || jst.getUTCMinutes() >= 5 || lastKey === key) return;
    lastKey = key; // 失敗時も同じ日に再送しない（重複配信を避ける）
    try { console.log("定期便:", JSON.stringify(await send({ token }))); }
    catch (e) { console.error("定期便の送信に失敗:", e.message); }
  };
  setInterval(tick, 30_000);
  console.log("定期便スケジューラ起動: 毎週日曜 21:00 JST");
}
