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
//   GOOGLE_MAPS_BROWSER_KEY  強力搜(Places UI Kit)的瀏覽器金鑰,由 resource=mapskey 轉交給前端(公開金鑰,靠網址白名單保護)。
//                    (2026-10-02 起不再需要 GEOCODE_KEY:舊的 Google 地名查詢整個拿掉了)

const S = require("./_session.js");

const NOTION = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

const DB = {
  /* **第 2 期換了一整套新表**(Notion「Trippps」底下名字帶「・新」的那幾張)。
     舊表的「付款人/分攤者/旅客」是寫死五個名字的選單,也沒有「團」這一欄 ——
     就地改的話,main 上還在跑的舊程式會當場讀錯。所以另開一套,
     這個分支讀新的、main 讀舊的,合進 main 的那一刻正式站才換過來。
     舊表那時候整個丟垃圾桶(東京五人行的資料 Lulu 說過可以全刪)。 */
  expenses: process.env.NOTION_DB_EXPENSES || "06b4de9448ff427eb0e68481a2b48a11",
  itinerary: process.env.NOTION_DB_ITINERARY || "fb55bb99d77749aea5b41cf897f566e7",
  seats: process.env.NOTION_DB_SEATS || "16c8f7cfc12c4e6d89cab63011295888",
  flights: process.env.NOTION_DB_FLIGHTS || "4c438316581d4cb89a08258f0ebbe57e",
  /* 多租戶的三張表。**這三張回答的是「你是誰、你在哪一團、你動得了什麼」**,
     上面三張回答的是「這一團有什麼」—— 兩組不要混。
     「人」沿用舊的那張:它只記誰登入過(三十人名額),跟哪一團無關。 */
  people: process.env.NOTION_DB_PEOPLE || "c38c62febb87434ca29e264cd9fd24b5",
  trips: process.env.NOTION_DB_TRIPS || "4802c8eac4a14943bf41a38394031acc",
  members: process.env.NOTION_DB_MEMBERS || "bee61d7fae604013968455412b2d57a5",
  /* 小鈴鐺的「動態」(2026-10-02):誰許願、行程/交通改了什麼、有新帳要分。一件事一列 */
  activity: process.env.NOTION_DB_ACTIVITY || "ee00c7c3212a4bdf81f5bf49759f9665",
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

/* 「花費」表有沒有「送出編號」這一欄。**有才用**:沒有這一欄就寫進去的話,Notion 會把整筆拒絕,
   所有人都記不了帳。十分鐘問一次 —— 在 Notion 加了這一欄之後,不用重新部署就會開始用。 */
let cidCol = { has: false, at: 0 };
async function hasCidCol() {
  if (Date.now() - cidCol.at < 10 * 60 * 1000) return cidCol.has;
  try {
    const d = await notion("/databases/" + DB.expenses);
    cidCol = { has: !!(d.properties && d.properties["送出編號"]), at: Date.now() };
  } catch (_) { cidCol = { has: false, at: Date.now() }; }
  return cidCol.has;
}

/* (2026-10-02)舊的 Google 地名查詢(Geocoding、Places Text Search、Place Photo)整個拿掉了:
   強力搜改用前端的 Places UI Kit(見 index.html)。那三支違反 Google 條款
   (Google 的座標畫在 OpenStreetMap 上、沒有 30 天期限、照片沒標作者),伺服器那把金鑰也就不需要了。 */

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
    /* 從願望排進來的那一列,「許願人」還留著(stopIn 不碰它)—— 畫面靠這個知道它退得回願望區 */
    by: p["許願人"] ? txt(p["許願人"]) : "",
    /* Google 的地點編號(2026-10-02,Places UI Kit):從 Google 清單挑的才有。可以永久存 —— 座標不行(只能 30 天,手機自己記) */
    placeId: p["地點編號"] ? txt(p["地點編號"]) : "",
  };
}
function stopIn(b) {
  const props = {
    "項目": { title: richText(b.title || "未命名") },
    "時間": { rich_text: richText(b.time) },
    "地點": { rich_text: richText(b.place) },
    "備註": { rich_text: richText(b.note) },
  };
  if (b.placeId !== undefined) props["地點編號"] = { rich_text: richText(String(b.placeId || "").slice(0, 200)) };
  if (b.day) props["日期"] = { date: { start: b.day } };
  /* **退回願望區 = 把日期清掉**(2026-09-30):沒有日期的那一列就是願望,許願人和票都還在 */
  else if (b.day === null) props["日期"] = { date: null };
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
    placeId: p["地點編號"] ? txt(p["地點編號"]) : "",
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
    ...(b.placeId !== undefined ? { "地點編號": { rich_text: richText(String(b.placeId || "").slice(0, 200)) } } : {}),
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
    seat: txt(p["座位"]),   /* 照原樣,不轉大寫(2026-09-30:輸入什麼就是什麼) */
  };
}
function seatIn(b) {
  const props = {
    "航班": { title: richText(String(b.flight || "").toUpperCase()) },
    "座位": { rich_text: richText(String(b.seat || "").trim().slice(0, 20)) },
  };
  if (b.date) props["日期"] = { date: { start: b.date } };
  if (b.passenger !== undefined) props["旅客"] = { rich_text: richText(b.passenger) };
  return props;
}

