// Trippps · AI 按鈕
//
// 使用者丟一段話、一張圖(或兩個都有),這支請 Gemini 判斷「這是要建哪一種資料」,
// 照那一種的欄位回 JSON:許願、某一天的行程、或某一班的座位。
//
// **只負責「讀懂」,不碰 Notion。** 結果回到前端的確認卡,人看過、按了「確定」,
// 才走 api/notion.js 原本那幾條寫入的路 —— 權限也還是那幾條路在管
// (許願誰都能加;行程和座位要通行碼)。AI 判斷錯了,攔住它的是按確定的那個人。
//
// 需要的環境變數:
//   GEMINI_KEY   Google AI Studio 的 API 金鑰(免費方案即可)
//
// **這支不要通行碼**:沒有通行碼的人也能用它許願(Lulu 定的規則)。
// 代價是知道網址的人可以用掉免費額度 —— 最壞的情況是那天 AI 按鈕不能用,
// 不會多花錢(免費方案沒有綁卡,額度用完就是 429)。

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/";

/* 依序嘗試,**先用額度最多的**。2026/09 在 AI Studio 的 Rate Limit 頁看到的免費額度:
   Flash-Lite 每天 500 次、每分鐘 15 次;Flash 每天 20 次。
   前一個額度用完(429)或模型不存在(404)才換下一個。 */
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"];

const MAX_B64 = 3_000_000;   /* 前端送來的是縮過的 JPEG,正常 1MB 以內;這是防呆 */

/* **等多久就放棄。** 沒有上限的話,Google 那邊不回應,畫面就一直停在
   「AI 讀取中…」,直到 Vercel 在 30 秒把整個函式砍掉 —— 使用者看到的是
   「按了之後就卡住」,而那是最難判斷該不該再按一次的一種壞法。
   單次 10 秒:正常一兩秒就回來,10 秒是三四倍,夠寬。
   總共 22 秒:三個模型輪完也不會撞到函式本身的 30 秒上限。 */
const CALL_MS = 10_000;
const TOTAL_MS = 22_000;
const MAX_TEXT = 1000;

/* 旅程的基本資料。跟 index.html 的 DAYS / MEMBERS / 航班那段是同一份事實,
   改的時候兩邊一起改。 */
const DAYS = ["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"];
const MEMBERS = [
  { id: "hsieh_chinhui", name: "阿輝", full: "HSIEH CHINHUI" },
  { id: "chang_chiayu",  name: "佳瑜", full: "CHANG CHIAYU" },
  { id: "chang_chihwei", name: "志偉", full: "CHANG CHIHWEI" },
  { id: "chang_yalun",   name: "雅倫", full: "CHANG YALUN" },
  { id: "chen_suchih",   name: "媽",   full: "CHEN SUCHIH" },
];
const FLIGHTS = [
  { no: "MM626", date: "2026-10-03", route: "台北桃園 → 東京成田" },
  { no: "MM631", date: "2026-10-08", route: "東京成田 → 台北桃園" },
];

const SCHEMA = {
  type: "OBJECT",
  properties: {
    intent:  { type: "STRING", enum: ["wish", "stop", "seats", "unknown"],
               description: "wish=想去的地方加進許願;stop=排進某一天的行程;seats=飛機座位;unknown=看不出來" },
    title:   { type: "STRING", description: "wish/stop:地點或活動名稱,用可以拿去地圖搜尋的寫法(店名、景點名、車站名),30 字以內;其他情況空字串" },
    day:     { type: "INTEGER", description: "stop:第幾天(1–6);沒說就 0" },
    time:    { type: "STRING", description: "stop:開始時間 HH:MM(24 小時制);看不到就空字串" },
    note:    { type: "STRING", description: "wish/stop:值得記下的細節(營業時間、訂位代號、要預約等),100 字以內;沒有就空字串" },
    flight:  { type: "STRING", description: "seats:航班號,例如 MM626;看不出來就空字串" },
    seats:   { type: "ARRAY", description: "seats:每個人的座位",
               items: { type: "OBJECT", properties: {
                 member: { type: "STRING", enum: MEMBERS.map(m => m.id).concat(["unknown"]) },
                 seat:   { type: "STRING", description: "座位號碼,例如 27A" },
               }, required: ["member", "seat"] } },
    message: { type: "STRING", description: "給使用者的一句話:判斷的理由,或還缺什麼資訊。繁體中文,40 字以內" },
  },
  required: ["intent", "title", "day", "time", "note", "flight", "seats", "message"],
};

