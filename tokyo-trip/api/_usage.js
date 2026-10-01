// Trippps · AI 次數(2026-10-01,Lulu 定案)
//
// **每個人每天固定幾次**:一般成員 20 次,團主和副團主 25 次。不分團、不看人數比例;
// 一個人參加好幾團,**一人一份、各團共用**,身分取高的那一個。
// 「一次」= 按「交給 AI」**成功拿到結果**;失敗不扣,打開對話框、按確定存也不扣。
//
// **Google 不會告訴我們還剩幾次**,所以自己數,數在 Notion 兩張表(都在 Trippps 底下):
//   - 「AI 紀錄」:每按一次「交給 AI」一列 —— 時間、哪一團、誰、身分、AI 讀出的類型、成功或失敗、
//     最後是哪個模型、實際打了 Google 幾次。**不記使用者打的字和圖片。**
//     每個人今天用了幾次,就是數這張表裡他今天「成功」的列。
//   - 「AI 用量」:一天 × 一個模型 —— 成功幾次(次數)、實際打了幾次(實際次數)、Google 說用完了沒。
//     給團主看整站用了多少、哪個模型撐著;不拿來擋人。
//
// **一天照 Google 算**:太平洋時間午夜 = 台灣下午 3 點(冬令 4 點)。照台灣日期數的話,
// 每天下午會有一段「明明還剩,卻已經用完」。
//
// **這兩張表出事的時候,AI 照常能用** —— 讀不到就不擋、不講剩幾次;寫不進去就少記一筆。

const NOTION = "https://api.notion.com/v1";
const VERSION = "2022-06-28";
const CALL_MS = 3000;   /* 比 AI 本身快很多才行 —— 數次數拖慢了 AI,就是本末倒置 */
const DB_USAGE = process.env.NOTION_DB_AI_USAGE || "10c8d455f2294e75b44ff046913d4b70";
const DB_LOG = process.env.NOTION_DB_AI_LOG || "370027ac48cb45cba6502926add29096";
const DB_MEMBERS = process.env.NOTION_DB_MEMBERS || "bee61d7fae604013968455412b2d57a5";
const DB_TRIPS = process.env.NOTION_DB_TRIPS || "4802c8eac4a14943bf41a38394031acc";
/* 跟 api/notion.js 的 COUNTRIES 同一份:團的當地時區 */
const TZ = { "日本": "Asia/Tokyo", "台灣": "Asia/Taipei" };

/* 每個人每天幾次(Lulu 2026-09-30 定:20／25)。30 人全 25 也才 750,離 Google 全站每天約 1,140 次
   留了空間給重試和換模型(一次成功可能打好幾次 Google)。 */
const LIMIT = { "團主": 25, "副團主": 25, "成員": 20 };
/* **強力搜(Places UI Kit 清單)每人每天幾次**(2026-10-02,Lulu 照建議定)。一般 8、團主和副團主 12,各團共用、身分取高。
   用 Google Cloud 那道每天 300 次的保險去分:30 人一半是團主或副團主 → 15×12 + 15×8 = 300。
   數在「AI 用量」表,一人一天一列(模型欄寫「強力搜:LINE ID」);按一次強力搜、出一份清單算 1 次 */
const STRONG = { "團主": 12, "副團主": 12, "成員": 8 };

const PT = "America/Los_Angeles";
function ptDay(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PT, year: "numeric", month: "2-digit", day: "2-digit" }).format(d || new Date());
}
/* 下一次重算的時刻(ISO,UTC)。從現在往後一小時一小時找,第一個太平洋日期變了的整點 —— 夏令冬令都不用自己算 */
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
/* 「下午三點」這種講法(用完時的那句話,Lulu 定的文案) */
const ZH = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
function twWhen(iso) {
  let h;
  try { h = +new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)); } catch (_) { return ""; }
  if (!isFinite(h)) return "";
  return (h < 12 ? "早上" : h < 18 ? "下午" : "晚上") + ZH[h % 12 || 12] + "點";
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