/* 航班:一列 = 一班飛機。**第 2 期以前這些是寫死在前端的**(樂桃 MM626/MM631、
   起降時間、機場)—— 那只對東京五人行成立。現在看板、倒數、行程上的報到/起飛/抵達、
   機位圖都從這裡長出來,座位表的「航班」對的就是這裡的航班號。
   時間存「當地時間、不帶時區」的字串(2026-10-03T10:50):畫面上要的就是登機證上那個數字,
   換算成某個時區反而會在跨日的深夜班機上錯一天。 */
const DIRS = ["去程", "回程", "其他"];
/* **交通不是只有飛機**(Lulu,2026-09-28)。同一張表、同一套欄位,多一欄「種類」:
   航班號 = 班次/車次、航空公司 = 哪一家、起飛/抵達 = 出發/抵達(租車是取車/還車)、
   起飛機場/抵達機場 = 從哪裡/到哪裡。舊的列沒有種類,一律當飛機 —— 不用重填。 */
const KINDS = ["飛機", "火車", "巴士", "船", "租車"];
const kindOf = v => (KINDS.indexOf(v) >= 0 ? v : "飛機");
/* 飛機的航班號照舊收成 MM626;其他種類的班次是人話(のぞみ 21號),只去頭尾空白 */
const legNo = (v, kind) => (kind === "飛機" ? String(v || "").toUpperCase().replace(/\s+/g, "") : String(v || "").trim());
const localTime = v => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(v || "")) ? v : null);
function flightOut(page) {
  const p = page.properties;
  const t = x => (x && x.date && x.date.start ? String(x.date.start).slice(0, 16) : null);
  const kind = kindOf(p["種類"] ? sel(p["種類"]) : "");
  return {
    id: page.id,
    kind,
    no: legNo(ttl(p["航班號"]), kind),
    dir: sel(p["方向"]) || "其他",
    airline: txt(p["航空公司"]),
    depart: t(p["起飛"]),
    from: txt(p["起飛機場"]),
    arrive: t(p["抵達"]),
    to: txt(p["抵達機場"]),
    note: txt(p["備註"]),
    code: p["訂位代號"] ? txt(p["訂位代號"]) : "",
    drivers: p["駕駛"] ? ids(txt(p["駕駛"]).split(",")) : [],
  };
}
function flightIn(b) {
  const props = {};
  const kind = kindOf(b.kind);
  if (b.kind !== undefined) props["種類"] = { select: { name: kind } };
  if (b.no !== undefined) props["航班號"] = { title: richText(legNo(b.no, kind)) };
  if (b.code !== undefined) props["訂位代號"] = { rich_text: richText(b.code) };
  if (b.drivers !== undefined) props["駕駛"] = { rich_text: richText(ids(b.drivers).join(",")) };
  if (b.dir !== undefined) props["方向"] = { select: { name: DIRS.indexOf(b.dir) >= 0 ? b.dir : "其他" } };
  if (b.airline !== undefined) props["航空公司"] = { rich_text: richText(b.airline) };
  if (b.from !== undefined) props["起飛機場"] = { rich_text: richText(b.from) };
  if (b.to !== undefined) props["抵達機場"] = { rich_text: richText(b.to) };
  if (b.note !== undefined) props["備註"] = { rich_text: richText(b.note) };
  /* 不帶時區的字串照原樣存:Notion 看到沒有時區的 datetime 就當成「浮動時間」 */
  if (b.depart !== undefined) props["起飛"] = localTime(b.depart) ? { date: { start: b.depart } } : { date: null };
  if (b.arrive !== undefined) props["抵達"] = localTime(b.arrive) ? { date: { start: b.arrive } } : { date: null };
  return props;
}

