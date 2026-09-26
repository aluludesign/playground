// Trippps · Notion 代理
//
// 瀏覽器不能直接打 Notion API(沒有 CORS,而且 token 不能放前端),
// 所以由這支 serverless function 代收代送。token 只存在 Vercel 的環境變數裡。
//
// 需要的環境變數:
//   NOTION_TOKEN     Notion internal integration 的密鑰(secret_... 或 ntn_...)
//   LINE_CHANNEL_SECRET  讀寫都要先知道你是誰(見 _session.js)。沒設的話所有人都是沒登入,
//                    什麼都讀不到 —— 第 2 期起,沒有登入就沒有「這一團」。
//   NOTION_DB_EXPENSES / NOTION_DB_ITINERARY / NOTION_DB_SEATS  (選填,預設值見下方)
//   GEOCODE_KEY      地名查詢退路的金鑰(選填;沒設就只是那條退路不能用,
//                    網站其他部分照常。理由和它擋住什麼,見下面 resource=geocode)

const S = require("./_session.js");

const NOTION = "https://api.notion.com/v1";
const VERSION = "2022-06-28";
const GEOCODE = "https://maps.googleapis.com/maps/api/geocode/json";

const DB = {
  /* **第 2 期換了一整套新表**(Notion「Trippps」底下名字帶「・新」的那幾張)。
     舊表的「付款人/分攤者/旅客」是寫死五個名字的選單,也沒有「團」這一欄 ——
     就地改的話,main 上還在跑的舊程式會當場讀錯。所以另開一套,
     這個分支讀新的、main 讀舊的,合進 main 的那一刻正式站才換過來。
     舊表那時候整個丟垃圾桶(東京五人行的資料 Lulu 說過可以全刪)。 */
  expenses: process.env.NOTION_DB_EXPENSES || "06b4de9448ff427eb0e68481a2b48a11",
  itinerary: process.env.NOTION_DB_ITINERARY || "fb55bb99d77749aea5b41cf897f566e7",
  seats: process.env.NOTION_DB_SEATS || "16c8f7cfc12c4e6d89cab63011295888",
  /* 多租戶的三張表。**這三張回答的是「你是誰、你在哪一團、你動得了什麼」**,
     上面三張回答的是「這一團有什麼」—— 兩組不要混。
     「人」沿用舊的那張:它只記誰登入過(三十人名額),跟哪一團無關。 */
  people: process.env.NOTION_DB_PEOPLE || "c38c62febb87434ca29e264cd9fd24b5",
  trips: process.env.NOTION_DB_TRIPS || "4802c8eac4a14943bf41a38394031acc",
  members: process.env.NOTION_DB_MEMBERS || "bee61d7fae604013968455412b2d57a5",
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
const dat = p => (p && p.date && p.date.start) || null;
/* 成員代號的清單。存成逗號分隔的一段字,讀的時候拆回來、去掉空的和重複的 */
const ids = v => Array.from(new Set((Array.isArray(v) ? v : String(v || "").split(","))
  .map(x => String(x).trim()).filter(x => /^[a-z0-9_]{1,40}$/.test(x))));
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
    /* 第 2 期起記的是**成員代號**,不是寫死五個名字的選單 ——
       三十團各有各的人,選單列不完,也不該由 Notion 的欄位設定決定誰在團裡。 */
    payer: txt(p["付款人"]) || null,
    participants: ids(txt(p["分攤者"])),
    note: txt(p["備註"]),
    createdAt: page.created_time,
  };
}
function expenseIn(b) {
  const props = {
    "項目": { title: richText(b.title || "未命名") },
    "金額": { number: Number(b.amount) || 0 },
    "幣別": { select: { name: b.currency === "TWD" ? "TWD" : "JPY" } },
    "分攤者": { rich_text: richText(ids(b.participants).join(",")) },
    "備註": { rich_text: richText(b.note) },
  };
  if (b.date) props["日期"] = { date: { start: b.date } };
  if (b.category) props["分類"] = { select: { name: b.category } };
  if (b.payer !== undefined) props["付款人"] = { rich_text: richText(b.payer) };
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
   舊表沒有專屬欄位,許願人借「時間」欄、票數夾在備註後面;新表各有自己的一欄
   (「許願人」「票」),兩件事都不用再拆字串。 */
function wishOut(page) {
  const p = page.properties;
  return {
    id: page.id,
    title: ttl(p["項目"]),
    place: txt(p["地點"]),
    note: txt(p["備註"]),
    votes: ids(txt(p["票"])),
    by: txt(p["許願人"]),
    createdAt: page.created_time,
  };
}
function wishIn(b) {
  /* 絕對不寫「日期」—— 一寫上去它就變成行程,而排行程要有「管行程」的權限 */
  return {
    "項目": { title: richText(b.title || "想去的地方") },
    "地點": { rich_text: richText(b.place) },
    "備註": { rich_text: richText(b.note) },
    "許願人": { rich_text: richText(b.by) },
    "票": { rich_text: richText(ids(b.votes).join(",")) },
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
    passenger: txt(p["旅客"]) || null,
    seat: txt(p["座位"]).toUpperCase(),
  };
}
function seatIn(b) {
  const props = {
    "航班": { title: richText(String(b.flight || "").toUpperCase()) },
    "座位": { rich_text: richText(String(b.seat || "").toUpperCase()) },
  };
  if (b.date) props["日期"] = { date: { start: b.date } };
  if (b.passenger !== undefined) props["旅客"] = { rich_text: richText(b.passenger) };
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

   **第 2 期起,一個成員就是一個登入過的人。** 第 1 期的「位子」(團主先建好、
   等人來認領)是為了讓東京五人行的舊資料對得回人;舊資料不要了,位子也就不需要了。
   現在是:開團的人建團時就是團主,其他人拿邀請碼加入的那一刻才出現在名單上。 */
const COUNTRIES = {
  /* 國家決定兩件事:幣別和城市的預設。**先開放這兩個**(Lulu 定的)。
     匯率只是預設值,團主進去之後可以改。 */
  "日本": { city: "東京", rate: 0.21, currency: "JPY" },
  "台灣": { city: "台北", rate: 1, currency: "TWD" },
};
const PALETTE = ["#E60012", "#F39700", "#009944", "#00A7DB", "#9B7CB6",
                 "#E85298", "#0068B7", "#8F7E00", "#6C4A2E", "#4D4D4D"];
/* 一團最多幾個人、一個人最多開幾團。**不是產品規格,是擋濫用的閘** ——
   三十人試用的名額在 _people.js 管,這兩條是防一個人把表灌爆。 */
const MEMBERS_PER_TRIP = 30;
const TRIPS_PER_PERSON = 10;

/* 猜不到的代號。**團代號會出現在網址上,邀請碼會貼到 LINE 群組** ——
   兩個都不能是能用數的。去掉 0/o/1/l/i 這幾個手打容易錯的字。 */
const ALNUM = "abcdefghjkmnpqrstuvwxyz23456789";
function randomCode(n) {
  const bytes = require("crypto").randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) out += ALNUM[bytes[i] % ALNUM.length];
  return out;
}

const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) && !isNaN(Date.parse(v));

