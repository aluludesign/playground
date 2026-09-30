/* api/_usage.js + api/ai.js 的「今天還剩約幾次」。用法:
 *     node adopt-harness/api-usage-test.js
 *
 * 形狀照 api-ai-test.js:`global.fetch` 換成樁,Gemini 和 Notion 都是假的。
 * 測的是「數得對不對、數不到的時候 AI 還能不能用」—— 不是 Google 真的給幾次。
 */
const path = require("path");
const AI = path.join(__dirname, "..", "tokyo-trip", "api", "ai.js");
const USAGE = path.join(__dirname, "..", "tokyo-trip", "api", "_usage.js");
const SESS = require("../tokyo-trip/api/_session.js");

process.env.LINE_CHANNEL_SECRET = "test-channel-secret";
process.env.VERCEL_ENV = "production";
process.env.GEMINI_KEY = "test-key";
process.env.NOTION_TOKEN = "ntn_test";
const cookie = () => "trip_u=" + encodeURIComponent(SESS.sign({ sub: "U1", name: "誰", pic: "", exp: Date.now() + 864e5 }, SESS.hmacKey()));

function mkres() {
  const r = { code: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  return r;
}
const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });

/* 假的「AI 用量」表 */
let rows = [], seq = 0, notionDown = false, gemini = () => reply(200, {
  candidates: [{ content: { parts: [{ text: JSON.stringify({ intent: "wish", title: "築地", day: 0, time: "", note: "", legs: [], message: "" }) }] } }] });
const plain = p => ((p && (p.title || p.rich_text)) || []).map(t => t.plain_text).join("");
/* 寫進去和讀出來的格式不對稱:真的 Notion 讀出來的文字在 plain_text(同 api-trip-test.js 的 stored) */
function stored(props) {
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    out[k] = v.title ? { title: v.title.map(t => ({ plain_text: t.text.content })) }
      : v.rich_text ? { rich_text: v.rich_text.map(t => ({ plain_text: t.text.content })) } : v;
  }
  return out;
}
function fake(u, init) {
  const url = String(u), method = (init && init.method) || "GET";
  const body = init && init.body ? JSON.parse(init.body) : {};
  if (url.indexOf("generativelanguage") >= 0) return Promise.resolve(gemini(url));
  if (notionDown) return Promise.resolve(reply(500, { message: "down" }));
  if (/\/query$/.test(url)) {
    const day = body.filter.date.equals;
    return Promise.resolve(reply(200, { results: rows.filter(r => r.properties["日期"].date.start === day) }));
  }
  if (/\/pages$/.test(url) && method === "POST") {
    const r = { id: "p" + (++seq), properties: stored(body.properties) };
    rows.push(r);
    return Promise.resolve(reply(200, r));
  }
  const m = /\/pages\/(p\d+)$/.exec(url);
  if (m && method === "PATCH") {
    const r = rows.find(x => x.id === m[1]);
    Object.assign(r.properties, stored(body.properties));
    return Promise.resolve(reply(200, r));
  }
  return Promise.resolve(reply(500, { message: "沒認出 " + url }));
}
async function call(method, body) {
  delete require.cache[require.resolve(AI)];
  delete require.cache[require.resolve(USAGE)];
  global.fetch = fake;
  const res = mkres();
  await require(AI)({ method, body: body ? JSON.stringify(body) : undefined, headers: { cookie: cookie() } }, res);
  return res;
}
const modelOf = r => plain(r.properties["模型"]);
const usedOf = m => { const r = rows.find(x => modelOf(x) === m); return r ? r.properties["次數"].number : 0; };

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? "✓ " : "✗ ") + name + (cond ? "" : "   ← " + JSON.stringify(extra)));
  if (!cond) fails++;
}

