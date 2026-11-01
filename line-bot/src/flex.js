// Flex Message ビルダー（カテゴリー対応）
const INK = "#1b1f2a";
const ACCENT = "#6fd6d0";
const PER_PAGE = 10; // 1カルーセル最大12バブル → 10冊 + 「次へ」

export const CATEGORIES = {
  culture: { label: "教養・歴史" },
  novel: { label: "小説" },
  exam: { label: "資格・試験" },
  lang: { label: "語学" },
  work: { label: "仕事・実用" },
};

const yen = (n) => `¥${Number(n).toLocaleString("ja-JP")}`;
const isHttps = (u) => typeof u === "string" && /^https:\/\//.test(u);
const clip = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");

export const text = (t) => ({ type: "text", text: t });

const buyAction = (item) => ({
  type: "uri",
  label: clip(`購入する ${item.price ? yen(item.price) : ""}`.trim(), 20),
  uri: item.paymentLink,
});

// カテゴリーの書籍一覧（ページ送り付き）
export function categoryCarousel(books, catKey, page = 0) {
  const list = books.filter((b) => b.category === catKey && b.status !== "draft");
  const label = CATEGORIES[catKey]?.label ?? catKey;
  if (!list.length) return text(`「${label}」は準備中です。`);
  const start = page * PER_PAGE;
  const slice = list.slice(start, start + PER_PAGE);
  const bubbles = slice.map((b) => {
    const bubble = {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: clip(b.title, 60), weight: "bold", size: "sm", wrap: true },
          { type: "text", text: clip(b.hook, 80), size: "xs", color: "#666666", wrap: true, margin: "md" },
          ...(b.price ? [{ type: "text", text: yen(b.price), size: "sm", weight: "bold", margin: "md" }] : []),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "button", style: "primary", color: INK, action: { type: "postback", label: "内容を見る", data: `action=book&id=${b.id}` } },
        ],
      },
    };
    if (isHttps(b.cover)) bubble.hero = { type: "image", url: b.cover, size: "full", aspectRatio: "2:3", aspectMode: "cover" };
    return bubble;
  });
  if (start + PER_PAGE < list.length) {
    bubbles.push({
      type: "bubble",
      size: "kilo",
      body: {
        type: "box", layout: "vertical", justifyContent: "center", height: "160px",
        contents: [{ type: "text", text: `${label}\n${start + PER_PAGE + 1}〜 / 全${list.length}冊`, wrap: true, align: "center", size: "sm" }],
      },
      footer: {
        type: "box", layout: "vertical",
        contents: [{ type: "button", style: "primary", color: INK, action: { type: "postback", label: "次の10冊", data: `action=cat&c=${catKey}&p=${page + 1}` } }],
      },
    });
  }
  return {
    type: "flex",
    altText: `${label}の書籍一覧（${start + 1}〜${start + slice.length} / 全${list.length}冊）`,
    contents: { type: "carousel", contents: bubbles },
  };
}

// 書籍詳細（内容紹介→購入導線）
export function bookDetail(b) {
  const footer = [];
  if (isHttps(b.paymentLink)) {
    footer.push({ type: "button", style: "primary", color: INK, action: buyAction(b) });
  } else {
    footer.push({ type: "text", text: "購入リンクは準備中です", size: "xs", color: "#888888", align: "center" });
  }
  if (isHttps(b.sampleUrl)) footer.push({ type: "button", style: "secondary", action: { type: "uri", label: "試し読み", uri: b.sampleUrl } });
  if (isHttps(b.kindleUrl)) footer.push({ type: "button", style: "link", action: { type: "uri", label: "Kindleで見る", uri: b.kindleUrl } });
  footer.push({
    type: "button", style: "link",
    action: { type: "postback", label: `${CATEGORIES[b.category]?.label ?? "書籍"}の一覧へ`, data: `action=cat&c=${b.category}&p=0` },
  });

  const bubble = {
    type: "bubble",
    body: {
      type: "box", layout: "vertical", spacing: "md",
      contents: [
        { type: "text", text: b.title, weight: "bold", size: "lg", wrap: true },
        { type: "separator" },
        { type: "text", text: b.summary || "", size: "sm", wrap: true },
        ...((b.points || []).length
          ? [
              { type: "text", text: "この本の「へぇ」", size: "xs", color: ACCENT, weight: "bold", margin: "md" },
              ...b.points.map((p) => ({ type: "text", text: `・${p}`, size: "sm", wrap: true })),
            ]
          : []),
        ...(b.price ? [{ type: "text", text: yen(b.price), weight: "bold", margin: "md" }] : []),
      ],
    },
    footer: { type: "box", layout: "vertical", spacing: "sm", contents: footer },
  };
  if (isHttps(b.cover)) bubble.hero = { type: "image", url: b.cover, size: "full", aspectRatio: "20:13", aspectMode: "cover" };
  return { type: "flex", altText: `${b.title} の内容紹介`, contents: bubble };
}

export function musicList(tracks) {
  if (!tracks.length) return text("音楽は準備中です。");
  return {
    type: "flex",
    altText: "Weno-29 の音楽",
    contents: {
      type: "carousel",
      contents: tracks.slice(0, 12).map((t) => {
        const link = isHttps(t.paymentLink) ? { label: clip(`購入する ${yen(t.price)}`, 20), uri: t.paymentLink } : isHttps(t.url) ? { label: "聴く・観る", uri: t.url } : null;
        return {
          type: "bubble",
          size: "kilo",
          ...(isHttps(t.cover) ? { hero: { type: "image", url: t.cover, size: "full", aspectRatio: "20:13", aspectMode: "cover" } } : {}),
          body: {
            type: "box", layout: "vertical", spacing: "sm",
            contents: [
              { type: "text", text: t.title, weight: "bold", wrap: true },
              { type: "text", text: clip(t.description, 110), size: "xs", color: "#666666", wrap: true },
            ],
          },
          footer: {
            type: "box", layout: "vertical",
            contents: link
              ? [{ type: "button", style: "primary", color: INK, action: { type: "uri", ...link } }]
              : [{ type: "text", text: "準備中", size: "xs", color: "#888888", align: "center" }],
          },
        };
      }),
    },
  };
}

export const about = () =>
  text(
    "コネクティングドット事務所は、Weno-29（上野ニッカ）の音楽と書籍を発信する活動拠点です。\n\n" +
      "テンポよく読める教養本・小説・資格対策書と、ピアノやノイズ、アンビエントの音楽をお届けします。\n\n" +
      "著者：上野ニッカ\n出版：Connecting Dots Publishing"
  );

export const contact = () => text("お問い合わせはこのトークにそのままメッセージをお送りください。内容を確認して返信します。");

export const quickReplies = {
  items: Object.entries(CATEGORIES)
    .map(([k, v]) => ({ type: "action", action: { type: "postback", label: v.label, data: `action=cat&c=${k}&p=0` } }))
    .concat([{ type: "action", action: { type: "postback", label: "音楽", data: "action=music" } }]),
};
