// Trippps · AI 用了幾次
//
// **Google 不會告訴我們還剩幾次** —— 免費方案的 Gemini 沒有「剩餘額度」可以查,
// 用完的那一刻才回 429。所以要在 AI 對話框裡講「今天還能用約幾次」,只能自己數。
//
// 數在 Notion「AI 用量」那張表(Trippps 底下):一列 = 一天 × 一個模型。
// **這個額度是全站共用的** —— 一把 GEMINI_KEY,所有團、所有人一起用。
// 東京團用掉的,別的團就少了;所以對話框講的是「全站今天還剩」,不是「你還剩」。
//
// 數字是**大約**:兩個人同一秒按,讀到的是同一個舊數字,會少算一次;
// 別的地方用同一把金鑰(例如在 AI Studio 試),這裡也看不到。
// 所以畫面上一律寫「約」,而 Google 回 429 的那一刻才是真的用完(那時候把「用完」打勾)。
//
// **這張表出事的時候,AI 照常能用** —— 它只是拿來提醒的,不是閘門。讀不到就不顯示剩幾次,
// 寫不進去就少算一次,都不該讓 AI 按鈕跟著壞。

const NOTION = "https://api.notion.com/v1";
const VERSION = "2022-06-28";
const CALL_MS = 3000;   /* 比 AI 本身快很多才行 —— 數次數拖慢了 AI,就是本末倒置 */
const DB = process.env.NOTION_DB_AI_USAGE || "10c8d455f2294e75b44ff046913d4b70";

/* 每個模型一天幾次(RPD)。**Lulu 2026-09-29 貼的 AI Studio 免費額度表**:
   3.5 Flash-Lite 和 3.1 Flash-Lite 各 500 次(RPM 15)、3.8 Flash 20 次(RPM 5)。
   Google 的文件頁不列數字,只在 aistudio.google.com/rate-limit 看得到 —— 那邊變了就改這裡。
   順序跟 ai.js 的 MODELS 一樣:先用額度最多的。 */
const DAILY = {
  "gemini-3.5-flash-lite": 500,
  "gemini-3.1-flash-lite": 500,
  "gemini-3.8-flash": 20,
};

/* **Google 的一天是太平洋時間。** 台灣時間下午 3 點(夏令時間)或 4 點(冬令)重算 ——
   照台灣的日期數的話,每天下午會有幾個小時「明明還剩很多,卻已經用完」。 */
const PT = "America/Los_Angeles";
function ptDay(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PT, year: "numeric", month: "2-digit", day: "2-digit" }).format(d || new Date());
}
/* 下一次重算的時刻(ISO,UTC)。前端拿去換成「台灣時間 15:00」。
   做法:從現在往後一小時一小時找,第一個太平洋日期變了的整點就是 —— 夏令冬令都不用自己算。 */
function nextReset(now) {
  now = now || new Date();
  const today = ptDay(now);
  const t = new Date(now); t.setUTCMinutes(0, 0, 0);
  for (let i = 0; i < 26; i++) {
    t.setUTCHours(t.getUTCHours() + 1);
    if (ptDay(t) !== today) return t.toISOString();
  }
  return "";
}

async function notion(path, init) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), CALL_MS);
  try {
    const res = await fetch(NOTION + path, {
      ...init,
      signal: ctl.signal,
      headers: {
        Authorization: "Bearer " + process.env.NOTION_TOKEN,
        "Notion-Version": VERSION,
        "Content-Type": "application/json",
        ...(init && init.headers),
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Notion 回應 " + res.status);
    return body;
  } finally { clearTimeout(timer); }
}

const rt = v => [{ type: "text", text: { content: String(v).slice(0, 200) } }];
const plain = p => ((p && (p.title || p.rich_text)) || []).map(t => t.plain_text).join("");

/* 今天(太平洋時間)每個模型的那一列。回 { [model]: { id, used, out } } */
async function rows(day) {
  const found = await notion("/databases/" + DB + "/query", {
    method: "POST",
    body: JSON.stringify({ page_size: 20, filter: { property: "日期", date: { equals: day } } }),
  });
  const out = {};
  for (const r of found.results) {
    const p = r.properties;
    const m = plain(p["模型"]);
    if (!m) continue;
    out[m] = { id: r.id, used: (p["次數"] && p["次數"].number) || 0, out: !!(p["用完"] && p["用完"].checkbox) };
  }
  return out;
}

/* 對話框要的那一句話的材料:{ left, total, used, resetAt }。
   **left 是加總**:主力用完了還有備用的,只要有一個還能用,AI 按鈕就還能用。
   讀不到表就回 null —— 前端看到 null 就不講剩幾次,而不是講一個錯的數字。 */
async function status() {
  if (!process.env.NOTION_TOKEN) return null;
  try {
    const day = ptDay();
    const now = await rows(day);
    let left = 0, total = 0, used = 0;
    for (const m of Object.keys(DAILY)) {
      const r = now[m] || { used: 0, out: false };
      total += DAILY[m];
      used += r.used;
      left += r.out ? 0 : Math.max(0, DAILY[m] - r.used);
    }
    return { left, total, used, resetAt: nextReset() };
  } catch (_) {
    return null;
  }
}

/* 這個模型又用了一次(ok),或 Google 說它今天用完了(out)。
   **不等它也不怪它**:錯了就吞掉,呼叫的人照常回應使用者。 */
async function count(model, kind) {
  if (!process.env.NOTION_TOKEN || !DAILY[model]) return;
  try {
    const day = ptDay();
    const now = await rows(day);
    const r = now[model];
    const props = kind === "out"
      ? { "用完": { checkbox: true } }
      : { "次數": { number: ((r && r.used) || 0) + 1 } };
    if (r) {
      await notion("/pages/" + r.id, { method: "PATCH", body: JSON.stringify({ properties: props }) });
    } else {
      await notion("/pages", {
        method: "POST",
        body: JSON.stringify({
          parent: { database_id: DB },
          properties: {
            "鍵": { title: rt(day + " " + model) },
            "日期": { date: { start: day } },
            "模型": { rich_text: rt(model) },
            "次數": { number: kind === "out" ? 0 : 1 },
            "用完": { checkbox: kind === "out" },
          },
        }),
      });
    }
  } catch (_) { /* 少算一次,不影響 AI */ }
}

module.exports = { status, count, DAILY, ptDay, nextReset };