function tripOut(page) {
  const p = page.properties;
  const country = sel(p["國家"]) || "日本";
  const base = COUNTRIES[country] || COUNTRIES["日本"];
  return {
    code: ttl(p["代號"]),
    name: txt(p["名稱"]) || ttl(p["代號"]),
    country,
    city: txt(p["城市"]) || base.city,
    currency: base.currency,
    start: dat(p["開始日"]),
    end: dat(p["結束日"]),
    rate: (p["匯率"] && p["匯率"].number) || base.rate,
    kitty: (p["基金"] && p["基金"].number) || 0,
    /* 成員能不能動這三塊,由團主決定。**預設全關** —— 沒設定不等於不設防。 */
    can: {
      plan: !!(p["成員可管行程"] && p["成員可管行程"].checkbox),
      cost: !!(p["成員可管分帳"] && p["成員可管分帳"].checkbox),
      seat: !!(p["成員可管機位"] && p["成員可管機位"].checkbox),
    },
    page: page.id,
  };
}

/* **`line` 和 `page` 只在伺服器裡用,不會出現在回給瀏覽器的東西裡。**
   `line` 是別人的 LINE 使用者編號,前端一個字都不需要。 */
function memberOut(page) {
  const p = page.properties;
  const full = ttl(p["代號"]);
  return {
    page: page.id,
    id: full.indexOf(":") >= 0 ? full.slice(full.indexOf(":") + 1) : full,
    trip: txt(p["團"]),
    name: txt(p["名字"]),
    color: txt(p["顏色"]) || "#888",
    role: sel(p["角色"]) || "成員",
    line: txt(p["人"]),
    invite: txt(p["邀請碼"]),
  };
}
/* 給瀏覽器看的樣子:沒有 LINE ID、沒有 Notion 的頁面編號、沒有別人的邀請碼。 */
const memberPublic = m => ({ id: m.id, name: m.name, color: m.color, role: m.role });

