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
/* notionPage:給那條「沒有通行碼、但重查的是自己那筆願望的地點」的路用的。
   同一個 fetch 樁要分兩家:打 api.notion.com 的回這一份,其餘的是地名查詢那家。 */
async function call(query, headers, env, stub, notionPage) {
  for (const k of Object.keys(env)) process.env[k] = env[k];
  ["GEOCODE_KEY", "TRIP_KEY", "NOTION_TOKEN"].forEach(k => { if (!(k in env)) delete process.env[k]; });
  delete require.cache[require.resolve(path)];
  const handler = require(path);
  let seenUrl = null;
  global.fetch = async (u) => {
    if (String(u).indexOf("api.notion.com") >= 0) {
      const p = notionPage || { __missing: true };
      return { ok: !p.__missing, status: p.__missing ? 404 : 200, json: async () => (p.__missing ? { message: "找不到" } : p) };
    }
    seenUrl = u;
    return { ok: true, json: async () => stub };
  };
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

  /* ---- 沒有通行碼的那條窄路:重查某一筆願望自己填的地點 ----
     Lulu:「任何人自己加的行程可以自己再修改」。願望做得到,行程做不到
     (stopOut 沒有「誰加的」欄位)—— 所以只開願望那一半。

     **這幾條測的是「被問的是什麼」,不是「誰在問」。** 伺服器驗不了身分
     (tokyo5-me 是瀏覽器裡的一個字串),所以下面沒有任何一條在測身分 ——
     有的話那才是要擔心的事。 */
  const DBID = "3b2d1f3045fc4b2490e93e3238c26b3a";
  const wishPage = (place, extra) => Object.assign({
    id: "w-1",
    parent: { database_id: "3b2d1f30-45fc-4b24-90e9-3e3238c26b3a" },   /* Notion 回的帶橫線 */
    properties: { "地點": { rich_text: [{ plain_text: place }] } },
  }, extra || {});

  r = await call({ resource: "geocode", q: "港灣未來", wish: "w-1" }, {}, ENV,
    { status: "ZERO_RESULTS" }, wishPage("港灣未來"));
  ok("沒通行碼 + 查的就是那筆願望的地點 → 放行", r.res.code === 200, r.res.body);
  ok("放行那次真的去查了(URL 有送出去)", /components=country:jp/.test(r.url || ""), r.url);

  r = await call({ resource: "geocode", q: "別的東西", wish: "w-1" }, {}, ENV, {}, wishPage("港灣未來"));
  ok("沒通行碼 + 查的不是那筆願望的地點 → 401(不能當免費的地名查詢服務用)",
     r.res.code === 401, r.res.body);

  r = await call({ resource: "geocode", q: "港灣未來", wish: "w-1" }, {}, ENV, {},
    wishPage("港灣未來", { properties: {
      "地點": { rich_text: [{ plain_text: "港灣未來" }] },
      "日期": { date: { start: "2026-10-05" } } } }));
  ok("沒通行碼 + 那一筆其實是行程(有日期)→ 401(行程維持要通行碼)", r.res.code === 401, r.res.body);

  r = await call({ resource: "geocode", q: "港灣未來", wish: "w-1" }, {}, ENV, {},
    wishPage("港灣未來", { parent: { database_id: "ffffffffffffffffffffffffffffffff" } }));
  ok("沒通行碼 + 那一頁不在這個資料庫裡 → 401", r.res.code === 401, r.res.body);

  r = await call({ resource: "geocode", q: "", wish: "w-1" }, {}, ENV, {}, wishPage(""));
  ok("沒通行碼 + 地點欄是空的 → 400(空字串本來就先擋)", r.res.code === 400, r.res.body);

  r = await call({ resource: "geocode", q: "港灣未來", wish: "不存在" }, {}, ENV, {}, null);
  ok("沒通行碼 + 那一筆根本查不到 → 401(Notion 丟錯不會變成 500)", r.res.code === 401, r.res.body);

  r = await call({ resource: "geocode", q: "港灣未來" }, {}, ENV, {}, wishPage("港灣未來"));
  ok("沒通行碼、也沒帶 wish → 照舊 401(原本那道門還在)", r.res.code === 401, r.res.body);

  r = await call({ resource: "geocode", q: "港灣未來", wish: "w-1" }, {},
    { NOTION_TOKEN: "x", GEOCODE_KEY: "SECRET-NOT-A-REAL-KEY" }, { status: "ZERO_RESULTS" }, wishPage("港灣未來"));
  ok("伺服器連 TRIP_KEY 都沒設,自己那筆願望仍然重查得動(願望本來就是開放的)",
     r.res.code === 200, r.res.body);

  r = await call({ resource: "geocode", q: "港灣未來", wish: "w-1" }, {}, BASE, {}, wishPage("港灣未來"));
  ok("這條路一樣要 GEOCODE_KEY,沒設 → 503", r.res.code === 503, r.res.body);

  r = await call({ resource: "geocode", q: "港灣未來", wish: "w-1", method: "POST" }, {}, ENV, {}, wishPage("港灣未來"));
  ok("這條路一樣只收 GET → 405", r.res.code === 405, r.res.body);

  /* ---- 伺服器不認得那張人工確認過的表,而那是**刻意的** ----
     「人工表命中就不打 API」這件事整個發生在前端(index.html 的 outsidePin)。
     下面兩條把那條界線釘住:如果哪天有人把省錢的責任搬到伺服器,這兩條會先紅。
     **重點不是「伺服器該擋」,是「現在它不擋,所以省下來的每一次查詢都是前端省的」**
     —— 前端那條短路壞掉的話,這裡不會有任何東西攔住它。 */
  r = await call({ resource: "geocode", q: "TPE 桃園 T1" }, KEYH, ENV, { status: "ZERO_RESULTS" });
  ok("人工表裡的字串照樣會被送去上游(省下來的查詢全部是前端省的,伺服器不認得那張表)",
     r.res.code === 200 && /TPE/.test(decodeURIComponent(r.url || "")), { code: r.res.code, url: r.url });

  r = await call({ resource: "geocode", q: "樂桃 MM626 · 建議起飛前 2.5 小時" }, KEYH, ENV, { status: "ZERO_RESULTS" });
  ok("送什麼就查什麼:伺服器不會像前端 pinFor 那樣自己拆掉前綴(這條路只查一次)",
     /樂桃 MM626 · 建議起飛前 2\.5 小時/.test(decodeURIComponent(r.url || "")), r.url);

  console.log(fails ? "\n有 " + fails + " 項沒過" : "\n全部通過");
  process.exit(fails ? 1 : 0);
})();
