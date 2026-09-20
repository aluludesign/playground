/* api/notion.js 的 resource=geocode 分支。用法:
 *     node adopt-harness/api-geocode-test.js
 *
 * 為什麼它在 repo 裡而不是在某個暫存目錄:ADOPTION.md 記過同一個形狀至少兩次 ——
 * 一次性的探針寫完就留在暫存目錄裡弄丟,下一個人又從零寫。收進來才算修好。
 * (它放 adopt-harness/,不放 tokyo-trip/ —— 後者同時是 Vercel 的部署範圍
 *  和 Tailwind 的掃描範圍,見 ADOPTION.md「這份文件為什麼住在 adopt-harness/」。)
 *
 * **它驗不到的事,比它驗到的重要:** 這裡沒有金鑰,也不該有。
 * global.fetch 被換成一個回固定 JSON 的樁,所以測到的是
 * 「上游照規格回 X 的時候,我寫的那段做了什麼」——
 * **不是**「那個服務真的會回 X」。後者要等 Lulu 在 Vercel 設好 GEOCODE_KEY。
 */
const path = "/Users/luluchang/Desktop/github/aluludesign/playground/tokyo-trip/api/notion.js";

function mkres() {
  const r = { code: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  return r;
}
async function call(query, headers, env, stub) {
  for (const k of Object.keys(env)) process.env[k] = env[k];
  ["GEOCODE_KEY", "TRIP_KEY", "NOTION_TOKEN"].forEach(k => { if (!(k in env)) delete process.env[k]; });
  delete require.cache[require.resolve(path)];
  const handler = require(path);
  let seenUrl = null;
  global.fetch = async (u) => { seenUrl = u; return { ok: true, json: async () => stub }; };
  const res = mkres();
  await handler({ method: query.method || "GET", query: query, headers: headers || {}, body: "" }, res);
  return { res: res, url: seenUrl };
}

const BASE = { NOTION_TOKEN: "x", TRIP_KEY: "pass" };
const KEYH = { "x-trip-key": "pass" };
let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? "✓ " : "✗ ") + name + (cond ? "" : "   ← " + JSON.stringify(extra)));
  if (!cond) fails++;
}

(async () => {
  /* 守門 */
  let r = await call({ resource: "geocode", q: "淺草寺" }, {}, BASE, {});
  ok("沒帶通行碼 → 401", r.res.code === 401, r.res.body);

  r = await call({ resource: "geocode", q: "淺草寺" }, KEYH, { NOTION_TOKEN: "x" }, {});
  ok("伺服器沒設 TRIP_KEY → 503", r.res.code === 503, r.res.body);

  r = await call({ resource: "geocode", q: "淺草寺" }, KEYH, BASE, {});
  ok("沒設 GEOCODE_KEY → 503 且訊息說得出來", r.res.code === 503 && /GEOCODE_KEY/.test(r.res.body.error), r.res.body);

  r = await call({ resource: "geocode", q: "淺草寺", method: "POST" }, KEYH, BASE, {});
  ok("非 GET → 405", r.res.code === 405, r.res.body);

  const ENV = Object.assign({ GEOCODE_KEY: "SECRET-NOT-A-REAL-KEY" }, BASE);

  r = await call({ resource: "geocode", q: "" }, KEYH, ENV, {});
  ok("空字串 → 400", r.res.code === 400, r.res.body);

  r = await call({ resource: "geocode", q: "あ".repeat(200) }, KEYH, ENV, {});
  ok("太長 → 400", r.res.code === 400, r.res.body);

  /* 翻譯:精確 */
  r = await call({ resource: "geocode", q: "淺草寺" }, KEYH, ENV, {
    status: "OK", results: [{ geometry: { location: { lat: 35.7148, lng: 139.7967 }, location_type: "ROOFTOP" },
      formatted_address: "2-chōme-3-1 Asakusa, Taito City, Tokyo" }] });
  ok("ROOFTOP → exact", r.res.code === 200 && r.res.body.found === true &&
     r.res.body.precision === "exact" && r.res.body.la === 35.7148 && r.res.body.lo === 139.7967, r.res.body);

  r = await call({ resource: "geocode", q: "京都車站" }, KEYH, ENV, {
    status: "OK", results: [{ geometry: { location: { lat: 34.9858, lng: 135.7588 }, location_type: "GEOMETRIC_CENTER" } }] });
  ok("GEOMETRIC_CENTER → exact", r.res.body.precision === "exact", r.res.body);

  /* 翻譯:概略 —— 這一塊最有價值的分支 */
  r = await call({ resource: "geocode", q: "東京都廳" }, KEYH, ENV, {
    status: "OK", results: [{ geometry: { location: { lat: 35.6764, lng: 139.65 }, location_type: "APPROXIMATE" },
      formatted_address: "日本東京都" }] });
  ok("APPROXIMATE → area", r.res.body.found === true && r.res.body.precision === "area", r.res.body);

  r = await call({ resource: "geocode", q: "怪東西" }, KEYH, ENV, {
    status: "OK", results: [{ geometry: { location: { lat: 1, lng: 2 }, location_type: "NEW_THING_2030" } }] });
  ok("不認識的精度 → 往保守那邊倒(area)", r.res.body.precision === "area", r.res.body);

  /* 翻譯:查無 */
  r = await call({ resource: "geocode", q: "泡溫泉" }, KEYH, ENV, { status: "ZERO_RESULTS", results: [] });
  ok("ZERO_RESULTS → found:false 且 200", r.res.code === 200 && r.res.body.found === false, r.res.body);

  /* 上游出錯 */
  r = await call({ resource: "geocode", q: "x" }, KEYH, ENV, { status: "REQUEST_DENIED", error_message: "The provided API key SECRET-NOT-A-REAL-KEY is expired" });
  ok("REQUEST_DENIED → 502", r.res.code === 502, r.res.body);
  ok("上游的 error_message 不轉發(金鑰不會跟著漏出去)",
     !/SECRET-NOT-A-REAL-KEY/.test(JSON.stringify(r.res.body)) && !/provided API key/.test(JSON.stringify(r.res.body)), r.res.body);

  r = await call({ resource: "geocode", q: "x" }, KEYH, ENV, { status: "OVER_QUERY_LIMIT" });
  ok("OVER_QUERY_LIMIT → 502", r.res.code === 502, r.res.body);

  /* 國家代碼只收兩個字母 */
  r = await call({ resource: "geocode", q: "淺草寺", cc: "jp" }, KEYH, ENV, { status: "ZERO_RESULTS" });
  ok("cc=jp 進了 components", /components=country:jp/.test(r.url), r.url);
  r = await call({ resource: "geocode", q: "淺草寺", cc: "&key=壞東西&x" }, KEYH, ENV, { status: "ZERO_RESULTS" });
  ok("亂給的 cc 被擋掉,退回 jp", /components=country:jp/.test(r.url) && !/壞東西/.test(r.url), r.url);

  /* 其他 resource 沒被這一條影響 */
  r = await call({ resource: "亂打" }, KEYH, ENV, {});
  ok("不認識的 resource 仍然 400", r.res.code === 400, r.res.body);
  r = await call({ resource: "auth" }, KEYH, ENV, {});
  ok("auth 仍然 200", r.res.code === 200, r.res.body);

  console.log(fails ? "\n有 " + fails + " 項沒過" : "\n全部通過");
  process.exit(fails ? 1 : 0);
})();