const rt = v => [{ type: "text", text: { content: String(v == null ? "" : v).slice(0, 200) } }];
const plain = p => ((p && (p.title || p.rich_text)) || []).map(t => t.plain_text).join("");
const sel = p => (p && p.select && p.select.name) || "";
const ready = () => !!process.env.NOTION_TOKEN;

/* 這個人在哪幾團、各是什麼身分 → { roles: { 團代號: 身分 }, limit } */
async function rolesOf(sub) {
  const found = await notion("/databases/" + DB_MEMBERS + "/query", {
    method: "POST",
    body: JSON.stringify({ page_size: 100, filter: { property: "人", rich_text: { equals: sub } } }),
  });
  const roles = {};
  for (const r of found.results) roles[plain(r.properties["團"])] = sel(r.properties["角色"]) || "成員";
  const limit = Math.max(LIMIT["成員"], ...Object.values(roles).map(x => LIMIT[x] || LIMIT["成員"]));
  const strong = Math.max(STRONG["成員"], ...Object.values(roles).map(x => STRONG[x] || STRONG["成員"]));
  return { roles, limit, strong };
}
/* 今天(Google 的一天)成功了幾次 */
async function usedToday(sub, day) {
  const found = await notion("/databases/" + DB_LOG + "/query", {
    method: "POST",
    body: JSON.stringify({ page_size: 100, filter: { and: [
      { property: "日期", date: { equals: day } },
      { property: "人", rich_text: { equals: sub } },
      { property: "結果", select: { equals: "成功" } },
    ] } }),
  });
  return found.results.length;
}

/* 這個人今天:{ left, limit, used, resetAt, when, roles }。讀不到就回 null(不擋,也不講數字) */
async function mine(sub) {
  if (!ready() || !sub) return null;
  try {
    const day = ptDay();
    const [r, used] = await Promise.all([rolesOf(sub), usedToday(sub, day)]);
    const resetAt = nextReset();
    return { left: Math.max(0, r.limit - used), limit: r.limit, used, resetAt, when: twWhen(resetAt), roles: r.roles };
  } catch (_) {
    return null;
  }
}

const KIND = { wish: "許願", stop: "行程", transport: "交通" };
/* 按一次「交給 AI」記一列。**不記打的字和圖片。** 寫不進去就算了 */
async function record(e) {
  if (!ready() || !e || !e.sub) return;
  try {
    const now = new Date();
    await notion("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: DB_LOG },
        properties: {
          "紀錄": { title: rt(ptDay(now) + " " + (e.trip || "?") + " " + (e.role || "成員")) },
          "時間": { date: { start: now.toISOString() } },
          "日期": { date: { start: ptDay(now) } },
          "人": { rich_text: rt(e.sub) },
          "團": { rich_text: rt(e.trip || "") },
          "身分": { select: { name: LIMIT[e.role] ? e.role : "成員" } },
          "類型": { select: { name: KIND_OF[e.intent] || "看不出來" } },
          "結果": { select: { name: e.result } },
          "模型": { rich_text: rt(e.model || "") },
          "Google 次數": { number: e.calls || 0 },
        },
      }),
    });
  } catch (_) { /* 少記一筆,不影響 AI */ }
}

