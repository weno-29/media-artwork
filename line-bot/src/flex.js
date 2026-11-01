// Flex Message ビルダー
const INK = "#1b1f2a";
const ACCENT = "#6fd6d0";
const yen = (n, cur = "JPY") =>
  cur === "JPY" ? `¥${Number(n).toLocaleString("ja-JP")}` : `${n} ${cur}`;

const isHttps = (u) => typeof u === "string" && /^https:\/\//.test(u);

export const text = (t) => ({ type: "text", text: t });

// 書籍一覧カルーセル。mode: "detail"(内容を見る) | "buy"(購入)
export function bookCarousel(books, mode = "detail") {
  const live = books.filter((b) => b.status !== "draft").slice(0, 12);
  if (!live.length) return text("書籍は準備中です。公開までもう少しお待ちください。");
  return {
    type: "flex",
    altText: "コネクティングドット事務所の書籍一覧",
    contents: {
      type: "carousel",
      contents: live.map((b) => {
        const buyable = isHttps(b.paymentLink);
        const primary =
          mode === "buy" && buyable
            ? { type: "uri", label: "購入する", uri: b.paymentLink }
            : { type: "postback", label: "内容を見る", data: `action=book&id=${b.id}` };
        const bubble = {
          type: "bubble",
          size: "kilo",
          body: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              { type: "text", text: b.title, weight: "bold", size: "md", wrap: true },
              ...(b.subtitle ? [{ type: "text", text: b.subtitle, size: "xs", color: "#888888", wrap: true }] : []),
              { type: "text", text: b.hook || "", size: "sm", wrap: true, margin: "md" },
              ...(b.price ? [{ type: "text", text: yen(b.price, b.currency), size: "sm", weight: "bold", color: INK, margin: "md" }] : []),
            ],
          },
          footer: {
            type: "box",
            layout: "vertical",
            contents: [{ type: "button", style: "primary", color: INK, action: primary }],
          },
        };
        if (isHttps(b.cover)) {
          bubble.hero = { type: "image", url: b.cover, size: "full", aspectRatio: "2:3", aspectMode: "cover" };
        }
        return bubble;
      }),
    },
  };
}

// 書籍詳細（内容紹介→購入導線）
export function bookDetail(b) {
  const buyable = isHttps(b.paymentLink);
  const footer = [];
  if (buyable) {
    footer.push({
      type: "button", style: "primary", color: INK,
      action: { type: "uri", label: `購入する ${b.price ? yen(b.price, b.currency) : ""}`.trim(), uri: b.paymentLink },
    });
  }
  if (isHttps(b.sampleUrl)) {
    footer.push({ type: "button", style: "secondary", action: { type: "uri", label: "試し読み", uri: b.sampleUrl } });
  }
  if (isHttps(b.kindleUrl)) {
    footer.push({ type: "button", style: "link", action: { type: "uri", label: "Kindleで見る", uri: b.kindleUrl } });
  }
  footer.push({ type: "button", style: "link", action: { type: "postback", label: "他の書籍を見る", data: "action=books" } });

  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: b.title, weight: "bold", size: "lg", wrap: true },
        ...(b.subtitle ? [{ type: "text", text: b.subtitle, size: "sm", color: "#888888", wrap: true }] : []),
        { type: "separator" },
        { type: "text", text: b.summary || "", size: "sm", wrap: true },
        ...((b.points || []).length
          ? [
              { type: "text", text: "この本の「へぇ」", size: "xs", color: ACCENT, weight: "bold", margin: "md" },
              ...b.points.map((p) => ({ type: "text", text: `・${p}`, size: "sm", wrap: true })),
            ]
          : []),
      ],
    },
    footer: { type: "box", layout: "vertical", spacing: "sm", contents: footer },
  };
  if (isHttps(b.cover)) {
    bubble.hero = { type: "image", url: b.cover, size: "full", aspectRatio: "20:13", aspectMode: "cover" };
  }
  return { type: "flex", altText: `${b.title} の内容紹介`, contents: bubble };
}

export function musicList(tracks) {
  if (!tracks.length) return text("音楽は準備中です。");
  return {
    type: "flex",
    altText: "Weno-29 の音楽",
    contents: {
      type: "carousel",
      contents: tracks.slice(0, 12).map((t) => ({
        type: "bubble",
        size: "kilo",
        ...(isHttps(t.cover) ? { hero: { type: "image", url: t.cover, size: "full", aspectRatio: "20:13", aspectMode: "cover" } } : {}),
        body: {
          type: "box", layout: "vertical", spacing: "sm",
          contents: [
            { type: "text", text: t.title, weight: "bold", wrap: true },
            { type: "text", text: t.description || "", size: "sm", wrap: true },
          ],
        },
        footer: {
          type: "box", layout: "vertical",
          contents: [{ type: "button", style: "primary", color: INK, action: { type: "uri", label: "聴く・観る", uri: t.url } }],
        },
      })),
    },
  };
}

export const about = () =>
  text(
    "コネクティングドット事務所は、Weno-29（上野ニッカ）の音楽と書籍を発信する活動拠点です。\n\n" +
      "「YouTube Shortsを見るようなテンポで読める教養本」と、空間や光に変わる音楽をお届けします。\n\n" +
      "著者：上野ニッカ\n出版：Connecting Dots Publishing"
  );

export const contact = () =>
  text("お問い合わせはこのトークにそのままメッセージをお送りください。内容を確認して返信します。");

export const quickReplies = {
  items: [
    { type: "action", action: { type: "postback", label: "書籍", data: "action=books" } },
    { type: "action", action: { type: "postback", label: "音楽", data: "action=music" } },
    { type: "action", action: { type: "postback", label: "おすすめ", data: "action=recommend" } },
  ],
};
