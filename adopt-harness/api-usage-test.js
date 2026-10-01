/* api/_usage.js + api/ai.js 的「每人每天幾次」(2026-10-01)。用法:
 *     node adopt-harness/api-usage-test.js
 *
 * 形狀照 api-ai-test.js:`global.fetch` 換成樁,Gemini 和 Notion(成員、AI 紀錄、AI 用量三張表)都是假的。
 * 測的是「數得對不對、擋得對不對、表壞了 AI 還能不能用」—— 不是 Google 真的給幾次。
 * 負向對照:SRC_AI= 指到改動之前的 ai.js,看它失敗。
 */
const path = require("path");
const AI = process.env.SRC_AI || path.join(__dirname, "..", "tokyo-trip", "api", "ai.js");
const USAGE = path.join(__dirname, "..", "tokyo-trip", "api", "_usage.js");
const SESS = require("../tokyo-trip/api/_session.js");

process.env.LINE_CHANNEL_SECRET = "test-channel-secret";
process.env.VERCEL_ENV = "production";
process.env.GEMINI_KEY = "test-key";
process.env.NOTION_TOKEN = "ntn_test";
const cookie = sub => "trip_u=" + encodeURIComponent(SESS.sign({ sub, name: "誰", pic: "", exp: Date.now() + 864e5 }, SESS.hmacKey()));

function mkres() {
  const r = { code: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  return r;
}
const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
const DB = { members: "bee61d7fae604013968455412b2d57a5", log: "370027ac48cb45cba6502926add29096", usage: "10c8d455f2294e75b44ff046913d4b70", trips: "4802c8eac4a14943bf41a38394031acc" };

/* 假的三張表。成員:U-member 在甲團是成員;U-boss 在甲團是成員、乙團是團主(取高 → 25) */
const T = s => ({ rich_text: [{ plain_text: s }] });
let tables, seq, notionDown, gemini, geminiCalls;
function reset() {
  seq = 0; notionDown = false; geminiCalls = 0;
  tables = {
    [DB.members]: [
      { id: "m1", properties: { "人": T("U-member"), "團": T("trip-a"), "角色": { select: { name: "成員" } } } },
      { id: "m2", properties: { "人": T("U-boss"), "團": T("trip-a"), "角色": { select: { name: "成員" } } } },
      { id: "m3", properties: { "人": T("U-boss"), "團": T("trip-b"), "角色": { select: { name: "團主" } } } },
    ],
    [DB.log]: [], [DB.usage]: [],
    /* trip-old 已經結束(最後一天是 2020 年);trip-a 還沒結束 */
    [DB.trips]: [
      { id: "t1", properties: { "代號": { title: [{ plain_text: "trip-a" }] }, "結束日": { date: { start: "2099-01-01" } }, "國家": { select: { name: "日本" } } } },
      { id: "t2", properties: { "代號": { title: [{ plain_text: "trip-old" }] }, "結束日": { date: { start: "2020-01-01" } }, "國家": { select: { name: "台灣" } } } },
    ],
  };
  gemini = () => reply(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ intent: "wish", title: "築地", day: 0, time: "", note: "", legs: [], message: "" }) }] } }] });
}
const val = p => p && (p.rich_text ? p.rich_text.map(t => t.plain_text || (t.text && t.text.content)).join("")
  : p.title ? p.title.map(t => t.plain_text || (t.text && t.text.content)).join("")
  : p.select ? p.select.name : p.date ? p.date.start : p.number !== undefined ? p.number : p.checkbox);
