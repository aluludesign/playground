// Trippps · Notion 代理
//
// 瀏覽器不能直接打 Notion API(沒有 CORS,而且 token 不能放前端),
// 所以由這支 serverless function 代收代送。token 只存在 Vercel 的環境變數裡。
//
// 需要的環境變數:
//   NOTION_TOKEN     Notion internal integration 的密鑰(secret_... 或 ntn_...)
//   TRIP_KEY         五個人共用的通行碼,前端會帶在 x-trip-key 標頭
//   NOTION_DB_EXPENSES / NOTION_DB_ITINERARY / NOTION_DB_SEATS  (選填,預設值見下方)
//   GEOCODE_KEY      地名查詢退路的金鑰(選填;沒設就只是那條退路不能用,
//                    網站其他部分照常。理由和它擋住什麼,見下面 resource=geocode)

const S = require("./_session.js");

const NOTION = "https://api.notion.com/v1";
const VERSION = "2022-06-28";
const GEOCODE = "https://maps.googleapis.com/maps/api/geocode/json";

const DB = {
  expenses: process.env.NOTION_DB_EXPENSES || "bc4321f89f224137845f5e528730f042",
  itinerary: process.env.NOTION_DB_ITINERARY || "3b2d1f3045fc4b2490e93e3238c26b3a",
  seats: process.env.NOTION_DB_SEATS || "35e32ca036ee4901b1951c9e22dd9f7e",
  /* 多租戶的三張表。**這三張回答的是「你是誰、你在哪一團、你動得了什麼」**,
     上面三張回答的是「這一團有什麼」—— 兩組不要混。 */
  people: process.env.NOTION_DB_PEOPLE || "c38c62febb87434ca29e264cd9fd24b5",
  trips: process.env.NOTION_DB_TRIPS || "9342c88d03c94c35acd6bc35130a541e",
  members: process.env.NOTION_DB_MEMBERS || "12f3ff46521d4af196e4e2cb59cbbdbf",
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

/* ---------- 地名查詢的退路 ---------- */
/* 網站平常用 Nominatim(免費、不用金鑰、對繁體地名夠好)。它的問題是
   **不確定的時候不會說**:同一份格式、同樣的欄位 ——

     淺草寺  → 35.7134,139.7955  淺草寺, 浅草二丁目, 臺東區, 東京都   對
     泡溫泉  → 24.6985,99.6963   温泉镇, 保山市, 云南省, 中国         錯,差三千公里

   沒有信心值、沒有警告,所以前端的 pinFor() 無從判斷第二筆是錯的,
   使用者看到的是一顆很有自信的錯 pin。

   程式偵測不到,但**使用者知道** —— 所以這條退路是使用者按「再查一次」才走的,
   偵測器是人。這一家每筆都帶精度,而且非地名會明確回查無,那正是前一家沒有的。

   金鑰只能待在這裡。前端拿不到,理由跟 NOTION_TOKEN 一樣:
   放前端等於公開。任何時候都只從 process.env 讀,不寫進程式碼、不回給前端、不印出來。 */

/* 精度只分兩級,前端只需要知道「這是不是一個精確的位置」。
   APPROXIMATE 代表它給的是行政區的概略中心(實測:「東京都廳」回「日本東京都」)——
   看起來像個合理的 pin,精度完全不同,所以一定要傳出去。 */
const PRECISION = {
  ROOFTOP: "exact",
  RANGE_INTERPOLATED: "exact",
  GEOMETRIC_CENTER: "exact",
  APPROXIMATE: "area",
};

/* 回傳 { found:false } 或 { found:true, la, lo, precision, label }。
   丟出去的 Error 一律是自己寫的字 —— 上游的 error_message 不轉發,
   那是沒必要的外洩面,而且對使用者也沒意義。 */
async function geocode(q, cc) {
  const url = GEOCODE + "?address=" + encodeURIComponent(q) +
    "&language=zh-TW&components=country:" + cc +
    "&key=" + encodeURIComponent(process.env.GEOCODE_KEY);
  let body;
  try {
    const res = await fetch(url);
    body = await res.json();
  } catch (_) {
    const err = new Error("地名查詢服務連不上");
    err.status = 502;
    throw err;
  }
  const st = body && body.status;
  if (st === "ZERO_RESULTS") return { found: false };
  if (st !== "OK" || !body.results || !body.results[0]) {
    const err = new Error(
      st === "REQUEST_DENIED" ? "地名查詢服務拒絕了這次請求(伺服器的 GEOCODE_KEY 可能沒設好)"
      : st === "OVER_QUERY_LIMIT" ? "地名查詢服務的額度用完了"
      : st === "INVALID_REQUEST" ? "這個字串沒辦法拿去查"
      : "地名查詢服務回了沒辦法處理的結果");
    err.status = st === "INVALID_REQUEST" ? 400 : 502;
    throw err;
  }
  const r = body.results[0];
  const at = r.geometry && r.geometry.location;
  if (!at || typeof at.lat !== "number" || typeof at.lng !== "number") return { found: false };
  return {
    found: true,
    la: at.lat,
    lo: at.lng,
    precision: PRECISION[r.geometry.location_type] || "area",
    label: r.formatted_address || "",
  };
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

/* 座位:一列 = 一個人在一班飛機上的位子。**用航班號當標題,不是用「去程/回程」** ——
   之後開放給別的團用,航班不會只有兩班,而航班號本來就是那一班的名字。
   前端怎麼把航班號對到畫面上的那一段,是前端的事(見 index.html 的 FLIGHTS)。 */
function seatOut(page) {
  const p = page.properties;
  return {
    id: page.id,
    flight: ttl(p["航班"]).toUpperCase().replace(/\s+/g, ""),
    date: dat(p["日期"]),
    passenger: sel(p["旅客"]),
    seat: txt(p["座位"]).toUpperCase(),
  };
}
function seatIn(b) {
  const props = {
    "航班": { title: richText(String(b.flight || "").toUpperCase()) },
    "座位": { rich_text: richText(String(b.seat || "").toUpperCase()) },
  };
  if (b.date) props["日期"] = { date: { start: b.date } };
  if (b.passenger) props["旅客"] = { select: { name: b.passenger } };
  return props;
}

const SHAPES = {
  expenses: { db: DB.expenses, out: expenseOut, in: expenseIn, sort: [{ property: "日期", direction: "ascending" }] },
  itinerary: { db: DB.itinerary, out: stopOut, in: stopIn, sort: [{ property: "日期", direction: "ascending" }] },
  seats: { db: DB.seats, out: seatOut, in: seatIn, sort: [{ property: "航班", direction: "ascending" }] },
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

/* ---------- 這裡曾經有一道窄路,拆掉了 ----------
   `wishAsksForItsOwnPlace(id, q)`:沒有通行碼的人也能打 geocode,條件是
   「查的字串必須就是那筆願望已經存著的地點」。它不驗身分(驗不了),
   改成**限制被問的是什麼**。

   **拆掉的理由不是它壞了,是它的前提消失了。** 它只在「被問的東西是資料庫裡
   已經有的」時候成立,而搜尋的本質是問一個還沒存進去的字 —— 兩者不相容。
   成本改由 Google 金鑰的每日上限擋(見下面 geocode 那一段)。

   `git log -S wishAsksForItsOwnPlace` 找得回完整實作。 */


/* ---------- 團、成員 ----------

   **成員可以是一個還沒有人認領的位子。** 阿輝他們在用 LINE 登入之前就是這樣:
   位子在那裡(名字、顏色、舊代號都有),只是「人」那一欄是空的。
   這不是過渡期的權宜 —— 舊資料裡的「付款人 = Chinhui」要對得回一個人,
   而那個人可能永遠不會登入。**位子和人是兩件事。** */
function tripOut(page) {
  const p = page.properties;
  return {
    code: ttl(p["代號"]),
    name: txt(p["名稱"]) || ttl(p["代號"]),
    start: dat(p["開始日"]),
    end: dat(p["結束日"]),
    rate: (p["匯率"] && p["匯率"].number) || 0,
    kitty: (p["基金"] && p["基金"].number) || 0,
    /* 成員能不能動這三塊,由團主決定。**預設全關** —— 沒設定不等於不設防,
       跟 TRIP_KEY 那條規則是同一條。 */
    can: {
      plan: !!(p["成員可管行程"] && p["成員可管行程"].checkbox),
      cost: !!(p["成員可管分帳"] && p["成員可管分帳"].checkbox),
      seat: !!(p["成員可管機位"] && p["成員可管機位"].checkbox),
    },
  };
}

/* **`line` 只在伺服器裡用,不會出現在回給瀏覽器的東西裡。**
   它是別人的 LINE 使用者編號,前端一個字都不需要。 */
function memberOut(page) {
  const p = page.properties;
  const full = ttl(p["代號"]);
  return {
    page: page.id,
    id: full.indexOf(":") >= 0 ? full.slice(full.indexOf(":") + 1) : full,
    trip: txt(p["團"]),
    name: txt(p["名字"]),
    key: txt(p["舊代號"]),
    color: txt(p["顏色"]) || "#888",
    role: sel(p["角色"]) || "成員",
    line: txt(p["人"]),
    invite: txt(p["邀請碼"]),
  };
}

async function findTrip(code) {
  const page = await notion("/databases/" + DB.trips + "/query", {
    method: "POST",
    body: JSON.stringify({ page_size: 1, filter: { property: "代號", title: { equals: code } } }),
  });
  return page.results.length ? tripOut(page.results[0]) : null;
}

async function membersOf(code) {
  const rows = [];
  let cursor;
  do {
    const page = await notion("/databases/" + DB.members + "/query", {
      method: "POST",
      body: JSON.stringify({ page_size: 100, start_cursor: cursor,
        filter: { property: "團", rich_text: { equals: code } } }),
    });
    page.results.forEach(r => rows.push(memberOut(r)));
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return rows;
}

/* 認領一個位子。**位子有名字,人有 LINE ID,認領就是把兩者接起來。**
   為什麼要有這一步而不是登入時自動配對:LINE 上的顯示名跟團裡叫什麼是兩回事
   (「媽」不會是誰的 LINE 名稱),而**猜錯的代價是把票投在別人頭上**。 */
async function claimSeat(memberId, trip, me) {
  const rows = await membersOf(trip);
  const seat = rows.find(m => m.id === memberId);
  if (!seat) return { status: 404, error: "這一團沒有這個位子" };
  if (seat.line && seat.line !== me.sub) return { status: 409, error: "這個位子已經有人了" };

  /* 一個人在同一團只能占一個位子。**先放掉舊的,再認新的** ——
     反過來的話中途失敗會變成一個人占兩個位子,而分帳會把他算兩次。 */
  const held = rows.find(m => m.line === me.sub && m.id !== memberId);
  if (held) await notion("/pages/" + held.page, { method: "PATCH",
    body: JSON.stringify({ properties: { "人": { rich_text: richText("") } } }) });

  await notion("/pages/" + seat.page, { method: "PATCH",
    body: JSON.stringify({ properties: {
      "人": { rich_text: richText(me.sub) },
      "加入時間": { date: { start: new Date().toISOString().slice(0, 10) } },
    } }) });
  return { status: 200, id: memberId, role: seat.role, released: held ? held.id : null };
}

/* 放掉自己那個位子。**只能放自己的** —— 位子上的 LINE ID 不是我的就不動。 */
async function releaseSeat(trip, me) {
  const rows = await membersOf(trip);
  const held = rows.find(m => m.line === me.sub);
  if (!held) return { status: 200, id: null };
  await notion("/pages/" + held.page, { method: "PATCH",
    body: JSON.stringify({ properties: { "人": { rich_text: richText("") } } }) });
  return { status: 200, id: null, released: held.id };
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

  /* 這一團是什麼、有誰。**讀是公開的**,所以這支不要通行碼也不要登入 ——
     但它回的東西裡**一個 LINE ID 都沒有**:誰認領了哪個位子只回一個真假值。
     名字和顏色本來就會印在畫面上,LINE 的使用者編號不會。 */
  if (resource === "team") {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "不支援的方法" });
    }
    const code = String((req.query && req.query.t) || "tokyo").trim();
    if (!/^[a-z0-9_-]{1,40}$/.test(code)) return res.status(400).json({ error: "團的代號不對" });

    let trip, members;
    try {
      trip = await findTrip(code);
      members = trip ? await membersOf(code) : [];
    } catch (e) {
      /* **「讀不到」和「沒有資料」要分得出來。** integration 沒被加到那一頁的時候,
         Notion 回的是 404 object_not_found —— 而如果這裡安靜地回一張空名單,
         畫面上看起來就只是「這團沒有人」,沒有任何地方會說一句。
         這個專案被這種無聲失敗咬過太多次了。 */
      const lost = e.status === 404 || /object_not_found|Could not find/i.test(e.message || "");
      return res.status(lost ? 503 : (e.status || 500)).json({
        error: lost
          ? "後端讀不到「團/成員」那兩張表 —— 多半是 Notion 那一頁還沒把 integration 加進 Connections"
          : e.message,
      });
    }
    if (!trip) return res.status(404).json({ error: "沒有這一團:" + code });

    const me = S.whoIs(req);
    const mine = me ? members.find(m => m.line && m.line === me.sub) : null;
    return res.status(200).json({
      trip,
      /* line 不出去 —— 只說這個位子有沒有人認領 */
      members: members.map(m => ({
        id: m.id, name: m.name, key: m.key, color: m.color,
        role: m.role, claimed: !!m.line,
      })),
      me: mine ? { id: mine.id, role: mine.role } : null,
    });
  }

  /* 認領／放掉位子。**一定要登入** —— 這支做的事就是「把一個位子綁到一個
     伺服器認得的身分上」,沒有身分就沒有事情可做。 */
  if (resource === "claim") {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "不支援的方法" });
    }
    const me = S.whoIs(req);
    if (!me) return res.status(401).json({ error: "請先用 LINE 登入" });

    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    body = body || {};
    const code = String(body.trip || "tokyo").trim();
    if (!/^[a-z0-9_-]{1,40}$/.test(code)) return res.status(400).json({ error: "團的代號不對" });
    const want = String(body.member || "").trim();
    if (want && !/^[a-z0-9_:-]{1,60}$/.test(want)) return res.status(400).json({ error: "位子的代號不對" });

    try {
      const out = want ? await claimSeat(want, code, me) : await releaseSeat(code, me);
      if (out.error) return res.status(out.status).json({ error: out.error });
      return res.status(200).json({ me: out.id ? { id: out.id, role: out.role } : null });
    } catch (e) {
      const lost = e.status === 404 || /object_not_found|Could not find/i.test(e.message || "");
      return res.status(lost ? 503 : (e.status || 500)).json({
        error: lost ? "後端讀不到「成員」那張表 —— Notion 那一頁的 Connections 還沒加 integration"
                    : e.message,
      });
    }
  }

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

  /* 地名再查一次:使用者說「這個 pin 不對」時才走。不碰 Notion。
     跟寫入同一條規則(要通行碼)—— 這一條每查一次都要錢,付錢的是 Lulu 的信用卡,
     公開的 GET 端點等於把額度開給全世界。前端也只在可編輯時才畫那顆按鈕。 */
  /* ---------- 關鍵字找地點:Places Text Search ----------

     **跟上面那條 `geocode` 不是同一件事,不要合併。**
     Geocoding 的設計目的是「地址 → 座標」,所以它把店名當地址解析 ——
     量過:「一蘭拉麵 新宿」回的是整個新宿區,「藏前 咖啡」回的是台東區藏前。
     **它不是不準,是它回答的是另一個問題。**

     Places Text Search 才是「打關鍵字、回一串有名字有地址的地點」那個,
     而那正是搜尋框要的東西。用的是 Places API (New):
     POST /v1/places:searchText,金鑰走標頭,要回什麼欄位用 FieldMask 指定
     —— **欄位要得越少越便宜**,所以只要名字、地址、座標。 */
  if (resource === "places") {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "不支援的方法" });
    }
    const q = String((req.query && req.query.q) || "").trim();
    if (!q) return res.status(400).json({ error: "沒有要查的字串" });
    if (q.length > 120) return res.status(400).json({ error: "要查的字串太長" });
    if (!process.env.GEOCODE_KEY) {
      return res.status(503).json({ error: "伺服器還沒設定地名查詢的金鑰,強力搜目前不能用" });
    }
    const cc = /^[a-z]{2}$/.test(String((req.query && req.query.cc) || "")) ? req.query.cc : "jp";

    /* **新版試不成就試舊版,而且兩邊的錯誤都留著。**

       Google 有兩個 Places:`places.googleapis.com`(新)和
       `maps.googleapis.com/maps/api/place`(舊)。兩個都開得起來,
       **但金鑰可以個別限制能打哪一個** —— Lulu 兩個都開了,新版仍然回
       「are blocked」,那是金鑰的 API restrictions 沒放行,不是 API 沒開。

       與其要人去 Console 猜是哪一層擋的,這裡兩個都試。
       **失敗的時候把兩邊講的話都帶出去** —— 只留一邊的話,
       下一個人看到的又會是一個不完整的訊號。 */
    const want = "強力搜";
    let newErr = "", oldErr = "";
    try {
      const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GEOCODE_KEY,
          /* `places.photos` 只是**照片的代號**,拿它不另外計費 —— 真正計費的是
             底下 `placephoto` 那一段去換圖的那一下。所以這裡一律要,
             前端要不要顯示、顯示幾張,由前端決定。 */
          "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.photos",
        },
        body: JSON.stringify({
          textQuery: q, languageCode: "zh-TW",
          regionCode: cc.toUpperCase(), maxResultCount: 6,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok) {
        return res.status(200).json({ list: (body.places || []).map(x => ({
          la: x.location && x.location.latitude,
          lo: x.location && x.location.longitude,
          label: (x.displayName && x.displayName.text) || "",
          addr: x.formattedAddress || "",
          /* 新版的照片代號長「places/XXX/photos/YYY」。**只帶第一張** ——
             候選清單一列只放得下一張,多帶的那幾張前端不會用到。 */
          photo: (x.photos && x.photos[0] && x.photos[0].name) || "",
        })).filter(x => typeof x.la === "number" && typeof x.lo === "number" && x.label) });
      }
      newErr = (body && body.error && body.error.message) || ("HTTP " + r.status);
    } catch (e) { newErr = "連不上"; }

    try {
      const u = "https://maps.googleapis.com/maps/api/place/textsearch/json?query=" +
        encodeURIComponent(q) + "&language=zh-TW&region=" + cc +
        "&key=" + encodeURIComponent(process.env.GEOCODE_KEY);
      const r2 = await fetch(u);
      const b2 = await r2.json().catch(() => ({}));
      if (r2.ok && (b2.status === "OK" || b2.status === "ZERO_RESULTS")) {
        return res.status(200).json({ list: (b2.results || []).slice(0, 6).map(x => ({
          la: x.geometry && x.geometry.location && x.geometry.location.lat,
          lo: x.geometry && x.geometry.location && x.geometry.location.lng,
          label: x.name || "",
          addr: x.formatted_address || "",
          /* 舊版給的是 `photo_reference`,跟新版的代號長得完全不一樣。
             **前端不該知道這件事**,所以兩邊都叫 `photo`,由 placephoto 那段去分辨。 */
          photo: (x.photos && x.photos[0] && x.photos[0].photo_reference) || "",
        })).filter(x => typeof x.la === "number" && typeof x.lo === "number" && x.label) });
      }
      oldErr = (b2 && (b2.error_message || b2.status)) || ("HTTP " + r2.status);
    } catch (e) { oldErr = "連不上"; }

    return res.status(502).json({
      error: want + "兩家都沒成:新版說「" + newErr + "」;舊版說「" + oldErr + "」",
    });
  }

  /* ---- 候選清單上那張 Google 照片 ----
     **為什麼一定要經過這裡:圖片網址帶著金鑰。** 直接把網址給前端,等於把
     `GEOCODE_KEY` 印在 HTML 上 —— 那正是 geofix 有一條斷言在守的事。

     **但不把圖片的位元組串過這個函式。** 跟 Google 要「已簽名的短期網址」,
     然後回 302 讓瀏覽器自己去它的 CDN 拿:金鑰不外流,而這個函式不必搬圖。

     **這一段會花錢,而且是跟搜尋分開計費的。** 一次強力搜本來是 1 次,
     清單有六筆就變成 1 + 6。所以照片只掛在強力搜那條路上 ——
     免費那條路一張都不會叫到這裡(它拿到的 `photo` 是空的)。 */
  if (resource === "placephoto") {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "不支援的方法" });
    }
    if (!process.env.GEOCODE_KEY) {
      return res.status(503).json({ error: "伺服器還沒設定地名查詢的金鑰" });
    }
    const ref = String((req.query && req.query.ref) || "");
    /* **白名單,不是黑名單。** 這個參數會被接進一個對外的網址,放任它等於
       開一個任意轉址的洞。新版的代號是 `places/A/photos/B`,舊版是一長串
       token —— 兩種都只有英數和 `-_`,所以形狀不合的一律擋掉,不要猜它想幹嘛。 */
    const isNew = /^places\/[A-Za-z0-9_-]{1,256}\/photos\/[A-Za-z0-9_-]{1,512}$/.test(ref);
    const isOld = /^[A-Za-z0-9_-]{20,1024}$/.test(ref);
    if (!isNew && !isOld) return res.status(400).json({ error: "照片代號的形狀不對" });
    const hRaw = parseInt(String((req.query && req.query.h) || "112"), 10);
    const h = Math.min(400, Math.max(48, isFinite(hRaw) ? hRaw : 112));

    try {
      let to = "";
      if (isNew) {
        /* `skipHttpRedirect=true` 回的是 JSON 裡的 `photoUri`,不是圖片本身。 */
        const r = await fetch("https://places.googleapis.com/v1/" + ref +
          "/media?maxHeightPx=" + h + "&skipHttpRedirect=true", {
          headers: { "X-Goog-Api-Key": process.env.GEOCODE_KEY },
        });
        const b = await r.json().catch(() => ({}));
        to = (b && b.photoUri) || "";
      } else {
        /* 舊版直接回 302,而 `redirect:"manual"` 讓我們讀得到它要轉去哪 ——
           跟著轉過去的話,圖片就真的從這個函式流過去了。 */
        const r = await fetch("https://maps.googleapis.com/maps/api/place/photo?maxheight=" + h +
          "&photo_reference=" + encodeURIComponent(ref) +
          "&key=" + encodeURIComponent(process.env.GEOCODE_KEY), { redirect: "manual" });
        to = r.headers.get("location") || "";
      }
      if (!/^https:\/\//.test(to)) return res.status(502).json({ error: "拿不到那張照片" });
      /* 快取這個轉址 = 少打幾次要錢的那一支。簽名的網址本身有期限,
         所以只放一小時,不要更久。 */
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
      res.setHeader("Location", to);
      return res.status(302).end();
    } catch (e) {
      return res.status(502).json({ error: "拿照片的時候連不上" });
    }
  }

  if (resource === "geocode") {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "不支援的方法" });
    }
    const q = String((req.query && req.query.q) || "").trim();
    if (!q) return res.status(400).json({ error: "沒有要查的字串" });
    if (q.length > 120) return res.status(400).json({ error: "要查的字串太長" });
    /* **這一條不再要通行碼,而那道窄路整個拆掉了。**

       以前是:要嘛有通行碼,要嘛「你查的字必須就是那筆願望已經存著的地點」
       (`wishAsksForItsOwnPlace`)。那道檢查的用意從來不是驗身分(伺服器驗不了),
       是**擋成本** —— 不讓這個要錢的端點被任意字串打。

       **它跟搜尋在根本上不相容。** 那道檢查只在「被問的東西是資料庫裡已經有的」
       時候成立,而**搜尋的本質就是問一個還沒存進去的字**。所以合併之後
       它會把那三個沒有通行碼的人每一次都擋掉 —— 而「免費那家找不到,
       換一家再找」正是這個功能存在的理由,擋掉它等於把功能拿掉。

       **成本改由 Google 那把金鑰自己擋:`v3 requests per day = 500`**
       (Lulu 2026-09-20 設的,在 Google Cloud Console 的 Quotas 裡)。
       那是 Google 強制執行的硬上限,比我們在這裡寫任何程式都可靠 ——
       超過就是 Google 拒絕,不是她的卡被刷。以牌價每千次約 US$5 估,
       最壞情況一天約 US$2.5。

       **剩下的風險是額度被故意用光**(那天大家都搜不了),不是帳單失控。
       要做到得先知道這個沒公開的網址。五個人的行程網站,這個取捨是她拍板的。 */
    if (!process.env.GEOCODE_KEY) {
      return res.status(503).json({ error: "伺服器還沒設定 GEOCODE_KEY,強力搜目前不能用" });
    }
    /* 國家代碼只收兩個字母,不讓查詢字串以外的東西跑進 URL */
    const cc = /^[a-z]{2}$/.test(String((req.query && req.query.cc) || "")) ? req.query.cc : "jp";
    try {
      return res.status(200).json(await geocode(q, cc));
    } catch (e) {
      return res.status(e.status || 502).json({ error: e.message || "地名查詢沒成功" });
    }
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
      /* ---------- 沒有通行碼的人可以改自己那一筆願望的內容 ----------
         以前這裡夾成「除了 `votes` 什麼都不准動」。Lulu 的規則是
         「加願望的人可以重新編輯自己那一筆」,而**要編輯的正是那三個沒有通行碼的人** ——
         所以夾制不能拿掉,但夾制的**對象**要換。

         **這一條的邊界是「wishes、而且不改歸屬」,不是「只有本人能改」。**

         伺服器驗不了身分:前端的「我是誰」是 localStorage 裡的一個字串(`tokyo5-me`),
         誰都能設成任何人,而 A 改自己那一筆和 A 改 B 那一筆,**送到這裡的兩個請求
         長得一模一樣**。所以這裡**不寫一段假裝驗得了身分的程式**
         (`wishAsksForItsOwnPlace` 當初撞的是同一堵牆,只是這一次擋得住的更少)。

         它擋得住的只有一件事:**`by` 改不掉**。那一個欄位是前端 `.mine` 紫框
         和「改」那顆按鈕**共同的地基** —— 能改它的話,那兩個都可以被從底下抽掉。
         (geocode 那條窄路以前也站在同一個地基上,現在拆了,所以這裡少一個。)

         **「誰許的誰能改」是介面上的規則,不是鎖。** 下一個人不要在它上面疊東西。
         真的需要鎖的話,那要先有一個伺服器驗得了的身分,而這個站沒有。 */
      if (shape.open) {
        const now = shape.out(await notion("/pages/" + id));
        /* **沒送的欄位要留著原值,不能當成「改成空的」。**
           `wishIn()` 是整份覆寫(Notion 的 properties 給什麼寫什麼),而 `+1` 那條路
           只送 `{ votes }` —— 照字面寫回去的話,按一次 +1 就會把標題、地點、備註
           全部清空。**這不是假想的**:上面那個舊版本之所以要把 `now.*` 抄進來,
           就是同一件事,只是它順便把「不准改」和「沒有送」壓成了同一種。
           分開之後才講得清楚:`by` 是**不准改**,其餘是**沒送就不動**。

           **這一段對兩條路都要跑,不是只跑在沒通行碼那條。** 舊版把它寫在
           `!keyOK` 裡面,所以**管理員按一次 +1 就會清掉那筆願望的標題、地點、
           備註和「誰許的」** —— 而畫面上不會有任何錯誤。那個保護當初是寫成
           一個「限制」(限制沒權限的人只能改票),於是唯一被那個限制豁免的人,
           也同時被那個保護豁免了。**權限高的人反而沒有防護,那是寫法造成的,
           不是有意的。** 兩條路的差別只在 `by` 能不能改。
           代價:每次願望的 PATCH 多讀一次 Notion。+1 和編輯都不是高頻動作。 */
        const keep = (sent, was) => (sent === undefined ? was : sent);
        body = {
          title: keep(body.title, now.title),
          place: keep(body.place, now.place),
          note: keep(body.note, now.note),
          by: keyOK ? keep(body.by, now.by) : now.by,
          votes: keep(body.votes, now.votes),
        };
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
