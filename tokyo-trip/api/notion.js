// 東京五人行 · Notion 代理
//
// 瀏覽器不能直接打 Notion API(沒有 CORS,而且 token 不能放前端),
// 所以由這支 serverless function 代收代送。token 只存在 Vercel 的環境變數裡。
//
// 需要的環境變數:
//   NOTION_TOKEN     Notion internal integration 的密鑰(secret_... 或 ntn_...)
//   TRIP_KEY         五個人共用的通行碼,前端會帶在 x-trip-key 標頭
//   NOTION_DB_EXPENSES / NOTION_DB_ITINERARY  (選填,預設值見下方)

const NOTION = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

const DB = {
  expenses: process.env.NOTION_DB_EXPENSES || "bc4321f89f224137845f5e528730f042",
  itinerary: process.env.NOTION_DB_ITINERARY || "3b2d1f3045fc4b2490e93e3238c26b3a",
};

/* ---------- Notion 呼叫 ---------- */
async function notion(path, init) {
  const res = await fetch(NOTION + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + process.env.NOTION_TOKEN,
      "Notion-Version": VERSION,
      "Content-Type": "application/json",
      ...(init && init.headers),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || "Notion 回應 " + res.status);
    err.status = res.status === 401 || res.status === 403 ? 502 : res.status;
    throw err;
  }
  return body;
}

/* ---------- 欄位讀寫 ---------- */
const txt = p => (p && p.rich_text || []).map(t => t.plain_text).join("");
const ttl = p => (p && p.title || []).map(t => t.plain_text).join("");
const sel = p => (p && p.select && p.select.name) || null;
const msel = p => ((p && p.multi_select) || []).map(o => o.name);
const dat = p => (p && p.date && p.date.start) || null;
const richText = v => (v ? [{ type: "text", text: { content: String(v).slice(0, 1900) } }] : []);

function expenseOut(page) {
  const p = page.properties;
  return {
    id: page.id,
    title: ttl(p["項目"]),
    date: dat(p["日期"]),
    category: sel(p["分類"]),
    amount: (p["金額"] && p["金額"].number) || 0,
    currency: sel(p["幣別"]) || "JPY",
    payer: sel(p["付款人"]),
    participants: msel(p["分攤者"]),
    note: txt(p["備註"]),
    createdAt: page.created_time,
  };
}
function expenseIn(b) {
  const props = {
    "項目": { title: richText(b.title || "未命名") },
    "金額": { number: Number(b.amount) || 0 },
    "幣別": { select: { name: b.currency === "TWD" ? "TWD" : "JPY" } },
    "分攤者": { multi_select: (b.participants || []).map(name => ({ name })) },
    "備註": { rich_text: richText(b.note) },
  };
  if (b.date) props["日期"] = { date: { start: b.date } };
  if (b.category) props["分類"] = { select: { name: b.category } };
  if (b.payer) props["付款人"] = { select: { name: b.payer } };
  return props;
}

function stopOut(page) {
  const p = page.properties;
  return {
    id: page.id,
    title: ttl(p["項目"]),
    day: dat(p["日期"]),
    time: txt(p["時間"]),
    place: txt(p["地點"]),
    note: txt(p["備註"]),
    url: (p["連結"] && p["連結"].url) || "",
  };
}
function stopIn(b) {
  const props = {
    "項目": { title: richText(b.title || "未命名") },
    "時間": { rich_text: richText(b.time) },
    "地點": { rich_text: richText(b.place) },
    "備註": { rich_text: richText(b.note) },
  };
  if (b.day) props["日期"] = { date: { start: b.day } };
  if (b.url) props["連結"] = { url: b.url };
  return props;
}

/* ---------- 許願 ----------
   跟行程共用同一個資料庫:沒填「日期」的那一列就是還沒排進去的願望。
   +1 的票數沒有專屬欄位(不想為了這個改 Notion 的結構),
   所以夾在「備註」後面用一個標記存,讀出來的時候拆掉。 */
const VOTE_TAG = /\s*\[\+1:([^\]]*)\]\s*$/;
function splitNote(raw) {
  const m = VOTE_TAG.exec(raw || "");
  if (!m) return { note: (raw || "").trim(), votes: [] };
  return {
    note: raw.slice(0, m.index).trim(),
    votes: m[1].split(",").map(s => s.trim()).filter(Boolean),
  };
}
function joinNote(note, votes) {
  const v = (votes || []).map(s => String(s).replace(/[,\]]/g, "").trim()).filter(Boolean);
  return (note || "").trim() + (v.length ? " [+1:" + v.join(",") + "]" : "");
}

