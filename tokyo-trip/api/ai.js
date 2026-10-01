// Trippps · AI 按鈕
//
// 使用者丟一段話、一張圖(或兩個都有),這支請 Gemini 判斷「這是要建哪一種資料」,
// 照那一種的欄位回 JSON:許願、某一天的行程、或一段交通(連座位)。
//
// **只負責「讀懂」,不碰 Notion。** 結果回到前端的確認卡,人看過、按了「確定」,
// 才走 api/notion.js 原本那幾條寫入的路 —— 權限也還是那幾條路在管
// (許願誰都能加;行程和座位要通行碼)。AI 判斷錯了,攔住它的是按確定的那個人。
//
// 需要的環境變數:
//   GEMINI_KEY   Google AI Studio 的 API 金鑰(免費方案即可)
//
// **要登入才能用**(第 2 期起)。以前不擋,是因為沒有通行碼的人也要能用它許願;
// 現在每個人都是登入的,不擋就是把免費額度開給知道網址的任何人。

const S = require("./_session.js");
const U = require("./_usage.js");

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/";

/* 依序嘗試,**先用額度最多的**。額度照 AI Studio 的 Rate Limit 頁(Lulu 2026-09-30 存的那一份,
   專案「Trippps Gemini AI」、免費方案):
     3.5 / 3.1 Flash-Lite   每天 500 次、每分鐘 15 次   ← 主力
     3.8 Flash              每天  20 次、每分鐘  5 次
     後面六個(2026-09-30 加):每天各 20 次,每分鐘 5 次(2.5 Flash-Lite 是 10 次)
   前一個額度用完(429)、太忙(5xx)或模型不存在(404)才換下一個。

   **後面六個是備用,不是主力。** 加它們的理由是 3.8 Flash 過去 28 天最忙的一天用到 14/20 ——
   它只在前兩個失敗時才輪到,代表那天前兩個常常「太忙」,整個重量壓在一個每天 20 次的模型上。
   多六個,每天多約 120 次,也多六次「換一個試試」的機會。順序:新的、強的在前。
   Gemma 4(每天 14,400 次)沒有加:每分鐘只收 16K 字量,一張截圖就可能超過,讀圖和照格式回答也沒測過。 */
const MODELS = [
  "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash",
  "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3-flash",
  "gemini-2.5-flash", "gemini-2.5-flash-lite",
];

const MAX_B64 = 3_000_000;   /* 前端送來的是縮過的 JPEG,正常 1MB 以內;這是防呆 */

/* **等多久就放棄。** 沒有上限的話,Google 那邊不回應,畫面就一直停在
   「AI 讀取中…」,直到 Vercel 在 30 秒把整個函式砍掉 —— 使用者看到的是
   「按了之後就卡住」,而那是最難判斷該不該再按一次的一種壞法。
   單次 10 秒:正常一兩秒就回來,10 秒是三四倍,夠寬。
   總共 22 秒:不管排了幾個模型,時間到就停,不會撞到函式本身的 30 秒上限
   (模型多了之後,全部都忙的時候後面幾個輪不到 —— 那是對的,使用者不該等超過二十幾秒)。 */
const CALL_MS = 10_000;
const TOTAL_MS = 22_000;
const MAX_TEXT = 1000;
/* Google 說太忙的時候,等這麼久再問同一個模型一次(再加一點隨機,免得大家同一刻一起重試) */
const BUSY_WAIT_MS = 1500;
const nap = ms => new Promise(r => setTimeout(r, ms));

/* **這一團的事實由前端帶來**(日期、成員、已經有的交通)。以前這裡寫死東京五人行的
   六天、五個人、兩班樂桃 —— 第 2 期一團一個網址之後,別團用 AI 時「第 3 天」和座位上的人
   全部對錯(2026-09-28 串交通時發現)。前端送什麼都不直接信:格式、數量在 tripCtx 再過一次。 */