const SHAPES = {
  flights: { db: DB.flights, out: flightOut, in: flightIn, sort: [{ property: "起飛", direction: "ascending" }] },
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
   成本改由 Google 金鑰的每日上限擋(geocode 那一段 2026-10-02 也拿掉了,見「舊的 Google 地名查詢」)。

   `git log -S wishAsksForItsOwnPlace` 找得回完整實作。 */


/* ---------- 團、成員 ----------

   **第 2 期起,一個成員就是一個登入過的人。** 第 1 期的「位子」(團主先建好、
   等人來認領)是為了讓東京五人行的舊資料對得回人;舊資料不要了,位子也就不需要了。
   現在是:開團的人建團時就是團主,其他人拿邀請碼加入的那一刻才出現在名單上。 */
const COUNTRIES = {
  /* 國家決定兩件事:幣別和城市的預設。**先開放這兩個**(Lulu 定的)。
     匯率只是預設值,團主進去之後可以改。 */
  "日本": { city: "東京", rate: 0.21, currency: "JPY", tz: "Asia/Tokyo" },
  "台灣": { city: "台北", rate: 1, currency: "TWD", tz: "Asia/Taipei" },
};
const PALETTE = ["#E60012", "#F39700", "#009944", "#00A7DB", "#9B7CB6",
                 "#E85298", "#0068B7", "#8F7E00", "#6C4A2E", "#4D4D4D"];
/* 一團最多幾個人、一個人最多開幾團。**不是產品規格,是擋濫用的閘** ——
   三十人試用的名額在 _people.js 管,這兩條是防一個人把表灌爆。 */
const MEMBERS_PER_TRIP = 30;
/* 測試環境:Vercel 的 preview、本機、驗收工具。**正式站 VERCEL_ENV 一定是 production。** */
const DEV = process.env.VERCEL_ENV !== "production";
/* **Google 的一天**(太平洋時間午夜 = 台灣下午 3 點,冬令 4 點)。AI 次數和「每天只能換一次副團主」
   都照這一天算,兩條規則同一個時間重來(跟 api/_usage.js 同一套算法)。 */
const PT = "America/Los_Angeles";
const ptDay = d => new Intl.DateTimeFormat("en-CA", { timeZone: PT, year: "numeric", month: "2-digit", day: "2-digit" }).format(d || new Date());
function nextReset(now) {
  now = now || new Date();
  const today = ptDay(now), t = new Date(now);
  t.setUTCMinutes(0, 0, 0);
  for (let i = 0; i < 26; i++) { t.setUTCHours(t.getUTCHours() + 1); if (ptDay(t) !== today) return t.toISOString(); }
  return "";
}
/* 這一次重算之後有沒有換過(時間落在同一個太平洋日) */
const sameGoogleDay = iso => !!iso && ptDay(new Date(iso)) === ptDay();
const twClock = iso => { try { return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)); } catch (_) { return ""; } };
const VIEW_AS_COOKIE = "trip_as";
/* **每人同時最多當 2 團的團主**(2026-10-02,Lulu:30 人試用)。**只算還沒結束的團** ——
   結束的也算的話開滿就永遠不能再開。最高權限(見下)不受限 */
const TRIPS_PER_PERSON = 2;
/* **最高權限**(2026-10-02,Lulu):`TRIPPPS_ADMIN`(Vercel,逗號分隔的 LINE 編號)裡的人
   開團不受限,而且能看到所有的團、隱藏或刪掉任何一團(`resource=admin`)。 */
const isAdmin = sub => !!sub && String(process.env.TRIPPPS_ADMIN || "").split(",").map(x => x.trim()).filter(Boolean).includes(sub);
const HIDDEN = "這一團暫時關閉了";

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

