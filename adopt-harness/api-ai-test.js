/* api/ai.js —— 伺服器那半。用法:
 *     node adopt-harness/api-ai-test.js
 *
 * 形狀照 api-geocode-test.js:`global.fetch` 換成樁,所以測到的是
 * 「上游這樣回的時候,我寫的那段做了什麼」——**不是**「Gemini 真的會這樣回」。
 * 這裡沒有金鑰,也不該有。
 *
 * **探針碰不到這支。** `probes/` 跑的是瀏覽器裡的頁面,而這是跑在伺服器上的函式;
 * 它壞掉的樣子(卡住、丟出英文報錯)在畫面上看起來都只是「AI 不能用」。
 * 所以它要有自己的驗收,不然它等於沒有。
 *
 * 負向對照:SRC= 指到改動之前那一份,看它失敗。
 *     SRC=/tmp/ai-old.js node adopt-harness/api-ai-test.js
 */
const path = process.env.SRC ||
  require("path").join(__dirname, "..", "tokyo-trip", "api", "ai.js");

function mkres() {
  const r = { code: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  return r;
}

/* stub(次數) → 這一次要怎麼回應。回 "hang" 代表永遠不回(模擬卡住)。 */
/* 第 2 期起這一支要登入。預設帶一張登入的票;`anon` 為 true 就不帶。 */
const SESS = require("../tokyo-trip/api/_session.js");
function ticket() {
  process.env.LINE_CHANNEL_SECRET = "test-channel-secret";
  return "trip_u=" + encodeURIComponent(SESS.sign({ sub: "U1", name: "誰", pic: "", exp: Date.now() + 864e5 }, SESS.hmacKey()));
}
async function call(body, stub, anon) {
  process.env.GEMINI_KEY = "test-key";
  delete require.cache[require.resolve(path)];
  const handler = require(path);
  const seen = [];
  global.fetch = (u, init) => {
    seen.push({ url: String(u), headers: (init && init.headers) || {}, body: (init && init.body) || "" });
    const r = stub(seen.length, init);
    if (r === "hang") {
      /* 真的不回應,只聽 abort —— 沒有 timeout 的話這一支會一直掛在這裡。 */
      return new Promise((_, no) => {
        const sig = init && init.signal;
        if (sig) sig.addEventListener("abort", () => {
          const e = new Error("aborted"); e.name = "AbortError"; no(e);
        });
      });
    }
    return Promise.resolve(r);
  };
  const res = mkres();
  await handler({ method: "POST", body: JSON.stringify(body), headers: { cookie: anon ? "" : ticket() } }, res);
  return { res, seen };
}

const okJson = txt => ({ ok: true, status: 200, json: async () => ({
  candidates: [{ content: { parts: [{ text: txt }] } }] }) });
const GOOD = JSON.stringify({ intent: "wish", title: "築地市場", day: 0, time: "",
  note: "", flight: "", seats: [], message: "看起來是想去的地方" });

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? "✓ " : "✗ ") + name + (cond ? "" : "   ← " + JSON.stringify(extra)));
  if (!cond) fails++;
}

