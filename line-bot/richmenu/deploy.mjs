// リッチメニューを作成→画像アップロード→全ユーザーのデフォルトに設定。旧メニューは削除。
// 使い方: LINE_CHANNEL_ACCESS_TOKEN=... node richmenu/deploy.mjs
import { readFileSync } from "node:fs";
import { messagingApi } from "@line/bot-sdk";

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN が未設定です");
const api = new messagingApi.MessagingApiClient({ channelAccessToken: token });
const blob = new messagingApi.MessagingApiBlobClient({ channelAccessToken: token });

const def = JSON.parse(readFileSync(new URL("./richmenu.json", import.meta.url), "utf8"));
const img = readFileSync(new URL("./richmenu.png", import.meta.url));

const { richMenus } = await api.getRichMenuList();
const { richMenuId } = await api.createRichMenu(def);
await blob.setRichMenuImage(richMenuId, new Blob([img], { type: "image/png" }));
await api.setDefaultRichMenu(richMenuId);
for (const m of richMenus) await api.deleteRichMenu(m.richMenuId); // 旧メニュー(旧事務所名)を整理
console.log("new default rich menu:", richMenuId, "/ deleted old:", richMenus.length);