const KINDS = ["飛機", "火車", "巴士", "船", "租車"];
const DIRS = ["去程", "回程", "其他"];
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MIN = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;
const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const legNo = v => String(v || "").toUpperCase().replace(/\s+/g, "");
function tripCtx(c) {
  c = c && typeof c === "object" ? c : {};
  const arr = v => (Array.isArray(v) ? v : []);
  const days = arr(c.days).filter(d => typeof d === "string" && ISO_DAY.test(d)).slice(0, 60);
  const members = arr(c.members).map(m => ({ id: str(m && m.id, 60), name: str(m && m.name, 20) }))
    .filter(m => m.id).slice(0, 30);
  const legs = arr(c.legs).map(l => ({
    id: str(l && l.id, 60), kind: KINDS.indexOf(l && l.kind) >= 0 ? l.kind : "飛機", no: str(l && l.no, 30),
    date: l && typeof l.date === "string" && ISO_DAY.test(l.date) ? l.date : "", from: str(l && l.from, 40), to: str(l && l.to, 40),
  })).filter(l => l.id).slice(0, 40);
  const t = c.trip && typeof c.trip === "object" ? c.trip : {};
  return { days, members, legs, trip: { code: /^[a-z0-9_-]{1,40}$/.test(String(t.code || "")) ? t.code : "", name: str(t.name, 40), country: str(t.country, 10), city: str(t.city, 30) },
    today: typeof c.today === "string" ? c.today.slice(0, 10) : "", dayN: days.indexOf(c.day) + 1 };
}

/* 一段交通長這樣。**一次可以讀好幾段**(Lulu,2026-09-28:文字寫去程、圖是回程,
   以前只能回一段,另一段就不見了)。 */
const LEG = {
  type: "OBJECT",
  properties: {
    kind:    { type: "STRING", enum: KINDS.concat(["unknown"]), description: "哪一種交通;看不出來就 unknown" },
    no:      { type: "STRING", description: "航班號/車次/班次,照票上寫的(例如 MM626、のぞみ 21號);租車或看不到就空字串" },
    company: { type: "STRING", description: "航空公司、鐵路公司、客運、船公司或租車公司" },
    depart:  { type: "STRING", description: "出發(租車是取車)的當地日期時間 YYYY-MM-DDTHH:MM;日期或時間看不到就空字串" },
    from:    { type: "STRING", description: "從哪裡(機場寫成「TPE 桃園 T1」這種三碼開頭的寫法;車站、碼頭、取車店名)" },
    arrive:  { type: "STRING", description: "抵達(租車是還車)的當地日期時間 YYYY-MM-DDTHH:MM;看不到就空字串" },
    to:      { type: "STRING", description: "到哪裡(寫法同 from)" },
    code:    { type: "STRING", description: "訂位代號、訂單編號;沒有就空字串" },
    dir:     { type: "STRING", enum: DIRS.concat(["unknown"]), description: "去程=從家出發往目的地的第一段,回程=回家的那一段,其他=路上的一段;不確定就 unknown" },
    /* **代號不做成選項清單**(成員、已經有的交通都是):一長串 UUID 當 enum 有讓 Gemini 撐不住的疑慮,
       改成一般字串,clean() 只收名單上有的。 */
    match:   { type: "STRING", description: "如果這一段已經在「已經有的交通」裡(同一班、同一天),填它的 id;否則 none" },
    note:    { type: "STRING", description: "這一段值得記下的細節(行李額度、要先換票等),100 字以內;沒有就空字串" },
    seats:   { type: "ARRAY", description: "每個人的座位(看得到才填)",
               items: { type: "OBJECT", properties: {
                 member: { type: "STRING", description: "旅客代號(照「旅客」那一行);對不上就 unknown" },
                 seat:   { type: "STRING", description: "座位,照票上寫的,例如 27A、7車 12A" },
               }, required: ["member", "seat"] } },
  },
  required: ["kind", "no", "company", "depart", "from", "arrive", "to", "code", "dir", "match", "note", "seats"],
};
function schema(ctx) {
  return {
    type: "OBJECT",
    properties: {
      intent:  { type: "STRING", enum: ["wish", "stop", "transport", "expense", "unknown"],
                 description: "wish=想去的地方加進許願;stop=排進某一天的行程;transport=交通(機票、車票、船票、租車、座位);expense=一筆花費(收據、帳單、發票、刷卡紀錄、「晚餐 6000 日幣」);unknown=看不出來" },
      title:   { type: "STRING", description: "wish/stop:地點或活動名稱,用可以拿去地圖搜尋的寫法(店名、景點名、車站名),30 字以內;其他情況空字串" },
      day:     { type: "INTEGER", description: "stop:第幾天(1–" + (ctx.days.length || 1) + ");沒說就 0" },
      time:    { type: "STRING", description: "stop:開始時間 HH:MM(24 小時制);看不到就空字串" },
      note:    { type: "STRING", description: "wish/stop:值得記下的細節(營業時間、要預約等),100 字以內;沒有就空字串" },
      /* 記帳(2026-10-01):AI 讀收據/帳單/一句話,打開「記一筆」填好,人看過再存 */
      amount:  { type: "NUMBER", description: "expense:總金額(收據上的合計,含稅);看不出來就 0" },
      currency:{ type: "STRING", enum: ["JPY", "TWD", "unknown"], description: "expense:幣別;日圓 JPY、台幣 TWD;看不出來 unknown" },
      date:    { type: "STRING", description: "expense:消費日期 YYYY-MM-DD;看不出來就空字串" },
      category:{ type: "STRING", enum: ["交通", "住宿", "餐飲", "景點", "購物", "其他"], description: "expense:分類" },
      legs:    { type: "ARRAY", description: "transport:讀到的每一段交通,照時間先後;文字和圖片講的是不同段就各列一段。不是交通就空陣列", items: LEG },
      message: { type: "STRING", description: "給使用者的一句話:判斷的理由,或還缺什麼資訊。繁體中文,40 字以內" },
    },
    required: ["intent", "title", "day", "time", "note", "amount", "currency", "date", "category", "legs", "message"],
  };
}

