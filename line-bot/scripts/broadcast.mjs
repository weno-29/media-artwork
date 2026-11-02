// 定期便の確認・手動送信。
//   node scripts/broadcast.mjs --dry [--week N]    送らずに内容だけ表示
//   node scripts/broadcast.mjs --admin             運営者(ADMIN_USER_ID)にだけ送る（見え方の確認用）
//   node scripts/broadcast.mjs --all               全友だちへ送る（配信数を消費する）
import { parseArgs } from "node:util";
import { send, weekIndex, playlist } from "../src/broadcast.js";

const { values: v } = parseArgs({ options: { dry: { type: "boolean" }, admin: { type: "boolean" }, all: { type: "boolean" }, week: { type: "string" } } });
const week = v.week ? Number(v.week) : weekIndex();
const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const list = playlist();
console.log(`配信候補 ${list.length}点 / 今週の番号 ${week}`);

if (v.dry || (!v.admin && !v.all)) {
  const r = await send({ week, dryRun: true });
  console.log(r.label);
  console.log(JSON.stringify(r.message, null, 1).slice(0, 1500));
} else {
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN が未設定です");
  const to = v.all ? "all" : process.env.ADMIN_USER_ID;
  if (!to) throw new Error("ADMIN_USER_ID が未設定です");
  console.log(await send({ token, week, to }));
}