function match(row, f) {
  if (!f) return true;
  if (f.and) return f.and.every(x => match(row, x));
  const v = val(row.properties[f.property]);
  const want = (f.rich_text || f.title || f.select || f.date || {}).equals;
  return String(v) === String(want);
}
function fake(u, init) {
  const url = String(u), method = (init && init.method) || "GET";
  const body = init && init.body ? JSON.parse(init.body) : {};
  if (url.indexOf("generativelanguage") >= 0) { geminiCalls++; return Promise.resolve(gemini(geminiCalls)); }
  if (notionDown) return Promise.resolve(reply(500, { message: "down" }));
  let m = /\/databases\/([0-9a-f]+)\/query$/.exec(url);
  if (m) return Promise.resolve(reply(200, { results: (tables[m[1]] || []).filter(r => match(r, body.filter)) }));
  if (/\/pages$/.test(url) && method === "POST") {
    const row = { id: "p" + (++seq), properties: body.properties };
    tables[body.parent.database_id].push(row);
    return Promise.resolve(reply(200, row));
  }
  m = /\/pages\/(p\d+)$/.exec(url);
  if (m && method === "PATCH") {
    const row = Object.values(tables).flat().find(x => x.id === m[1]);
    Object.assign(row.properties, body.properties);
    return Promise.resolve(reply(200, row));
  }
  return Promise.resolve(reply(500, { message: "沒認出 " + url }));
}
async function call(method, sub, body, query) {
  global.fetch = fake;
  delete require.cache[require.resolve(AI)];
  delete require.cache[require.resolve(USAGE)];
  const res = mkres();
  await require(AI)({ method, query: query || {}, headers: { cookie: sub ? cookie(sub) : "" }, body: body ? JSON.stringify(body) : undefined }, res);
  return res;
}
const ask = (sub, extra) => call("POST", sub, Object.assign({ text: "想去築地", context: { trip: { code: "trip-a", name: "甲團" } } }, extra || {}));
const logs = () => tables[DB.log];
const usageOf = model => tables[DB.usage].find(r => val(r.properties["模型"]) === model);

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? "✓ " : "✗ ") + name + (cond ? "" : "   ← " + JSON.stringify(extra)));
  if (!cond) fails++;
}