/* 這一團在當地是第幾天了。不靠存一個「已結束」的欄位 —— 時間到了就是結束,不需要誰去按 */
function localToday(tz) {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
  catch (_) { return new Date().toISOString().slice(0, 10); }
}
function tripPhase(start, end, tz) {
  const today = localToday(tz);
  return { started: !!start && today >= start, ended: !!end && today > end, today };
}
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
    /* **副團主能動哪幾塊**(2026-10-01 起)。一般成員只能許願,舊的「成員可管…」三欄不再用。
       團主指派副團主的時候勾;預設全關。seat 這一塊就是「交通」(交通和座位)。 */
    can: {
      plan: !!(p["副團主可管行程"] && p["副團主可管行程"].checkbox),
      cost: !!(p["副團主可管記帳"] && p["副團主可管記帳"].checkbox),
      seat: !!(p["副團主可管交通"] && p["副團主可管交通"].checkbox),
    },
    /* 上一次換掉(或取消)副團主是什麼時候。**每天只能換一次**,擋住一直換人刷 AI 的 +5 */
    deputyAt: p["副團主換人時間"] && p["副團主換人時間"].date ? p["副團主換人時間"].date.start : "",
    /* 最高權限勾了「隱藏」:資料都在,成員只看到「這一團暫時關閉了」 */
    hidden: !!(p["隱藏"] && p["隱藏"].checkbox),
    /* **團的生命週期**(2026-10-01,Lulu):照旅遊當地時間算 ——
       started:第一天到了(第一天不能再改,最後一天只能往後延);
       ended:最後一天 23:59 過了 → 這一團結束,只剩團主和有記帳權限的副團主能動花費,AI 對所有人關掉 */
    ...tripPhase(dat(p["開始日"]), dat(p["結束日"]), base.tz),
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
    /* 什麼時候加入:用 Notion 自己的建立時間(「加入時間」那欄只有日期,同一天加入的人分不出先後) */
    joinedAt: page.created_time || "",
    /* 團主最後一次看過「有新成員加入」的通知是什麼時候(2026-09-29)。只有本人拿得到 */
    seenAt: p["通知已讀"] && p["通知已讀"].date ? p["通知已讀"].date.start : "",
  };
}
/* 給瀏覽器看的樣子:沒有 LINE ID、沒有 Notion 的頁面編號、沒有別人的邀請碼。 */
const memberPublic = m => ({ id: m.id, name: m.name, color: m.color, role: m.role, joinedAt: m.joinedAt || "" });

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
    if (trip.hidden && !isAdmin(me.sub)) return { stop: { status: 403, why: "hidden", error: HIDDEN } };
    const members = await membersOf(code);
    const mine = members.find(m => m.line && m.line === me.sub);
    if (!mine) return { stop: { status: 403, why: "not_member", error: "你還不是這一團的人 —— 要有邀請碼才能加入" } };
    /* **測試環境的「用成員身分看」。** 開發時要看一般成員看到什麼、動得了什麼,
       團主在 preview 帶著 trip_as=member 這張 cookie,伺服器就把他當成成員(照三個開關算)。
       兩道保險:
         - **只能降級**:團主可以變成員,成員帶這張 cookie 什麼都不會變 —— 就算有人知道這個機制,
           也拿不到比原本更多的權限。
         - **正式站整個不理它**:Vercel 在正式部署設 VERCEL_ENV=production。 */
    const asMember = DEV && mine.role === "團主" && S.readCookies(req)[VIEW_AS_COOKIE] === "member";
    const role = asMember ? "成員" : mine.role;
    const owner = role === "團主";
    /* 團主全部都能動;副團主看團主勾了哪幾塊;一般成員只能許願(許願不走這裡) */
    const deputy = role === "副團主";
    /* 結束的團:只剩花費(團主,和團主勾了記帳的副團主);行程、交通、許願全部鎖住 */
    const can = b => (trip.ended && b !== "cost") ? false : owner || (deputy && !!trip.can[b]);
    return { code, trip, members, mine, role, asMember, owner, deputy, can };
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
                              start: t.start, end: t.end, role: m.role, hidden: t.hidden && !isAdmin(me.sub) });
        }
        trips.sort((a, b) => String(b.start || "").localeCompare(String(a.start || "")));
        return res.status(200).json({ trips, admin: isAdmin(me.sub) });
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
      if (!isAdmin(me.sub)) {
        const owned = mine.filter(m => m.role === "團主");
        let open = 0;
        for (const m of owned) { const t = await findTrip(m.trip); if (t && !t.ended) open++; }
        if (open >= TRIPS_PER_PERSON) {
          return res.status(429).json({ why: "trips", error: "你已經有 " + TRIPS_PER_PERSON + " 團還沒結束,等其中一團旅行結束後才能再開新的" });
        }
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
     PATCH → 團主改團名、國家、城市、日期、匯率、基金、副團主和副團主能動的三塊。 */
  if (resource === "team") {
    if (!allow("GET", "PATCH")) return;
    try {
      const c = await context(q.t);
      if (c.stop) return stop(c.stop);
      if (method === "GET") {
        const { page, ...trip } = c.trip;
        /* 今天換過了 → 畫面講「台灣時間幾點之後才能再換」 */
        trip.deputyLocked = sameGoogleDay(trip.deputyAt);
        trip.deputyNext = trip.deputyLocked ? nextReset() : "";
        return res.status(200).json({
          trip,
          members: c.members.map(memberPublic),
          /* role 是「現在算你是什麼」(測試環境切成成員的話是成員);realRole 是你在團裡真正的角色,
             畫面靠它決定要不要畫「切回團主」。dev 為真時才畫那顆切換鈕 —— 正式站不會有。 */
          me: { ...memberPublic(c.mine), role: c.role, realRole: c.mine.role, invite: c.mine.invite, seenAt: c.mine.seenAt || "" },
          dev: DEV,
          admin: isAdmin(me.sub),   /* 最高權限:選單多一顆「管理所有團」 */
          viewAs: c.asMember ? "member" : "",
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
        /* **延長日期只能在旅程裡做**(2026-10-01,Lulu):開始之前隨便改;開始之後第一天不能動、
           最後一天只能往後延;結束之後就不能再改(團不會再打開) */
        if (c.trip.ended && (start !== c.trip.start || end !== c.trip.end)) return res.status(403).json({ why: "ended", error: "這一團已經結束了,日期不能再改" });
        if (c.trip.started && start !== c.trip.start) return res.status(400).json({ error: "旅程已經開始了,第一天不能再改" });
        if (c.trip.started && end < c.trip.end) return res.status(400).json({ error: "旅程已經開始了,最後一天只能往後延" });
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
        for (const [k, col] of [["plan", "副團主可管行程"], ["cost", "副團主可管記帳"], ["seat", "副團主可管交通"]]) {
          if (body.can[k] !== undefined) props[col] = { checkbox: !!body.can[k] };
        }
      }
      /* ---- 副團主(2026-10-01)----
         一團 1 位,只有團主能指派。**每天只能換一次**(一天 = 台灣 15:00 到隔天 15:00):
         換人、取消都算一次;**第一次指派不算**(還沒有副團主、今天也沒換過的時候)。
         換上來的人權限和 AI 次數馬上生效;換下去的人馬上變回一般成員。 */
      let deputyChange = null;
      if (body.deputy !== undefined) {
        const want = String(body.deputy || "");
        const current = c.members.find(m => m.role === "副團主") || null;
        const target = want ? c.members.find(m => m.id === want) : null;
        if (want && !target) return res.status(400).json({ error: "這一團沒有這個人" });
        if (target && target.role === "團主") return res.status(400).json({ error: "團主不能兼副團主" });
        if ((current ? current.id : "") !== want) {
          if (sameGoogleDay(c.trip.deputyAt)) {
            return res.status(409).json({ why: "deputy_today",
              error: "今天已經換過副團主了,台灣時間 " + twClock(nextReset()) + " 之後才能再換" });
          }
          deputyChange = { current, target };
          /* 有人被換掉(或取消)才算用掉今天那一次;第一次指派不算 */
          if (current) props["副團主換人時間"] = { date: { start: new Date().toISOString() } };
        }
      }
      if (!Object.keys(props).length && !deputyChange) return res.status(400).json({ error: "沒有要改的東西" });
      if (Object.keys(props).length) await notion("/pages/" + c.trip.page, { method: "PATCH", body: JSON.stringify({ properties: props }) });
      if (deputyChange) {
        const setRole = (m, role) => notion("/pages/" + m.page, { method: "PATCH", body: JSON.stringify({ properties: { "角色": { select: { name: role } } } }) });
        if (deputyChange.current) await setRole(deputyChange.current, "成員");
        if (deputyChange.target) await setRole(deputyChange.target, "副團主");
      }
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
  /* ================= 最高權限:所有的團(2026-10-02) =================
     GET  → 所有的團(名稱、代號、日期、團主、幾個人、隱藏了沒)
     POST { code, action: "hide" | "unhide" | "delete", confirm }
       delete 要 confirm 打一樣的團名;團和它的成員、行程、許願、花費、交通、座位全部丟進 Notion 垃圾桶
       (30 天內可以在 Notion 救回來)。 */
  if (resource === "admin") {
    if (!allow("GET", "POST")) return;
    if (!me) return stop({ status: 401, why: "login", error: "請先用 LINE 登入" });
    if (!isAdmin(me.sub)) return res.status(403).json({ error: "只有最高權限能用" });
    try {
      if (method === "GET") {
        const pages = [];
        let cursor;
        do {
          const page = await notion("/databases/" + DB.trips + "/query", { method: "POST",
            body: JSON.stringify({ page_size: 100, start_cursor: cursor, sorts: [{ property: "開始日", direction: "descending" }] }) });
          pages.push(...page.results);
          cursor = page.has_more ? page.next_cursor : null;
        } while (cursor);
        const trips = [];
        for (const pg of pages) {
          const t = tripOut(pg), ms = await membersOf(t.code);
          const boss = ms.find(m => m.role === "團主");
          trips.push({ code: t.code, name: t.name, country: t.country, city: t.city, start: t.start, end: t.end,
                       ended: t.ended, hidden: t.hidden, owner: boss ? boss.name : "", people: ms.length });
        }
        return res.status(200).json({ trips });
      }
      const code = codeOf(body.code), action = String(body.action || "");
      const trip = code ? await findTrip(code) : null;
      if (!trip) return res.status(404).json({ error: "沒有這一團,或它已經被刪掉了" });
      if (action === "hide" || action === "unhide") {
        await notion("/pages/" + trip.page, { method: "PATCH", body: JSON.stringify({ properties: { "隱藏": { checkbox: action === "hide" } } }) });
        return res.status(200).json({ ok: true, hidden: action === "hide" });
      }
      if (action !== "delete") return res.status(400).json({ error: "不知道要做什麼" });
      if (String(body.confirm || "").trim() !== trip.name) return res.status(400).json({ error: "團名打得不一樣,沒有刪" });
      /* 先丟這一團的每一列,最後才丟「團」那一列 —— 中途斷掉的話團還在,可以再按一次刪乾淨 */
      let n = 0;
      for (const db of [DB.expenses, DB.itinerary, DB.seats, DB.flights, DB.activity, DB.members]) {
        let cursor;
        const ids = [];
        do {
          const page = await notion("/databases/" + db + "/query", { method: "POST",
            body: JSON.stringify({ page_size: 100, start_cursor: cursor, filter: { property: "團", rich_text: { equals: code } } }) });
          page.results.forEach(x => ids.push(x.id));
          cursor = page.has_more ? page.next_cursor : null;
        } while (cursor);
        for (const id of ids) { await notion("/pages/" + id, { method: "PATCH", body: JSON.stringify({ archived: true }) }); n++; }
      }
      await notion("/pages/" + trip.page, { method: "PATCH", body: JSON.stringify({ archived: true }) });
      return res.status(200).json({ ok: true, deleted: n });
    } catch (e) {
      return res.status(502).json({ error: "Notion 那邊出錯了:" + e.message });
    }
  }

  if (resource === "join") {
    if (!allow("GET", "POST")) return;
    if (!me) return stop({ status: 401, why: "login", error: "請先用 LINE 登入" });
    const code = codeOf(method === "GET" ? q.t : body.trip);
    const invite = String((method === "GET" ? q.code : body.invite) || "").trim().toLowerCase();
    if (!code) return res.status(400).json({ error: "團的代號不對" });
    try {
      const trip = await findTrip(code);
      if (!trip) return stop({ status: 404, why: "no_trip", error: "沒有這一團,或它已經被刪掉了" });
      if (trip.hidden && !isAdmin(me.sub)) return stop({ status: 403, why: "hidden", error: HIDDEN });
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
      /* 「有新成員加入」的通知看過了:時間由伺服器蓋,不收前端給的 */
      if (body.seen === true) props["通知已讀"] = { date: { start: new Date().toISOString() } };
      if (!Object.keys(props).length) return res.status(400).json({ error: "沒有要改的東西" });
      await notion("/pages/" + c.mine.page, { method: "PATCH", body: JSON.stringify({ properties: props }) });
      const fresh = (await membersOf(c.code)).find(m => m.id === c.mine.id);
      return res.status(200).json({ me: { ...memberPublic(fresh), invite: fresh.invite, seenAt: fresh.seenAt || "" } });
    } catch (e) { return fail(e); }
  }

  /* **Places UI Kit 的瀏覽器金鑰**(2026-10-02)。它本來就是公開的金鑰(會放在網頁上、靠網址白名單保護),
     但網站是純靜態頁、沒有 build,所以由這裡轉交;一樣要登入才拿得到。沒設就回空的,前端說強力搜現在不能用 */
  if (resource === "mapskey") {
    if (!allow("GET")) return;
    if (!me) return stop({ status: 401, why: "login", error: "請先用 LINE 登入" });
    return res.status(200).json({ key: process.env.GOOGLE_MAPS_BROWSER_KEY || "" });
  }
  /* ---------- 小鈴鐺的動態(2026-10-02,Lulu) ----------
     GET → 這一團最近的動態,**只回給你看的**:不含你自己做的;「給誰」有寫的(新帳)只給那幾個人。
     你加入之前的不回。 */
  if (resource === "activity") {
    if (!allow("GET")) return;
    try {
      const c = await context(q.t);
      if (c.stop) return stop(c.stop);
      const page = await notion("/databases/" + DB.activity + "/query", { method: "POST", body: JSON.stringify({
        page_size: 60, filter: { property: "團", rich_text: { equals: c.code } },
        sorts: [{ timestamp: "created_time", direction: "descending" }] }) });
      const mineId = c.mine.id, since = c.mine.joinedAt || "";
      const rows = page.results.map(pg => {
        const p = pg.properties;
        return { id: pg.id, text: ttl(p["說明"]), kind: sel(p["類型"]), by: txt(p["誰"]), day: txt(p["日"]),
                 to: ids(txt(p["給誰"]).split(",")), at: pg.created_time };
      }).filter(x => x.by !== mineId && (!x.to.length || x.to.indexOf(mineId) >= 0) && (!since || x.at >= since))
        .map(({ to, ...x }) => x);
      return res.status(200).json({ rows });
    } catch (e) {
      /* 表還沒接上 integration 之類的:鈴鐺照常(只是沒有動態),不要讓整頁壞掉 */
      return res.status(200).json({ rows: [], error: String(e.message || e) });
    }
  }

  const shape = SHAPES[resource];
  if (!shape) return res.status(400).json({ error: "不認識的資料表:" + resource });

  /* 哪一張表對應團主開的哪一個開關。**沒列在這裡的東西成員一律動不了** ——
     新增一張表的人要自己決定它屬於哪一塊,而不是預設放行。 */
  const BUCKET = { itinerary: "plan", expenses: "cost", seats: "seat", flights: "seat" };

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

    /* ---------- 記一筆動態(小鈴鐺用) ----------
       **記不進去不能讓存檔失敗** —— 動態是附帶的,行程、帳才是正事。 */
    const nm = id => { const m = c.members.find(x => x.id === id); return m ? m.name : "某人"; };
    const me2 = c.mine.name;
    const dayOf = d => {
      if (!d) return "";
      const n = c.trip.start ? Math.round((Date.parse(d) - Date.parse(c.trip.start)) / 864e5) + 1 : 0;
      return (n >= 1 ? "Day " + n + "(" : "(") + Number(d.slice(5, 7)) + "/" + Number(d.slice(8, 10)) + ")";
    };
    const money = (amt, cur) => (cur === "TWD" ? "NT$" : "¥") + Math.round(Number(amt) || 0).toLocaleString("en-US");
    const clock = v => (v ? String(v).slice(5, 16).replace("-", "/").replace("T", " ") : "沒填");
    const said = v => "「" + String(v || "").slice(0, 40) + "」";
    async function log(kind, text, extra) {
      try {
        const e = extra || {};
        await notion("/pages", { method: "POST", body: JSON.stringify({ parent: { database_id: DB.activity }, properties: {
          "說明": { title: richText(text.slice(0, 300)) }, "團": { rich_text: richText(c.code) },
          "誰": { rich_text: richText(c.mine.id) }, "類型": { select: { name: kind } },
          "給誰": { rich_text: richText((e.to || []).join(",")) }, "日": { rich_text: richText(e.day || "") } } }) });
      } catch (_) { /* 少一則通知 */ }
    }
    /* 改了什麼:只比這次有送的欄位,值用**存進去之後**的(送來的字可能被整理過,例如時間格式不對就是沒填) */
    function diffs(was, now, fields, sent) {
      const out = [];
      for (const [k, label, fmt] of fields) {
        if ((sent || now)[k] === undefined) continue;
        const a = was[k] == null ? "" : String(was[k]), b = now[k] == null ? "" : String(now[k]);
        if (a === b) continue;
        const f = fmt || (x => x || "空的");
        out.push(label + " " + f(a) + " → " + f(b));
      }
      return out;
    }
    const legName = f => (f.kind && f.kind !== "飛機" ? f.kind + " " : "") + (f.no || "") + (f.from || f.to ? "(" + (f.from || "?") + "→" + (f.to || "?") + ")" : "");

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
       改內容和刪掉:許願的人自己、團主、或團主勾了「行程」的副團主。 */
    if (resource === "wishes") {
      const mineId = c.mine.id;
      if (c.trip.ended) return res.status(403).json({ why: "ended", error: "這一團已經結束了,不能再許願或投票" });
      if (method === "POST") {
        const props = shape.in({ ...body, by: mineId, votes: ids(body.votes).filter(v => v === mineId) });
        const page = await notion("/pages", { method: "POST",
          body: JSON.stringify({ parent: { database_id: shape.db }, properties: withTrip(props) }) });
        await log("許願", me2 + " 許願:" + said(body.title || "想去的地方"));
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
          await log("許願", me2 + " 刪掉了願望" + said(now.title));
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
          note: keep(body.note, now.note), by: now.by, votes, placeId: keep(body.placeId, now.placeId),
        });
        const saved = await notion("/pages/" + page.id, { method: "PATCH", body: JSON.stringify({ properties: props }) });
        /* +1 不通知(太吵);改內容才講 */
        if (wantsEdit) {
          const ch = diffs(now, body, [["title", "名稱"], ["place", "地點"], ["note", "備註"]]);
          if (ch.length) await log("許願", me2 + " 改了願望" + said(now.title) + ":" + ch.join("、"));
        }
        return res.status(200).json({ row: shape.out(saved) });
      }
      res.setHeader("Allow", "GET, POST, PATCH, DELETE");
      return res.status(405).json({ error: "不支援的方法" });
    }

    /* ---------- 行程、花費、座位 ---------- */
    const b = BUCKET[resource];
    if (!b || !c.can(b)) return res.status(403).json({ error: "這一塊目前只有團主動得了" });

    if (method === "POST") {
      const props = withTrip(shape.in(body));
      /* **手機離線時記的帳,連上網才送**(見 index.html「還沒送出的花費」)。在地鐵裡送到一半斷線,
         手機不知道這裡收到沒有,會再送一次 —— 靠「送出編號」認出同一筆,不記成兩筆。
         「花費」表還沒有這一欄的時候照舊直接建(重送的那一刻有機會重複,但不會壞)。 */
      const cid = resource === "expenses" && /^[a-z0-9]{6,40}$/.test(String(body.cid || "")) ? String(body.cid) : "";
      if (cid && await hasCidCol()) {
        const hit = await notion("/databases/" + shape.db + "/query", { method: "POST", body: JSON.stringify({
          page_size: 1,
          filter: { and: [{ property: "團", rich_text: { equals: c.code } }, { property: "送出編號", rich_text: { equals: cid } }] },
        }) });
        if (hit.results[0]) return res.status(200).json({ row: shape.out(hit.results[0]), again: true });
        props["送出編號"] = { rich_text: richText(cid) };
      }
      const page = await notion("/pages", { method: "POST",
        body: JSON.stringify({ parent: { database_id: shape.db }, properties: props }) });
      const row = shape.out(page);
      if (resource === "itinerary") await log("行程", me2 + " 在 " + dayOf(row.day) + " 加了" + said(row.title) + (row.time ? " " + row.time : ""), { day: row.day });
      if (resource === "flights") await log("交通", me2 + " 加了交通:" + legName(row) + (row.depart ? " " + clock(row.depart) : ""));
      if (resource === "seats") await log("交通", me2 + " 填了" + nm(row.passenger) + "在 " + row.flight + " 的座位:" + (row.seat || "空的"));
      if (resource === "expenses" && row.participants && row.participants.length) {
        const n = row.participants.length;
        await log("花費", me2 + " 記了一筆" + said(row.title) + " " + money(row.amount, row.currency) + "," + n + " 人分(每人約 " + money(row.amount / n, row.currency) + ")", { to: row.participants });
      }
      return res.status(200).json({ row });
    }
    if (method === "PATCH") {
      const page = await rowOf(q.id);
      if (!page) return gone();
      const was = shape.out(page);
      const saved = await notion("/pages/" + page.id, { method: "PATCH",
        body: JSON.stringify({ properties: shape.in(body) }) });
      const row = shape.out(saved);
      if (resource === "itinerary") {
        if (!was.day && row.day) await log("行程", me2 + " 把願望" + said(row.title) + "排進 " + dayOf(row.day) + (row.time ? " " + row.time : ""), { day: row.day });
        else if (was.day && body.day === null) await log("行程", me2 + " 把 " + dayOf(was.day) + said(was.title) + "退回許願", { day: was.day });
        else {
          const ch = diffs(was, row, [["title", "名稱"], ["day", "日期", x => (x ? dayOf(x) : "沒排")], ["time", "時間"], ["place", "地點"], ["note", "備註"]], body);
          if (ch.length) await log("行程", me2 + " 改了 " + dayOf(was.day) + said(was.title) + ":" + ch.join("、"), { day: row.day || was.day });
        }
      }
      if (resource === "flights") {
        const ch = diffs(was, row, [["no", "班次"], ["kind", "種類"], ["depart", "出發", clock], ["arrive", "抵達", clock], ["from", "從"], ["to", "到"], ["airline", "公司"], ["code", "訂位代號"], ["note", "備註"]], body);
        if (ch.length) await log("交通", me2 + " 改了交通 " + legName(was) + ":" + ch.join("、"));
      }
      if (resource === "seats" && body.seat !== undefined && String(was.seat || "") !== String(row.seat || ""))
        await log("交通", me2 + " 改了" + nm(row.passenger) + "在 " + row.flight + " 的座位:" + (was.seat || "空的") + " → " + (row.seat || "空的"));
      if (resource === "expenses") {
        const ch = diffs(was, row, [["title", "項目"], ["amount", "金額", x => money(x, row.currency)], ["date", "日期"]], body);
        const who = Array.from(new Set([].concat(was.participants || [], row.participants || [])));
        const moved = JSON.stringify((was.participants || []).slice().sort()) !== JSON.stringify((row.participants || []).slice().sort());
        if (moved) ch.push("分的人改成 " + (row.participants || []).map(nm).join("、"));
        if (ch.length && who.length) await log("花費", me2 + " 改了帳" + said(was.title) + ":" + ch.join("、"), { to: who });
      }
      return res.status(200).json({ row });
    }
    if (method === "DELETE") {
      const page = await rowOf(q.id);
      if (!page) return gone();
      const was = shape.out(page);
      await notion("/pages/" + page.id, { method: "PATCH", body: JSON.stringify({ archived: true }) });
      if (resource === "itinerary") await log("行程", me2 + " 刪掉了 " + dayOf(was.day) + said(was.title), { day: was.day });
      if (resource === "flights") await log("交通", me2 + " 刪掉了交通:" + legName(was));
      if (resource === "expenses" && (was.participants || []).length) await log("花費", me2 + " 刪掉了帳" + said(was.title) + " " + money(was.amount, was.currency), { to: was.participants });
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ error: "不支援的方法" });
  } catch (e) {
    return fail(e);
  }
};