function prompt(text, ctx) {
  const days = ctx.days.map((d, i) => "第 " + (i + 1) + " 天 = " + d).join("、") || "(還沒有日期)";
  const people = ctx.members.map(m => m.id + "(" + (m.name || "?") + ")").join("、") || "(沒有名單)";
  const legs = ctx.legs.map(l => l.id + ":" + l.kind + " " + (l.no || "(沒有班次)") + " " + (l.date || "?") + " " + l.from + " → " + l.to).join(";") || "(還沒有)";
  const where = [ctx.trip.country, ctx.trip.city].filter(Boolean).join(" ");
  return [
    "你是旅行網站 Trippps 的助手。這一團是「" + (ctx.trip.name || "未命名") + "」" + (where ? ",去 " + where : "") + "。",
    "使用者丟給你一段話和/或一張圖(常見的是 Google 地圖截圖、訂位確認、票券、登機證、座位表、租車確認信),",
    "請判斷他要建立哪一種資料,並讀出欄位。",
    "",
    "判斷規則:",
    "- 使用者說「許願」「想去」「有空去」→ wish。",
    "- 使用者說「加到第幾天」「排進行程」「幾號去」→ stop。餐廳、門票的訂位確認上有日期,也算 stop,用日期換算第幾天。",
    "- 機票、登機證、車票(新幹線、JR、高鐵、台鐵)、巴士票、船票、租車確認、座位表、選位畫面 → transport。",
    "- 收據、帳單、發票、刷卡紀錄,或「晚餐花了 6000 日幣」這種花了多少錢的話 → expense。title 寫店名或買了什麼(15 字以內),amount 寫合計。",
    "  kind:航班 → 飛機;新幹線、JR、鐵路、高鐵、台鐵、地鐵特急 → 火車;高速巴士、客運 → 巴士;渡輪、船 → 船;租車 → 租車。",
    "  時間一律寫票上的當地時間,不要換時區。票上只有時間、看不出日期,就把 depart/arrive 留空。",
    "  **一次可能有好幾段**(去程和回程、轉乘的每一段、文字講一段圖片又是另一段):每一段在 legs 各列一筆。",
    "- 使用者的話優先於圖片的樣子。都看不出來 → unknown,並在 message 說還需要什麼。",
    "- 看不清楚的欄位留空,不要猜。",
    "",
    "旅程:" + days + "。今天是 " + (ctx.today || "未知") + "。使用者目前在看第 " + (ctx.dayN || "?") + " 天。",
    "旅客:" + people + "。座位的 member 要填這裡的代號(看名字或護照拼音對);對不上的填 unknown。",
    "已經有的交通:" + legs + "。",
    "",
    "使用者說:" + (text || "(沒有打字,只有圖片)"),
  ].join("\n");
}

/* `soft` 的意思是「這句話可以直接給使用者看」—— 下面回應的時候不加前綴。
   `retry` 的意思是「換下一個模型再試一次有機會成功」。 */