/* 模型那幾列:{ [model]: { ok, calls, out } } —— 成功幾次、實際打了幾次、Google 說用完了沒 */
async function tally(byModel) {
  if (!ready() || !byModel) return;
  const day = ptDay();
  await Promise.all(Object.keys(byModel).map(async model => {
    const t = byModel[model];
    try {
      const found = await notion("/databases/" + DB_USAGE + "/query", {
        method: "POST",
        body: JSON.stringify({ page_size: 5, filter: { and: [
          { property: "日期", date: { equals: day } }, { property: "模型", rich_text: { equals: model } }] } }),
      });
      const row = found.results[0];
      const p = row ? row.properties : {};
      const props = {
        "次數": { number: ((p["次數"] && p["次數"].number) || 0) + (t.ok || 0) },
        "實際次數": { number: ((p["實際次數"] && p["實際次數"].number) || 0) + (t.calls || 0) },
      };
      if (t.out) props["用完"] = { checkbox: true };
      if (row) {
        await notion("/pages/" + row.id, { method: "PATCH", body: JSON.stringify({ properties: props }) });
      } else {
        await notion("/pages", { method: "POST", body: JSON.stringify({ parent: { database_id: DB_USAGE }, properties: {
          ...props,
          "鍵": { title: rt(day + " " + model) },
          "日期": { date: { start: day } },
          "模型": { rich_text: rt(model) },
          "用完": { checkbox: !!t.out },
        } }) });
      }
    } catch (_) { /* 少算一次,不影響 AI */ }
  }));
}

/* 這一團結束了沒(照當地時間,最後一天 23:59 過了)。查不到就當沒結束 —— 它不能讓 AI 跟著壞 */
async function tripEnded(code) {
  if (!ready() || !code) return false;
  try {
    const found = await notion("/databases/" + DB_TRIPS + "/query", {
      method: "POST", body: JSON.stringify({ page_size: 1, filter: { property: "代號", title: { equals: code } } }) });
    const p = found.results[0] && found.results[0].properties;
    if (!p) return false;
    const end = p["結束日"] && p["結束日"].date && p["結束日"].date.start;
    const tz = TZ[sel(p["國家"])] || "Asia/Taipei";
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return !!end && today > String(end).slice(0, 10);
  } catch (_) { return false; }
}

const KIND_OF = { wish: "許願", stop: "行程", transport: "交通", expense: "記帳" };
/* ---- 強力搜 ---- */
const strongKey = sub => "強力搜:" + sub;
async function strongRow(sub, day) {
  const found = await notion("/databases/" + DB_USAGE + "/query", {
    method: "POST",
    body: JSON.stringify({ page_size: 2, filter: { and: [
      { property: "日期", date: { equals: day } }, { property: "模型", rich_text: { equals: strongKey(sub) } }] } }),
  });
  return found.results[0] || null;
}
/* 這個人今天強力搜還剩幾次:{ left, limit, used, resetAt, when }。讀不到回 null(不擋,也不講數字) */
async function strongMine(sub) {
  if (!ready() || !sub) return null;
  try {
    const day = ptDay();
    const [r, row] = await Promise.all([rolesOf(sub), strongRow(sub, day)]);
    const used = (row && row.properties["次數"] && row.properties["次數"].number) || 0;
    const resetAt = nextReset();
    return { left: Math.max(0, r.strong - used), limit: r.strong, used, resetAt, when: twWhen(resetAt) };
  } catch (_) { return null; }
}
/* 用掉一次。**先看還有沒有**:沒有就回 { ok:false };讀不到表就放行(它不能讓強力搜跟著壞) */
async function strongUse(sub) {
  const m = await strongMine(sub);
  if (!m) return { ok: true, mine: null };
  if (m.left <= 0) return { ok: false, mine: m };
  try {
    const day = ptDay(), row = await strongRow(sub, day);
    const props = { "次數": { number: m.used + 1 } };
    if (row) await notion("/pages/" + row.id, { method: "PATCH", body: JSON.stringify({ properties: props }) });
    else await notion("/pages", { method: "POST", body: JSON.stringify({ parent: { database_id: DB_USAGE }, properties: {
      ...props, "鍵": { title: rt(day + " " + strongKey(sub)) }, "日期": { date: { start: day } },
      "模型": { rich_text: rt(strongKey(sub)) }, "用完": { checkbox: false } } }) });
  } catch (_) { /* 少記一次 */ }
  return { ok: true, mine: Object.assign({}, m, { left: m.left - 1, used: m.used + 1 }) };
}

module.exports = { mine, record, tally, tripEnded, strongMine, strongUse, LIMIT, STRONG, ptDay, nextReset, twWhen };