function prompt(text, ctx) {
  const days = DAYS.map((d, i) => "第 " + (i + 1) + " 天 = " + d).join("、");
  const people = MEMBERS.map(m => m.id + "(" + m.name + ",護照拼音 " + m.full + ")").join("、");
  const flights = FLIGHTS.map(f => f.no + " " + f.date + " " + f.route).join(";");
  return [
    "你是一個五人東京旅行網站的助手。使用者丟給你一段話和/或一張圖(常見的是 Google 地圖截圖、",
    "訂位確認、票券、座位表、登機證),請判斷他要建立哪一種資料,並讀出欄位。",
    "",
    "判斷規則:",
    "- 使用者說「許願」「想去」「有空去」→ wish。",
    "- 使用者說「加到第幾天」「排進行程」「幾號去」→ stop。訂位確認上有日期,也算 stop,用日期換算第幾天。",
    "- 圖是座位表、登機證、選位畫面 → seats。",
    "- 使用者的話優先於圖片的樣子。都看不出來 → unknown,並在 message 說還需要什麼。",
    "- 看不清楚的欄位留空,不要猜。",
    "",
    "旅程:" + days + "。今天是 " + (ctx.today || "未知") + "。使用者目前在看第 " + (ctx.dayN || "?") + " 天。",
    "旅客:" + people + "。座位的 member 要填這裡的代號;對不上的填 unknown。",
    "航班:" + flights + "。",
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

async function ask(model, parts, msLeft) {
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
   前端拿到的一定是確認卡填得進去的值。 */
function clean(f) {
  const s = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const intent = ["wish", "stop", "seats"].includes(f.intent) ? f.intent : "unknown";
  const day = Number.isInteger(f.day) && f.day >= 1 && f.day <= DAYS.length ? f.day : 0;
  const t = s(f.time, 5);
  const ids = MEMBERS.map(m => m.id);
  const seats = (Array.isArray(f.seats) ? f.seats : [])
    .map(x => ({ member: ids.includes(x && x.member) ? x.member : "", seat: s(x && x.seat, 6).toUpperCase() }))
    .filter(x => x.member && /^\d{1,3}[A-K]$/.test(x.seat));
  return {
    intent,
    title: s(f.title, 60),
    day: day ? DAYS[day - 1] : "",
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : "",
    note: s(f.note, 300),
    flight: s(f.flight, 10).toUpperCase().replace(/\s+/g, ""),
    seats,
    message: s(f.message, 120),
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "不支援的方法" });
  }
  if (!process.env.GEMINI_KEY) return res.status(503).json({ error: "伺服器還沒設定 GEMINI_KEY" });

  const b = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body) || {};
  const text = typeof b.text === "string" ? b.text.trim().slice(0, MAX_TEXT) : "";
  const image = typeof b.image === "string" ? b.image : "";
  if (!text && !image) return res.status(400).json({ error: "打一段話或放一張圖" });
  if (image.length > MAX_B64) return res.status(413).json({ error: "圖片太大" });
  const ctx = b.context || {};
  const dayN = DAYS.indexOf(ctx.day) + 1;

  const parts = [];
  if (image) parts.push({ inline_data: { mime_type: "image/jpeg", data: image } });
  parts.push({ text: prompt(text, { today: typeof ctx.today === "string" ? ctx.today.slice(0, 10) : "", dayN }) });

  let last;
  const until = Date.now() + TOTAL_MS;
  for (const model of MODELS) {
    const msLeft = until - Date.now();
    if (msLeft < 1500) break;            /* 剩下的時間不夠再問一次,就別問了 */
    try {
      return res.status(200).json({ result: clean(await ask(model, parts, msLeft)), model });
    } catch (e) {
      last = e;
      /* **「太忙」也要換一個再試。** Google 回 503「This model is currently
         experiencing high demand」的時候,換一個模型通常就過了 —— 而原本只有
         額度用完(429)和模型不存在(404)會換,忙碌直接放棄,
         使用者拿到的是一句英文,而他什麼都沒做錯。 */
      if (e.retry || e.status === 429 || e.status === 404 || e.status >= 500) continue;
      break;
    }
  }
  const quota = last && last.status === 429;
  const busy = last && last.status >= 500;
  /* **回給前端的一律是一句完整的中文**,前端直接顯示,不要再包前綴。
     以前這裡會把 Google 的英文原話接在「AI 沒回應成功:」後面,前端再加一個
     「沒成功:」—— 使用者看到的是兩層「失敗」加一句他看不懂的英文,
     而那句英文講的其實是「過幾分鐘再試」。 */
  const msg = quota ? "今天的免費 AI 額度用完了,明天再試,或先手動加"
    : busy ? "AI 現在太忙(Google 那邊),過幾分鐘再試一次"
    : last && last.soft ? last.message
    : "AI 這次沒成功,再試一次";
  return res.status(quota ? 429 : 502).json({ error: msg });
};