function softErr(msg, retry) {
  const e = new Error(msg);
  e.soft = true;
  e.retry = !!retry;
  return e;
}

async function ask(model, parts, msLeft, SCHEMA) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Math.max(1000, Math.min(CALL_MS, msLeft)));
  let res;
  try {
    res = await fetch(ENDPOINT + model + ":generateContent", {
      method: "POST",
      signal: ac.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0 },
      }),
    });
  } catch (e) {
    if (e && e.name === "AbortError") throw softErr("AI 太久沒回應,再試一次", true);
    throw e;
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((body.error && body.error.message) || "Gemini 回應 " + res.status);
    err.status = res.status;
    throw err;
  }
  const out = ((((body.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || "").join("");
  /* **模型偶爾會回不是 JSON 的東西**(截斷、前後多一段說明)。
     不接的話,`JSON.parse` 丟出來的是 `Unexpected token <` 這種給工程師看的字,
     而它會原封不動出現在使用者眼前 —— 看的人只知道壞了,不知道該不該再按一次。 */
  try {
    return JSON.parse(out);
  } catch (_) {
    throw softErr("AI 這次沒讀懂,再按一次試試", true);
  }
}

/* 模型回什麼都不直接信:型別、格式、範圍在這裡再過一次,
   前端拿到的一定是確認卡、交通表單填得進去的值。 */
function cleanLeg(f, ctx) {
  const s = str;
  f = f && typeof f === "object" ? f : {};
  const kind = KINDS.indexOf(f.kind) >= 0 ? f.kind : "";
  const ids = ctx.members.map(m => m.id);
  const all = (Array.isArray(f.seats) ? f.seats : [])
    /* 座位不檢查格式(Lulu,2026-09-30:輸入什麼就是什麼)—— 票上寫什麼就留什麼 */
    .map(x => ({ member: ids.includes(x && x.member) ? x.member : "", seat: s(x && x.seat, 12) }))
    .filter(x => x.seat);
  const seats = all.filter(x => x.member);
  /* 票上有、團裡還沒有的乘客(Lulu:不記,等他加入後團主自己填)—— 只回個數,讓畫面講一聲 */
  const others = all.length - seats.length;
  const depart = ISO_MIN.test(s(f.depart, 16)) ? s(f.depart, 16) : "";
  const no = s(f.no, 30);
  /* 「這一段已經有了」:模型說的 id 要真的在名單上;模型沒說,就用種類 + 班次 + 日期自己對一次 */
  let match = ctx.legs.some(l => l.id === f.match) ? f.match : "";
  if (!match && no) {
    const same = ctx.legs.filter(l => (!kind || l.kind === kind) && legNo(l.no) === legNo(no));
    const hit = same.find(l => depart && l.date === depart.slice(0, 10)) || (!depart && same.length === 1 ? same[0] : null);
    if (hit) match = hit.id;
  }
  return {
    kind, no, company: s(f.company, 40), depart,
    from: s(f.from, 40),
    arrive: ISO_MIN.test(s(f.arrive, 16)) ? s(f.arrive, 16) : "",
    to: s(f.to, 40),
    code: s(f.code, 30),
    dir: DIRS.indexOf(f.dir) >= 0 ? f.dir : "",
    match, note: s(f.note, 300), seats, others,
  };
}
/* 模型回什麼都不直接信:型別、格式、範圍在這裡再過一次,
   前端拿到的一定是確認卡、交通表單填得進去的值。 */
function clean(f, ctx) {
  const s = str;
  /* 以前的 seats(只改座位)併進 transport:模型照舊回 seats 也接得住 */
  const intent = f.intent === "seats" ? "transport" : ["wish", "stop", "transport", "expense"].includes(f.intent) ? f.intent : "unknown";
  const day = Number.isInteger(f.day) && f.day >= 1 && f.day <= ctx.days.length ? f.day : 0;
  const t = s(f.time, 5);
  /* 模型偶爾把一段交通攤在最外層(舊的形狀),也接得住 */
  const raw = Array.isArray(f.legs) && f.legs.length ? f.legs : (f.kind || f.no || f.depart ? [f] : []);
  const legs = intent === "transport" ? raw.slice(0, 6).map(x => cleanLeg(x, ctx))
    .filter(l => l.kind || l.no || l.depart || l.from || l.to || l.seats.length) : [];
  return {
    intent,
    title: s(f.title, 60),
    day: day ? ctx.days[day - 1] : "",
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : "",
    note: s(f.note, 300),
    amount: intent === "expense" && typeof f.amount === "number" && isFinite(f.amount) && f.amount > 0 ? Math.round(f.amount * 100) / 100 : 0,
    currency: ["JPY", "TWD"].includes(f.currency) ? f.currency : "",
    date: intent === "expense" && /^\d{4}-\d{2}-\d{2}$/.test(s(f.date, 10)) ? s(f.date, 10) : "",
    category: ["交通", "住宿", "餐飲", "景點", "購物", "其他"].includes(f.category) ? f.category : "",
    legs,
    message: s(f.message, 120),
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  /* **GET = 你今天還能用幾次**(個人漢堡選單、AI 對話框一打開就問,見 _usage.js) */
  if (req.method === "GET") {
    const who = S.whoIs(req);
    if (!who) return res.status(401).json({ error: "請先用 LINE 登入", why: "login" });
    const [m, st] = await Promise.all([U.mine(who.sub), U.strongMine(who.sub)]);
    return res.status(200).json({ mine: m && { left: m.left, limit: m.limit, used: m.used, resetAt: m.resetAt, when: m.when }, strong: st });
  }
  /* **POST ?strong=1 = 要用一次強力搜**(2026-10-02)。Google 的清單是瀏覽器自己載的,伺服器看不到 ——
     所以每次強力搜之前先來這裡記一次,沒次數了就不放行 */
  if (req.method === "POST" && req.query && req.query.strong === "1") {
    const who = S.whoIs(req);
    if (!who) return res.status(401).json({ error: "請先用 LINE 登入", why: "login" });
    /* ?strong=1&refund=1 = 清單出錯,退回剛剛那一次(要帶 strongUse 給的收據) */
    if (req.query.refund === "1") {
      let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (_) { b = {}; } }
      const r = await U.strongRefund(who.sub, b && b.ticket);
      return res.status(r.ok ? 200 : 409).json({ ok: r.ok, strong: r.mine || null });
    }
    const u = await U.strongUse(who.sub);
    if (!u.ok) return res.status(429).json({ why: "strong", strong: u.mine,
      error: "你今天的強力搜用完了," + (u.mine.when || "明天") + "後再用" });
    return res.status(200).json({ ok: true, strong: u.mine, ticket: u.ticket || "" });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "不支援的方法" });
  }
  if (!process.env.GEMINI_KEY) return res.status(503).json({ error: "伺服器還沒設定 GEMINI_KEY" });
  /* **第 2 期起要登入。** 以前不擋,理由是「沒通行碼的人也要能許願」;現在每個用網站的人
     都是登入的,不擋等於把額度開給知道網址的任何人。只看「有沒有登入」,不看在哪一團 ——
     這一支只負責讀懂,存進哪一團、能不能存,是 api/notion.js 的事。 */
  const who = S.whoIs(req);
  if (!who) return res.status(401).json({ error: "請先用 LINE 登入", why: "login" });

  const b = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body) || {};
  const text = typeof b.text === "string" ? b.text.trim().slice(0, MAX_TEXT) : "";
  const image = typeof b.image === "string" ? b.image : "";
  if (!text && !image) return res.status(400).json({ error: "打一段話或放一張圖" });
  if (image.length > MAX_B64) return res.status(413).json({ error: "圖片太大" });
  const ctx = tripCtx(b.context);
  const SCHEMA = schema(ctx);

  /* **每個人每天固定次數**(一般 20、團主和副團主 25,各團共用)。用完就不去問 Google。
     讀不到用量(表壞了、Notion 慢)就不擋 —— 它是提醒兼閘門,但不能讓 AI 跟著壞 */
  /* **結束的團不能用 AI**(2026-10-01,Lulu:要記帳請在旅行期間記完)。查不到團就不擋 */
  const [mine, ended] = await Promise.all([U.mine(who.sub), U.tripEnded(ctx.trip.code)]);
  if (ended) return res.status(403).json({ why: "ended", error: "這一團已經結束了,AI 不能再用" });
  const role = (mine && mine.roles && mine.roles[ctx.trip.code]) || "成員";
  const byModel = {};   /* 這一次按下去,每個模型實際打了幾次、成功了沒、說用完了沒 */
  const tap = model => (byModel[model] = byModel[model] || { ok: 0, calls: 0, out: false });
  const calls = () => Object.values(byModel).reduce((n, t) => n + t.calls, 0);
  /* 記下來再回。**要等它寫完**:回應送出之後函式可能就被收掉,那一筆就沒記到 */
  const done = (result, extra) => Promise.all([
    U.record(Object.assign({ sub: who.sub, trip: ctx.trip.code, role, result, calls: calls() }, extra || {})),
    U.tally(byModel),
  ]);
  if (mine && mine.left <= 0) {
    await done("次數用完");
    return res.status(429).json({ why: "mine", error: "你的 AI 額度用完了," + (mine.when || "明天") + "後再用" });
  }

  const parts = [];
  if (image) parts.push({ inline_data: { mime_type: "image/jpeg", data: image } });
  parts.push({ text: prompt(text, ctx) });

  let last;
  const until = Date.now() + TOTAL_MS;
  /* **Google 說「太忙」(5xx)時,先等一下再問同一個模型一次**,再換下一個(Lulu,2026-09-29:
     正式站一直「AI 太忙」)。Google 自己建議的就是退一下再試;以前是馬上換,
     三個模型在同一秒全部問完,尖峰時三個一起被拒。等的時間夠不夠,看總時限剩多少。 */
  const codes = [];
  models: for (const model of MODELS) {
    for (let n = 0; n < 2; n++) {
      if (until - Date.now() < 1500) break models;   /* 剩下的時間不夠再問一次,就別問了 */
      tap(model).calls++;
      try {
        const result = clean(await ask(model, parts, until - Date.now(), SCHEMA), ctx);
        tap(model).ok++;
        await done("成功", { intent: result.intent, model });
        /* 剩幾次跟著回去:對話框和漢堡選單不必再問一次 */
        const left = mine ? { left: Math.max(0, mine.left - 1), limit: mine.limit, used: mine.used + 1, resetAt: mine.resetAt, when: mine.when } : null;
        return res.status(200).json({ result, model, mine: left });
      } catch (e) {
        last = e;
        if (e.status) codes.push(e.status);
        /* 429 = Google 說這個模型今天沒了 */
        if (e.status === 429) tap(model).out = true;
        if (n === 0 && e.status >= 500 && until - Date.now() > BUSY_WAIT_MS + 4000) {
          await nap(BUSY_WAIT_MS + Math.floor(Math.random() * 500));
          continue;
        }
        break;
      }
    }
    /* **「太忙」也要換一個再試。** Google 回 503「This model is currently
       experiencing high demand」的時候,換一個模型通常就過了 —— 而原本只有
       額度用完(429)和模型不存在(404)會換,忙碌直接放棄,
       使用者拿到的是一句英文,而他什麼都沒做錯。 */
    if (!(last.retry || last.status === 429 || last.status === 404 || last.status >= 500)) break;
  }
  const quota = last && last.status === 429;
  const busy = last && last.status >= 500;
  /* **回給前端的一律是一句完整的中文**,前端直接顯示,不要再包前綴。
     以前這裡會把 Google 的英文原話接在「AI 沒回應成功:」後面,前端再加一個
     「沒成功:」—— 使用者看到的是兩層「失敗」加一句他看不懂的英文,
     而那句英文講的其實是「過幾分鐘再試」。 */
  /* 預覽(不是正式站)把 Google 回的原話接在後面 —— 在預覽上除錯看不到 Vercel 的紀錄,
     只看得到這一句。正式站照舊只講中文。 */
  const why = process.env.VERCEL_ENV !== "production" && last && last.message && !last.soft
    ? "(測試環境才看得到:" + String(last.status || "") + " " + String(last.message).slice(0, 160) + ")" : "";
  /* 失敗的時候附上 Google 回的代碼(只有數字,不是英文原話):之後再有人回報,看得出是哪一種 */
  const tag = codes.length ? "(Google " + Array.from(new Set(codes)).join("/") + ")" : "";
  const msg = (quota ? "今天的 AI 額度用完了,明天再試,或先手動加" + tag
    : busy ? "AI 現在太忙(Google 那邊),過幾分鐘再試一次" + tag
    : last && last.soft ? last.message
    : "AI 這次沒成功,再試一次") + why;
  await done("失敗", { model: Object.keys(byModel).pop() || "" });
  return res.status(quota ? 429 : 502).json({ error: msg });
};