async function findTrip(code) {
  const page = await notion("/databases/" + DB.trips + "/query", {
    method: "POST",
    body: JSON.stringify({ page_size: 1, filter: { property: "代號", title: { equals: code } } }),
  });
  return page.results.length ? tripOut(page.results[0]) : null;
}

async function queryMembers(filter) {
  const rows = [];
  let cursor;
  do {
    const page = await notion("/databases/" + DB.members + "/query", {
      method: "POST",
      body: JSON.stringify({ page_size: 100, start_cursor: cursor, filter }),
    });
    page.results.forEach(r => rows.push(memberOut(r)));
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return rows;
}
const membersOf = code => queryMembers({ property: "團", rich_text: { equals: code } });
const seatsOf = sub => queryMembers({ property: "人", rich_text: { equals: sub } });

async function addMember(code, me, name, role, inviter, taken) {
  const used = new Set(taken.map(m => m.color));
  const color = PALETTE.find(c => !used.has(c)) || PALETTE[taken.length % PALETTE.length];
  const ids = new Set(taken.map(m => m.id));
  let id;
  do { id = "m" + randomCode(5); } while (ids.has(id));
  await notion("/pages", { method: "POST", body: JSON.stringify({
    parent: { database_id: DB.members },
    properties: {
      "代號": { title: richText(code + ":" + id) },
      "團": { rich_text: richText(code) },
      "人": { rich_text: richText(me.sub) },
      "名字": { rich_text: richText(name) },
      "顏色": { rich_text: richText(color) },
      "角色": { select: { name: role } },
      "邀請碼": { rich_text: richText(randomCode(6)) },
      "邀請人": { rich_text: richText(inviter || "") },
      "加入時間": { date: { start: new Date().toISOString().slice(0, 10) } },
    },
  }) });
  return { id, name, color, role };
}

/* 名字的規則:去頭尾空白、1 到 20 個字。**不驗是不是真名** —— 「媽」就是一個好名字。 */
const cleanName = v => String(v || "").replace(/\s+/g, " ").trim().slice(0, 20);

/* ---------- 入口 ---------- */
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (!process.env.NOTION_TOKEN) {
    return res.status(500).json({ error: "伺服器還沒設定 NOTION_TOKEN" });
  }

  /* **第 2 期的規則:沒有「公開」這回事了。** 讀和寫都要先知道你是誰,
     再看你是不是這一團的人。通行碼整個拿掉 —— 每一團從建立那一刻就有團主,
     「還沒有人認領之前靠它」那個理由已經不存在(Lulu 2026-09-26 決定)。 */
  const me = S.whoIs(req);
  const resource = (req.query && req.query.resource) || "";
  const q = req.query || {};

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch (_) { body = {}; } }
  body = body || {};

  const method = req.method;
  const allow = (...ms) => {
    if (ms.indexOf(method) >= 0) return true;
    res.setHeader("Allow", ms.join(", "));
    res.status(405).json({ error: "不支援的方法" });
    return false;
  };

  /* **「讀不到」和「沒有資料」要分得出來。** integration 沒被加到那一頁的時候,
     Notion 回的是 404 object_not_found —— 安靜地回一張空名單的話,畫面上看起來
     只是「這團沒有人」,沒有任何地方會說一句。這個專案被這種無聲失敗咬過太多次了。 */
  const fail = e => {
    const lost = e.status === 404 || /object_not_found|Could not find/i.test(e.message || "");
    return res.status(lost ? 503 : (e.status || 500)).json({
      error: lost ? "後端讀不到 Notion 的表 —— 多半是那幾張表還沒把 integration 加進 Connections"
                  : (e.message || "伺服器錯誤"),
    });
  };

  const codeOf = v => {
    const c = String(v || "").trim();
    return /^[a-z0-9_-]{1,40}$/.test(c) ? c : "";
  };

  /* 這次請求是在哪一團、你在那一團是誰。**每一種擋法的理由都不一樣** ——
     沒登入、不是這一團的人、是成員但團主沒開那一塊 —— 使用者下一步要做的事完全不同,
     所以回的狀態和那一句話都分開。`why` 給前端判斷要畫哪一張卡。 */
  async function context(rawCode) {
    if (!me) return { stop: { status: 401, why: "login", error: "請先用 LINE 登入" } };
    const code = codeOf(rawCode);
    if (!code) return { stop: { status: 400, error: "團的代號不對" } };
    const trip = await findTrip(code);
    if (!trip) return { stop: { status: 404, why: "no_trip", error: "沒有這一團,或它已經被刪掉了" } };
    const members = await membersOf(code);
    const mine = members.find(m => m.line && m.line === me.sub);
    if (!mine) return { stop: { status: 403, why: "not_member", error: "你還不是這一團的人 —— 要有邀請碼才能加入" } };
    const owner = mine.role === "團主";
    return { code, trip, members, mine, owner, can: b => owner || !!trip.can[b] };
  }
  const stop = s => res.status(s.status).json({ error: s.error, why: s.why });

  /* ---------- 我的團 ----------
     GET  → 我在哪幾團(登入後的第一個畫面)。空的就是「引導開團」。
     POST → 開一團。開的人就是團主。 */
  if (resource === "trips") {
    if (!allow("GET", "POST")) return;
    if (!me) return stop({ status: 401, why: "login", error: "請先用 LINE 登入" });
    try {
      const mine = await seatsOf(me.sub);
      if (method === "GET") {
        const trips = [];
        for (const m of mine) {
          const t = await findTrip(m.trip);
          /* 團被刪掉、成員那一列還在:不列出來,不要給一個點了會 404 的東西 */
          if (t) trips.push({ code: t.code, name: t.name, country: t.country, city: t.city,
                              start: t.start, end: t.end, role: m.role });
        }
        trips.sort((a, b) => String(b.start || "").localeCompare(String(a.start || "")));
        return res.status(200).json({ trips });
      }

      const name = String(body.name || "").trim().slice(0, 40);
      const country = String(body.country || "");
      const city = String(body.city || "").trim().slice(0, 30);
      const myName = cleanName(body.myName);
      if (!name) return res.status(400).json({ error: "團名要填" });
      if (!COUNTRIES[country]) return res.status(400).json({ error: "國家目前只能選日本或台灣" });
      if (!isDate(body.start) || !isDate(body.end)) return res.status(400).json({ error: "日期要填開始和結束" });
      if (body.end < body.start) return res.status(400).json({ error: "結束日不能比開始日早" });
      if ((Date.parse(body.end) - Date.parse(body.start)) / 864e5 > 60) {
        return res.status(400).json({ error: "一團最長 60 天" });
      }
      if (!myName) return res.status(400).json({ error: "要填你在這團叫什麼" });
      if (mine.filter(m => m.role === "團主").length >= TRIPS_PER_PERSON) {
        return res.status(429).json({ error: "你已經開了 " + TRIPS_PER_PERSON + " 團,先刪掉一團再開" });
      }

      /* 代號撞到的機率是 31^8 分之一,但撞到的代價是兩團共用一份資料 —— 所以還是查一次 */
      let code;
      do { code = randomCode(8); } while (await findTrip(code));

      await notion("/pages", { method: "POST", body: JSON.stringify({
        parent: { database_id: DB.trips },
        properties: {
          "代號": { title: richText(code) },
          "名稱": { rich_text: richText(name) },
          "國家": { select: { name: country } },
          "城市": { rich_text: richText(city) },
          "開始日": { date: { start: body.start } },
          "結束日": { date: { start: body.end } },
          "匯率": { number: COUNTRIES[country].rate },
          "基金": { number: 0 },
          "建立者": { rich_text: richText(me.sub) },
        },
      }) });
      /* **先有團、再有團主。** 反過來中途失敗的話,會有一個成員掛在一團不存在的團上;
         這個順序失敗的話,最壞是一團沒有人的空團 —— 誰都看不到,不會洩漏任何東西。 */
      const who = await addMember(code, me, myName, "團主", "", []);
      return res.status(200).json({ code, me: who });
    } catch (e) { return fail(e); }
  }

  /* ---------- 這一團 ----------
     GET   → 團的設定、成員名單、我是誰(含**我自己的**邀請碼)。
     PATCH → 團主改團名、國家、城市、日期、匯率、基金、三個開關。 */
  if (resource === "team") {
    if (!allow("GET", "PATCH")) return;
    try {
      const c = await context(q.t);
      if (c.stop) return stop(c.stop);
      if (method === "GET") {
        const { page, ...trip } = c.trip;
        return res.status(200).json({
          trip,
          members: c.members.map(memberPublic),
          me: { ...memberPublic(c.mine), invite: c.mine.invite },
        });
      }

      if (!c.owner) return res.status(403).json({ error: "只有團主能改團的設定" });
      const props = {};
      if (body.name !== undefined) {
        const v = String(body.name).trim().slice(0, 40);
        if (!v) return res.status(400).json({ error: "團名不能是空的" });
        props["名稱"] = { rich_text: richText(v) };
      }
      if (body.country !== undefined) {
        if (!COUNTRIES[body.country]) return res.status(400).json({ error: "國家目前只能選日本或台灣" });
        props["國家"] = { select: { name: body.country } };
      }
      if (body.city !== undefined) props["城市"] = { rich_text: richText(String(body.city).trim().slice(0, 30)) };
      const start = body.start !== undefined ? body.start : c.trip.start;
      const end = body.end !== undefined ? body.end : c.trip.end;
      if (body.start !== undefined || body.end !== undefined) {
        if (!isDate(start) || !isDate(end)) return res.status(400).json({ error: "日期的格式不對" });
        if (end < start) return res.status(400).json({ error: "結束日不能比開始日早" });
        if ((Date.parse(end) - Date.parse(start)) / 864e5 > 60) return res.status(400).json({ error: "一團最長 60 天" });
        props["開始日"] = { date: { start } };
        props["結束日"] = { date: { start: end } };
      }
      for (const [k, col] of [["rate", "匯率"], ["kitty", "基金"]]) {
        if (body[k] === undefined) continue;
        const n = Number(body[k]);
        if (!isFinite(n) || n < 0) return res.status(400).json({ error: col + "要是 0 或正數" });
        props[col] = { number: n };
      }
      if (body.can) {
        for (const [k, col] of [["plan", "成員可管行程"], ["cost", "成員可管分帳"], ["seat", "成員可管機位"]]) {
          if (body.can[k] !== undefined) props[col] = { checkbox: !!body.can[k] };
        }
      }
      if (!Object.keys(props).length) return res.status(400).json({ error: "沒有要改的東西" });
      await notion("/pages/" + c.trip.page, { method: "PATCH", body: JSON.stringify({ properties: props }) });
      const { page, ...trip } = await findTrip(c.code);
      return res.status(200).json({ trip });
    } catch (e) { return fail(e); }
  }

  /* ---------- 邀請 ----------
     GET  ?t=&code= → 加入之前先看一眼:哪一團、誰邀請你。**只回團名和邀請人的名字** ——
                      成員名單、日期、任何資料都要加入之後才看得到。
     POST {trip, invite, name} → 加入。

     **邀請碼是每個人各一組**(成員表的設計):朋友用誰的碼進來就記下是誰邀請的,
     想斷掉某一條擴散線就換那個人的碼,其他人的連結不受影響。 */
  if (resource === "join") {
    if (!allow("GET", "POST")) return;
    if (!me) return stop({ status: 401, why: "login", error: "請先用 LINE 登入" });
    const code = codeOf(method === "GET" ? q.t : body.trip);
    const invite = String((method === "GET" ? q.code : body.invite) || "").trim().toLowerCase();
    if (!code) return res.status(400).json({ error: "團的代號不對" });
    try {
      const trip = await findTrip(code);
      if (!trip) return stop({ status: 404, why: "no_trip", error: "沒有這一團,或它已經被刪掉了" });
      const members = await membersOf(code);
      const already = members.find(m => m.line === me.sub);
      /* 已經在團裡的人再按一次邀請連結:直接放行,不要讓他看到一句「你已經加入了」的錯誤 */
      if (already) return res.status(200).json({ joined: true, me: memberPublic(already), trip: { code, name: trip.name } });

      /* 碼不對的時候**不說是哪裡不對** —— 不回「這團存在但碼錯了」,
         那等於幫人一個一個試團代號。 */
      const host = /^[a-z0-9]{6}$/.test(invite) ? members.find(m => m.invite === invite) : null;
      if (!host) return res.status(403).json({ why: "bad_invite", error: "邀請碼不對,或已經換掉了 —— 跟邀請你的人再要一次" });

      if (method === "GET") {
        return res.status(200).json({ joined: false, trip: { code, name: trip.name }, host: host.name });
      }

      const name = cleanName(body.name);
      if (!name) return res.status(400).json({ error: "要填你在這團叫什麼" });
      if (members.some(m => m.name === name)) {
        return res.status(409).json({ error: "這一團已經有人叫「" + name + "」了,換一個讓大家分得出來" });
      }
      if (members.length >= MEMBERS_PER_TRIP) return res.status(429).json({ error: "這一團已經滿 " + MEMBERS_PER_TRIP + " 人了" });
      const who = await addMember(code, me, name, "成員", host.line, members);
      return res.status(200).json({ joined: true, me: who, trip: { code, name: trip.name } });
    } catch (e) { return fail(e); }
  }

  /* ---------- 我在這一團的樣子 ----------
     PATCH {name?, color?} → 改自己的名字和顏色。**只能改自己的。** */
  if (resource === "me") {
    if (!allow("PATCH")) return;
    try {
      const c = await context(q.t);
      if (c.stop) return stop(c.stop);
      const props = {};
      if (body.name !== undefined) {
        const name = cleanName(body.name);
        if (!name) return res.status(400).json({ error: "名字不能是空的" });
        if (c.members.some(m => m.name === name && m.id !== c.mine.id)) {
          return res.status(409).json({ error: "這一團已經有人叫「" + name + "」了" });
        }
        props["名字"] = { rich_text: richText(name) };
      }
      if (body.color !== undefined) {
        if (!/^#[0-9A-Fa-f]{6}$/.test(String(body.color))) return res.status(400).json({ error: "顏色的格式不對" });
        props["顏色"] = { rich_text: richText(body.color) };
      }
      if (body.invite === "renew") props["邀請碼"] = { rich_text: richText(randomCode(6)) };
      if (!Object.keys(props).length) return res.status(400).json({ error: "沒有要改的東西" });
      await notion("/pages/" + c.mine.page, { method: "PATCH", body: JSON.stringify({ properties: props }) });
      const fresh = (await membersOf(c.code)).find(m => m.id === c.mine.id);
      return res.status(200).json({ me: { ...memberPublic(fresh), invite: fresh.invite } });
    } catch (e) { return fail(e); }
  }

  /* 下面三支(places / placephoto / geocode)每叫一次都算 Google 的錢。
     **第 2 期起要登入才能叫** —— 以前是「知道網址就能用,額度由 Google 的每日上限擋」;
     現在有了身分,不必再把額度開給全世界。 */
  if ((resource === "places" || resource === "placephoto" || resource === "geocode") && !me) {
    return stop({ status: 401, why: "login", error: "請先用 LINE 登入" });
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

  /* 哪一張表對應團主開的哪一個開關。**沒列在這裡的東西成員一律動不了** ——
     新增一張表的人要自己決定它屬於哪一塊,而不是預設放行。 */
  const BUCKET = { itinerary: "plan", expenses: "cost", seats: "seat" };

  try {
    const c = await context(q.t);
    if (c.stop) return stop(c.stop);

    /* 這一筆是不是這一團的、是不是這張表的。**只有 id 是不夠的** —— 甲團的成員
       拿得到乙團某一筆的 id(舊網址、截圖、轉傳),不查的話就改得動別人的帳。
       查不到一律回 404,不說「這筆存在但不是你的」。 */
    async function rowOf(id) {
      if (!/^[0-9a-f-]{32,36}$/i.test(String(id || ""))) return null;
      let page;
      try { page = await notion("/pages/" + id); } catch (e) { if (e.status === 404) return null; throw e; }
      const db = String((page.parent && page.parent.database_id) || "").replace(/-/g, "");
      if (page.archived || db !== shape.db.replace(/-/g, "")) return null;
      if (txt(page.properties && page.properties["團"]) !== c.code) return null;
      return page;
    }
    const gone = () => res.status(404).json({ error: "這一團沒有這一筆 —— 可能已經被刪掉了" });
    const withTrip = props => ({ ...props, "團": { rich_text: richText(c.code) } });

    if (method === "GET") {
      const filter = shape.filter
        ? { and: [{ property: "團", rich_text: { equals: c.code } }, shape.filter] }
        : { property: "團", rich_text: { equals: c.code } };
      return res.status(200).json({ rows: await listAll({ ...shape, filter }) });
    }

    /* ---------- 許願 ----------
       成員都能許、都能 +1。**這兩件事現在由伺服器認人**,不再是前端說了算:
         - 「誰許的」= 送出的那個人,前端送什麼都不理。
         - +1 只能加減**自己那一票**。
       改內容和刪掉:許願的人自己、團主、或團主開了「成員可管行程」的人。 */
    if (resource === "wishes") {
      const mineId = c.mine.id;
      if (method === "POST") {
        const props = shape.in({ ...body, by: mineId, votes: ids(body.votes).filter(v => v === mineId) });
        const page = await notion("/pages", { method: "POST",
          body: JSON.stringify({ parent: { database_id: shape.db }, properties: withTrip(props) }) });
        return res.status(200).json({ row: shape.out(page) });
      }
      if (method === "PATCH" || method === "DELETE") {
        const page = await rowOf(q.id);
        if (!page) return gone();
        const now = shape.out(page);
        const editor = now.by === mineId || c.can("plan");
        if (method === "DELETE") {
          if (!editor) return res.status(403).json({ error: "只有許願的人或管行程的人能刪掉這個願望" });
          await notion("/pages/" + page.id, { method: "PATCH", body: JSON.stringify({ archived: true }) });
          return res.status(200).json({ ok: true });
        }
        /* **沒送的欄位要留著原值,不能當成「改成空的」。** `wishIn()` 是整份覆寫,
           而 +1 那條路只送 `{ votes }` —— 照字面寫回去的話,按一次 +1 就會把
           標題、地點、備註全部清空。 */
        const wantsEdit = ["title", "place", "note"].some(k => body[k] !== undefined);
        if (wantsEdit && !editor) return res.status(403).json({ error: "只有許願的人或管行程的人能改這個願望" });
        const keep = (sent, was) => (sent === undefined ? was : sent);
        let votes = now.votes;
        if (body.votes !== undefined) {
          const want = ids(body.votes).indexOf(mineId) >= 0;
          votes = now.votes.filter(v => v !== mineId).concat(want ? [mineId] : []);
        }
        const props = shape.in({
          title: keep(body.title, now.title), place: keep(body.place, now.place),
          note: keep(body.note, now.note), by: now.by, votes,
        });
        const saved = await notion("/pages/" + page.id, { method: "PATCH", body: JSON.stringify({ properties: props }) });
        return res.status(200).json({ row: shape.out(saved) });
      }
      res.setHeader("Allow", "GET, POST, PATCH, DELETE");
      return res.status(405).json({ error: "不支援的方法" });
    }

    /* ---------- 行程、花費、座位 ---------- */
    const b = BUCKET[resource];
    if (!b || !c.can(b)) return res.status(403).json({ error: "這一塊目前只有團主動得了" });

    if (method === "POST") {
      const page = await notion("/pages", { method: "POST",
        body: JSON.stringify({ parent: { database_id: shape.db }, properties: withTrip(shape.in(body)) }) });
      return res.status(200).json({ row: shape.out(page) });
    }
    if (method === "PATCH") {
      const page = await rowOf(q.id);
      if (!page) return gone();
      const saved = await notion("/pages/" + page.id, { method: "PATCH",
        body: JSON.stringify({ properties: shape.in(body) }) });
      return res.status(200).json({ row: shape.out(saved) });
    }
    if (method === "DELETE") {
      const page = await rowOf(q.id);
      if (!page) return gone();
      await notion("/pages/" + page.id, { method: "PATCH", body: JSON.stringify({ archived: true }) });
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ error: "不支援的方法" });
  } catch (e) {
    return fail(e);
  }
};