function wishOut(page) {
  const p = page.properties;
  const parts = splitNote(txt(p["備註"]));
  return {
    id: page.id,
    title: ttl(p["項目"]),
    place: txt(p["地點"]),
    note: parts.note,
    votes: parts.votes,
    by: txt(p["時間"]),          /* 許願的人記在沒用到的「時間」欄 */
    createdAt: page.created_time,
  };
}
function wishIn(b) {
  /* 絕對不寫「日期」—— 一寫上去它就變成行程,而排行程是管理員的事 */
  return {
    "項目": { title: richText(b.title || "想去的地方") },
    "地點": { rich_text: richText(b.place) },
    "備註": { rich_text: richText(joinNote(b.note, b.votes)) },
    "時間": { rich_text: richText(b.by) },
  };
}

const SHAPES = {
  expenses: { db: DB.expenses, out: expenseOut, in: expenseIn, sort: [{ property: "日期", direction: "ascending" }] },
  itinerary: { db: DB.itinerary, out: stopOut, in: stopIn, sort: [{ property: "日期", direction: "ascending" }] },
  wishes: {
    db: DB.itinerary, out: wishOut, in: wishIn, open: true,
    filter: { property: "日期", date: { is_empty: true } },   /* 沒排進行程的才算願望 */
    sort: [{ timestamp: "created_time", direction: "ascending" }],
  },
};

/* ---------- 讀出全部(處理分頁) ---------- */
async function listAll(shape) {
  const rows = [];
  let cursor;
  do {
    const page = await notion("/databases/" + shape.db + "/query", {
      method: "POST",
      body: JSON.stringify({ page_size: 100, sorts: shape.sort, filter: shape.filter, start_cursor: cursor }),
    });
    page.results.forEach(r => rows.push(shape.out(r)));
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return rows;
}

/* ---------- 入口 ---------- */
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (!process.env.NOTION_TOKEN) {
    return res.status(500).json({ error: "伺服器還沒設定 NOTION_TOKEN" });
  }

  /* 讀(GET)開放給所有人,寫(POST/DELETE)一定要通行碼。
     TRIP_KEY 沒設的時候一律擋掉寫入 —— 沒設定不等於不設防。 */
  const writing = req.method === "POST" || req.method === "PATCH" || req.method === "DELETE";
  const hasKey = !!process.env.TRIP_KEY;
  const keyOK = hasKey && req.headers["x-trip-key"] === process.env.TRIP_KEY;

  function denyWrite() {
    if (!hasKey) return { status: 503, error: "伺服器還沒設定 TRIP_KEY,目前不開放編輯" };
    if (!keyOK) return { status: 401, error: "通行碼不對" };
    return null;
  }

  const resource = (req.query && req.query.resource) || "";

  /* 管理員登入用:只驗通行碼,不碰 Notion */
  if (resource === "auth") {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "不支援的方法" });
    }
    const no = denyWrite();
    if (no) return res.status(no.status).json({ error: no.error });
    return res.status(200).json({ ok: true });
  }

  const shape = SHAPES[resource];
  if (!shape) return res.status(400).json({ error: "不認識的資料表:" + resource });

  /* 許願是開放的:誰都能許、誰都能 +1(POST/PATCH),
     但刪掉別人的願望還是管理員的事(DELETE),排進行程也是(走 itinerary)。 */
  const openWrite = shape.open && (req.method === "POST" || req.method === "PATCH");
  if (writing && !openWrite) {
    const no = denyWrite();
    if (no) return res.status(no.status).json({ error: no.error });
  }

  try {
    if (req.method === "GET") {
      return res.status(200).json({ rows: await listAll(shape) });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const page = await notion("/pages", {
        method: "POST",
        body: JSON.stringify({ parent: { database_id: shape.db }, properties: shape.in(body) }),
      });
      return res.status(200).json({ row: shape.out(page) });
    }

    /* 改既有的一筆(拖移排序改時間會用到) */
    if (req.method === "PATCH") {
      const id = req.query && req.query.id;
      if (!id) return res.status(400).json({ error: "缺少 id" });
      let body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      /* 沒通行碼的人只能按 +1,不能改掉別人願望的內容 */
      if (shape.open && !keyOK) {
        const now = shape.out(await notion("/pages/" + id));
        body = { title: now.title, place: now.place, note: now.note, by: now.by, votes: body.votes };
      }
      const page = await notion("/pages/" + id, {
        method: "PATCH",
        body: JSON.stringify({ properties: shape.in(body) }),
      });
      return res.status(200).json({ row: shape.out(page) });
    }

    if (req.method === "DELETE") {
      const id = req.query && req.query.id;
      if (!id) return res.status(400).json({ error: "缺少 id" });
      await notion("/pages/" + id, { method: "PATCH", body: JSON.stringify({ archived: true }) });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ error: "不支援的方法" });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || "伺服器錯誤" });
  }
};