(async () => {
  const U = require(USAGE);
  ok("「下午三點」:台灣 15:00(夏令時間的重算)", U.twWhen("2026-09-29T07:00:00.000Z") === "下午三點", U.twWhen("2026-09-29T07:00:00.000Z"));
  ok("冬令 16:00 → 下午四點", U.twWhen("2026-12-01T08:00:00.000Z") === "下午四點", U.twWhen("2026-12-01T08:00:00.000Z"));
  ok("一天照 Google 算:台灣 9/29 14:59 還是 Google 的 9/28", U.ptDay(new Date("2026-09-29T06:59:00Z")) === "2026-09-28");

  reset();
  let r = await call("GET", "U-member");
  ok("GET:一般成員今天 20 次、一次都沒用", r.code === 200 && r.body.mine && r.body.mine.limit === 20 && r.body.mine.left === 20, r.body);
  r = await call("GET", "U-boss");
  ok("GET:在某一團是團主 → 25 次(身分取高,各團共用一份)", r.body.mine && r.body.mine.limit === 25, r.body);
  r = await call("GET", "");
  ok("沒登入 → GET 401", r.code === 401, r.body);

  reset();
  r = await ask("U-member");
  ok("成功 → 照常回結果,也回剩幾次(19)", r.code === 200 && r.body.result.title === "築地" && r.body.mine && r.body.mine.left === 19, r.body);
  const L = logs()[0] && logs()[0].properties;
  ok("AI 紀錄記一列:成功、許願、成員、在哪一團、打了 1 次 Google", logs().length === 1 && val(L["結果"]) === "成功" && val(L["類型"]) === "許願" &&
    val(L["身分"]) === "成員" && val(L["團"]) === "trip-a" && val(L["Google 次數"]) === 1 && val(L["人"]) === "U-member", L);
  ok("**不記使用者打的字**", JSON.stringify(logs()).indexOf("想去築地") < 0, "");
  const u1 = usageOf("gemini-3.5-flash-lite");
  ok("AI 用量:那個模型成功 1、實際 1", u1 && val(u1.properties["次數"]) === 1 && val(u1.properties["實際次數"]) === 1, u1);
  r = await call("GET", "U-member");
  ok("GET 跟著少 1", r.body.mine.left === 19 && r.body.mine.used === 1, r.body);

  /* 一次成功之前忙了一次:成功只算 1,Google 算 2 */
  reset();
  gemini = n => n === 1 ? reply(503, { error: { message: "busy" } })
    : reply(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ intent: "stop", title: "x", day: 0, time: "", note: "", legs: [], message: "" }) }] } }] });
  r = await ask("U-member");
  const L2 = logs()[0] && logs()[0].properties;
  ok("忙一次再成功:扣 1 次,紀錄寫實際打了 2 次 Google、類型是行程", r.code === 200 && val(L2["Google 次數"]) === 2 && val(L2["類型"]) === "行程" &&
    val(usageOf("gemini-3.5-flash-lite").properties["實際次數"]) === 2 && val(usageOf("gemini-3.5-flash-lite").properties["次數"]) === 1, L2);

  /* 失敗不扣 */
  reset();
  gemini = () => reply(400, { error: { message: "bad" } });
  r = await ask("U-member");
  ok("失敗 → 紀錄寫「失敗」,不扣次數", r.code === 502 && val(logs()[0].properties["結果"]) === "失敗", { code: r.code, log: logs()[0] && logs()[0].properties });
  r = await call("GET", "U-member");
  ok("失敗之後還是 20 次", r.body.mine.left === 20, r.body);

  /* 用完 */
  reset();
  const day = U.ptDay();
  for (let i = 0; i < 20; i++) tables[DB.log].push({ id: "old" + i, properties: { "人": T("U-member"), "日期": { date: { start: day } }, "結果": { select: { name: "成功" } } } });
  tables[DB.log].push({ id: "yday", properties: { "人": T("U-boss"), "日期": { date: { start: "2020-01-01" } }, "結果": { select: { name: "成功" } } } });
  r = await ask("U-member");
  ok("用滿 20 次 → 429,「你的 AI 額度用完了,下午X點後再用」", r.code === 429 && r.body.why === "mine" && /^你的 AI 額度用完了,(下午|早上|晚上).+點後再用$/.test(r.body.error), r.body);
  ok("**而且沒去問 Google**(不用大家的份)", geminiCalls === 0, geminiCalls);
  ok("紀錄寫「次數用完」", val(logs()[logs().length - 1].properties["結果"]) === "次數用完", "");
  r = await ask("U-boss");
  ok("別人不受影響;前幾天的不算今天", r.code === 200, r.body);

  /* 強力搜(2026-10-02):一般 8、團主和副團主 12,各團共用;先記一次才放行,用完 429 */
  reset();
  r = await call("GET", "U-member");
  ok("GET 也講強力搜:一般成員 8 次", r.body.strong && r.body.strong.limit === 8 && r.body.strong.left === 8, r.body.strong);
  r = await call("GET", "U-boss");
  ok("在某一團是團主 → 強力搜 12 次", r.body.strong && r.body.strong.limit === 12, r.body.strong);
  for (let i = 0; i < 8; i++) r = await call("POST", "U-member", {}, { strong: "1" });
  ok("用掉 8 次:每次都放行,最後剩 0", r.code === 200 && r.body.strong.left === 0, r.body);
  ok("一人一天一列(不是每次多一列)", tables[DB.usage].filter(x => val(x.properties["模型"]) === "強力搜:U-member").length === 1, tables[DB.usage].length);
  r = await call("POST", "U-member", {}, { strong: "1" });
  ok("第 9 次 → 429「你今天的強力搜用完了,下午X點後再用」", r.code === 429 && r.body.why === "strong" && /強力搜用完了,(下午|早上|晚上).+點後再用/.test(r.body.error), r.body);
  ok("而且強力搜不會去問 Gemini(兩件事分開)", geminiCalls === 0, geminiCalls);
  r = await call("POST", "", {}, { strong: "1" });
  ok("沒登入 → 401", r.code === 401, r.body);
  notionDown = true;
  r = await call("POST", "U-member", {}, { strong: "1" });
  ok("表讀不到 → 放行(數次數不能讓強力搜跟著壞)", r.code === 200, r.body);

  /* 結束的團(2026-10-01):AI 不能用,也不去問 Google */
  reset();
  r = await call("POST", "U-member", { text: "x", context: { trip: { code: "trip-old" } } });
  ok("**結束的團不能用 AI**(要記帳請在旅行期間記完)", r.code === 403 && r.body.why === "ended" && geminiCalls === 0, { code: r.code, body: r.body, gemini: geminiCalls });
  r = await ask("U-member");
  ok("還沒結束的團照常", r.code === 200, r.body);

  /* 表壞了 */
  reset();
  notionDown = true;
  r = await ask("U-member");
  ok("**Notion 讀不到,AI 照常能用**(它壞掉的時候 AI 不該跟著壞)", r.code === 200 && r.body.result.title === "築地", r.body);
  r = await call("GET", "U-member");
  ok("GET → mine 是 null(畫面就不講剩幾次,不講一個錯的數字)", r.code === 200 && r.body.mine === null, r.body);

  console.log(fails ? "\n✗ " + fails + " 項沒過" : "\n全部通過");
  process.exit(fails ? 1 : 0);
})();