(async () => {
  const U = require(USAGE);
  const total = Object.values(U.DAILY).reduce((a, b) => a + b, 0);

  /* ---- 一天的界線 ---- */
  ok("**一天照太平洋時間算**:台灣 9/29 14:59 還是 Google 的 9/28", U.ptDay(new Date("2026-09-29T06:59:00Z")) === "2026-09-28");
  ok("台灣 9/29 15:00(夏令時間)就換成 9/29", U.ptDay(new Date("2026-09-29T07:00:00Z")) === "2026-09-29");
  ok("下一次重算:夏令時間 = 台灣 15:00", U.nextReset(new Date("2026-09-29T02:00:00Z")) === "2026-09-29T07:00:00.000Z");
  ok("冬令時間 = 台灣 16:00", U.nextReset(new Date("2026-12-01T02:00:00Z")) === "2026-12-01T08:00:00.000Z");

  /* ---- 還沒用過 ---- */
  let r = await call("GET");
  ok("GET:今天還沒用過 → 剩的就是全部", r.code === 200 && r.body.usage && r.body.usage.left === total && r.body.usage.total === total, r.body);

  /* ---- 用一次 ---- */
  r = await call("POST", { text: "想去築地" });
  ok("POST 成功 → 照常回結果", r.code === 200 && r.body.result && r.body.result.title === "築地", r.body);
  ok("而且那個模型今天記一次", usedOf("gemini-3.5-flash-lite") === 1, rows);
  await call("POST", { text: "想去築地" });
  ok("再用一次 → 同一列加到 2,不是多開一列", usedOf("gemini-3.5-flash-lite") === 2 && rows.length === 1, rows);
  r = await call("GET");
  ok("GET 跟著少 2", r.body.usage.left === total - 2 && r.body.usage.used === 2, r.body);

  /* ---- 主力模型用完了 ---- */
  gemini = url => url.indexOf("3.5-flash-lite") >= 0 ? reply(429, { error: { message: "quota" } })
    : reply(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ intent: "wish", title: "淺草", day: 0, time: "", note: "", legs: [], message: "" }) }] } }] });
  r = await call("POST", { text: "想去淺草" });
  ok("主力 429 → 換下一個,照常回結果", r.code === 200 && r.body.model === "gemini-3.1-flash-lite", r.body);
  const out = rows.find(x => modelOf(x) === "gemini-3.5-flash-lite");
  ok("主力那一列打勾「用完」", out && out.properties["用完"].checkbox === true, out);
  r = await call("GET");
  ok("**用完的那個不再算進「還剩」**(不然畫面會說還有 498 次,按下去卻是備用的在撐)",
    r.body.usage.left === total - U.DAILY["gemini-3.5-flash-lite"] - 1, r.body);

  /* ---- 全部用完 ---- */
  gemini = () => reply(429, { error: { message: "quota" } });
  r = await call("POST", { text: "想去上野" });
  ok("三個都 429 → 照舊講「今天的免費 AI 額度用完了」", r.code === 429 && /額度用完/.test(r.body.error), r.body);
  r = await call("GET");
  ok("GET → 剩 0", r.body.usage.left === 0, r.body);

  /* ---- 用量表壞了 ---- */
  notionDown = true;
  gemini = () => reply(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ intent: "wish", title: "築地", day: 0, time: "", note: "", legs: [], message: "" }) }] } }] });
  r = await call("POST", { text: "想去築地" });
  ok("**用量表讀不到,AI 照常能用**(它是提醒,不是閘門)", r.code === 200 && r.body.result.title === "築地", r.body);
  r = await call("GET");
  ok("GET → usage 是 null(前端就不講剩幾次,而不是講一個錯的數字)", r.code === 200 && r.body.usage === null, r.body);
  notionDown = false;

  /* ---- 沒登入 ---- */
  delete require.cache[require.resolve(AI)];
  const res = mkres();
  await require(AI)({ method: "GET", headers: { cookie: "" } }, res);
  ok("沒登入 → GET 也是 401", res.code === 401, res.body);

  console.log(fails ? "\n有 " + fails + " 項沒過" : "\n全部通過");
  process.exit(fails ? 1 : 0);
})();