(async () => {
  /* ---- 正常的一趟 ---- */
  let r = await call({ text: "想去築地市場" }, () => okJson(GOOD));
  ok("讀得懂的時候回 200 和整理過的結果",
    r.res.code === 200 && r.res.body.result && r.res.body.result.title === "築地市場", r.res.body);
  ok("**金鑰只在送出去的 header 裡,不在回給前端的東西裡**",
    JSON.stringify(r.res.body).indexOf("test-key") < 0, r.res.body);

  /* ---- 回的不是 JSON ---- */
  r = await call({ text: "想去築地市場" }, () => okJson("這不是 JSON <html>"));
  const msg = (r.res.body || {}).error || "";
  ok("回的不是 JSON → 給使用者看得懂的一句話", /沒讀懂/.test(msg), msg);
  ok("**而且不是原始的解析錯誤**(看的人只知道壞了,不知道該不該再按一次)",
    !/Unexpected token|JSON\.parse|SyntaxError/i.test(msg), msg);
  ok("三個模型都試過才放棄(換一個有機會成功)", r.seen.length === 3, r.seen.length);

  /* ---- 上游卡住 ---- */
  const t0 = Date.now();
  r = await call({ text: "想去築地市場" }, () => "hang");
  const took = Date.now() - t0;
  ok("上游不回應 → 有等待上限,不會一直掛著", took < 40000, took + "ms");
  ok("而且講的是人話", /太久沒回應/.test((r.res.body || {}).error || ""), r.res.body);

  /* ---- 上游說「太忙」 ----
     **這一段是被線上一句真的錯誤訊息逼出來的**(2026-09-24):
     使用者看到「沒成功:AI 沒回應成功:This model is currently experiencing
     high demand…」—— 兩層「失敗」加一句他看不懂的英文,而那句英文講的是
     「過幾分鐘再試」。而且那時候程式直接放棄,沒有換另一個模型 ——
     忙碌正是換一個最可能成功的時候。 */
  r = await call({ text: "x" }, n => (n < 3
    ? { ok: false, status: 503, json: async () => ({ error: { message: "This model is currently experiencing high demand." } }) }
    : okJson(GOOD)));
  ok("第一個模型忙 → 換下一個,最後成功", r.res.code === 200 && r.seen.length === 3,
    { code: r.res.code, 試了幾個: r.seen.length });

  r = await call({ text: "x" }, () => ({ ok: false, status: 503,
    json: async () => ({ error: { message: "This model is currently experiencing high demand." } }) }));
  ok("三個都忙 → 講人話,不是丟英文原話",
    /太忙/.test((r.res.body || {}).error || "") &&
    !/high demand|model/i.test((r.res.body || {}).error || ""), r.res.body);
  ok("**而且沒有兩層「失敗」**(前端還會再包一層,這裡不能先包)",
    !/沒回應成功|沒成功:/.test((r.res.body || {}).error || ""), r.res.body);

  /* ---- 額度用完 ---- */
  r = await call({ text: "想去築地市場" }, () => ({ ok: false, status: 429,
    json: async () => ({ error: { message: "quota" } }) }));
  ok("額度用完 → 429,而且講的是明天再試", r.res.code === 429 &&
    /額度/.test(r.res.body.error), r.res.body);

  /* ---- 模型亂回欄位 ---- */
  r = await call({ text: "x" }, () => okJson(JSON.stringify({
    intent: "stop", title: "x".repeat(200), day: 99, time: "99:99",
    note: "", flight: "", seats: [{ member: "不存在的人", seat: "ZZZ" }], message: "" })));
  const g = r.res.body.result;
  ok("模型回超出範圍的值 → 在這裡被擋掉,不會進到確認卡",
    g.title.length <= 60 && g.day === "" && g.time === "" && g.seats.length === 0, g);

  /* ---- 這一團的事實由前端帶來(2026-09-28 以前寫死東京五人行) ---- */
  const CTX = { today: "2026-11-01", day: "2026-11-02", days: ["2026-11-01", "2026-11-02", "2026-11-03"],
    members: [{ id: "m-aaa", name: "小陳" }, { id: "m-bbb", name: "阿美" }],
    legs: [{ id: "leg-1", kind: "火車", no: "高鐵 615", date: "2026-11-01", from: "台北", to: "台南" }],
    trip: { name: "台南吃吃吃", country: "台灣", city: "台南" } };
  const sent = seen => { try { return JSON.parse(seen[0].body); } catch (_) { return {}; } };
  const askText = seen => ((((sent(seen).contents || [])[0] || {}).parts || []).map(p => p.text || "").join(""));
  r = await call({ text: "排到第 2 天晚上 7 點 鼎泰豐", context: CTX }, () => okJson(JSON.stringify({
    intent: "stop", title: "鼎泰豐", day: 2, time: "19:00", note: "", seats: [], message: "" })));
  const q1 = askText(r.seen);
  ok("問 AI 的時候講的是這一團的日期、成員、交通,不是寫死的東京五人行",
    /台南吃吃吃/.test(q1) && /第 2 天 = 2026-11-02/.test(q1) && /m-aaa\(小陳\)/.test(q1) && /leg-1/.test(q1) &&
    !/hsieh_chinhui|MM626|2026-10-03/.test(q1), q1.slice(0, 400));
  ok("第幾天換算成這一團的日期", r.res.body.result.day === "2026-11-02" && r.res.body.result.time === "19:00", r.res.body.result);
  ok("座位的 member 只能是這一團的成員", JSON.stringify(sent(r.seen).generationConfig.responseSchema.properties.seats.items.properties.member.enum) ===
    JSON.stringify(["m-aaa", "m-bbb", "unknown"]), sent(r.seen).generationConfig.responseSchema.properties.seats.items.properties.member.enum);

  /* ---- 交通 ---- */
  r = await call({ text: "這張車票", context: CTX }, () => okJson(JSON.stringify({
    intent: "transport", kind: "火車", no: "高鐵 615", company: "台灣高鐵", depart: "2026-11-01T08:30", from: "台北",
    arrive: "2026-11-01T10:15", to: "台南", code: "07123456", dir: "去程", match: "none",
    seats: [{ member: "m-aaa", seat: "6車 12A" }, { member: "路人", seat: "6車 12B" }], message: "高鐵車票" })));
  const tr = r.res.body.result;
  ok("讀到一段火車:種類、班次、時間、訂位代號、方向都留著", tr.intent === "transport" && tr.kind === "火車" && tr.no === "高鐵 615" &&
    tr.depart === "2026-11-01T08:30" && tr.arrive === "2026-11-01T10:15" && tr.code === "07123456" && tr.dir === "去程", tr);
  ok("火車座位照票上寫的留著;不是這一團的人丟掉", JSON.stringify(tr.seats) === JSON.stringify([{ member: "m-aaa", seat: "6車 12A" }]), tr.seats);
  ok("模型說 none,但班次 + 日期對得上已經有的那一段 → 自己認出來(不要多加一筆)", tr.match === "leg-1", tr.match);
  r = await call({ text: "x", context: CTX }, () => okJson(JSON.stringify({
    intent: "transport", kind: "飛機", no: "BR 198", depart: "2026-11-01 8點", match: "leg-不存在", dir: "unknown",
    seats: [{ member: "m-aaa", seat: "27A" }, { member: "m-bbb", seat: "隨便" }], message: "" })));
  const pl = r.res.body.result;
  ok("飛機座位要像 27A;時間格式不對就清掉;不存在的 id 不認;unknown 方向變空的",
    JSON.stringify(pl.seats) === JSON.stringify([{ member: "m-aaa", seat: "27A" }]) && pl.depart === "" && pl.match === "" && pl.dir === "", pl);
  r = await call({ text: "x", context: CTX }, () => okJson(JSON.stringify({ intent: "seats", seats: [], message: "" })));
  ok("以前的 seats(只改座位)當成交通", r.res.body.result.intent === "transport", r.res.body.result);
  r = await call({ text: "x", context: { days: ["亂寫"], members: "不是陣列", legs: [{ kind: "火箭" }] } }, () => okJson(GOOD));
  ok("前端亂送的 context 不會讓它掛掉", r.res.code === 200, r.res.body);

  /* ---- 第 2 期:要登入 ---- */
  r = await call({ text: "想去築地市場" }, () => okJson(GOOD), true);
  ok("沒登入 → 401,**而且一次都沒打 Gemini**(額度不會被路人用掉)",
    r.res.code === 401 && r.seen.length === 0, { code: r.res.code, seen: r.seen.length });
  console.log(fails ? "\n✗ " + fails + " 項沒過" : "\n全部通過");
  process.exit(fails ? 1 : 0);
})();
