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
/* 模型清單從原始碼讀,不在這裡抄一份 —— 清單改了,測試跟著改 */
const MODELS = eval(/const MODELS = (\[[\s\S]*?\]);/.exec(require("fs").readFileSync(path, "utf8"))[1]);

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
/* 預設扮正式站:使用者看到的只有中文。預覽會多接 Google 的原話,單獨測 */
process.env.VERCEL_ENV = "production";
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
  ok("每個模型都試過才放棄(換一個有機會成功)", r.seen.length === MODELS.length, { 試了: r.seen.length, 共有: MODELS.length });

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
  process.env.VERCEL_ENV = "preview";
  r = await call({ text: "x" }, () => ({ ok: false, status: 500, json: async () => ({ error: { message: "Internal error encountered." } }) }));
  process.env.VERCEL_ENV = "production";
  ok("預覽環境才把 Google 的原話接在後面(除錯用)", /測試環境才看得到:500 Internal error/.test((r.res.body || {}).error || ""), r.res.body);

  /* ---- 2026-09-29:忙就先等一下再問同一個模型,再換下一個 ---- */
  const BUSY = { ok: false, status: 503, json: async () => ({ error: { message: "This model is currently experiencing high demand." } }) };
  let t1 = Date.now();
  r = await call({ text: "x" }, n => (n === 1 ? BUSY : okJson(GOOD)));
  ok("第一次忙 → 等一下,**同一個模型**再問一次就成功(不必換模型)",
    r.res.code === 200 && r.seen.length === 2 && r.seen[0].url === r.seen[1].url && Date.now() - t1 >= 1400,
    { code: r.res.code, 次數: r.seen.length, 同一個: r.seen[0] && r.seen[1] && r.seen[0].url === r.seen[1].url, 等了: Date.now() - t1 });
  t1 = Date.now();
  r = await call({ text: "x" }, () => BUSY);
  const took2 = Date.now() - t1;
  /* 模型多了之後(2026-09-30 起九個),全部都忙時不保證每個都問兩次 —— 時間到就停。
     要守的是:時間在上限內、每個模型至少問過一次、主力(第一個)有等一下再問第二次。 */
  const asked = new Set(r.seen.map(x => x.url));
  ok("全部都忙:每個模型至少問過一次,主力等一下再問了第二次,總時間在函式的 30 秒上限之內",
    asked.size === MODELS.length && r.seen[0].url === r.seen[1].url && took2 < 25000,
    { 次數: r.seen.length, 問過幾個: asked.size, 共有: MODELS.length, 花了: took2 });
  ok("失敗的訊息附上 Google 的代碼(數字,不是英文原話)", /\(Google 503\)/.test(r.res.body.error) && !/high demand/.test(r.res.body.error), r.res.body.error);

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
    g.title.length <= 60 && g.day === "" && g.time === "" && g.legs.length === 0, g);

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
  ok("成員代號跟著這一團走(寫在問句裡,不做成選項清單)", /旅客:m-aaa\(小陳\)、m-bbb\(阿美\)/.test(q1) &&
    !sent(r.seen).generationConfig.responseSchema.properties.legs.items.properties.seats.items.properties.member.enum, q1.slice(0, 200));

  /* ---- 交通 ---- */
  r = await call({ text: "這張車票", context: CTX }, () => okJson(JSON.stringify({
    intent: "transport", message: "高鐵來回", legs: [
      { kind: "火車", no: "高鐵 615", company: "台灣高鐵", depart: "2026-11-01T08:30", from: "台北",
        arrive: "2026-11-01T10:15", to: "台南", code: "07123456", dir: "去程", match: "none", note: "",
        seats: [{ member: "m-aaa", seat: "6車 12A" }, { member: "路人", seat: "6車 12B" }] },
      { kind: "火車", no: "高鐵 668", company: "台灣高鐵", depart: "2026-11-03T18:00", from: "台南",
        arrive: "2026-11-03T19:45", to: "台北", code: "07123456", dir: "回程", match: "none", note: "", seats: [] }] })));
  ok("一次讀到兩段(去程 + 回程)→ 兩段都回來", (r.res.body.result.legs || []).length === 2 &&
    r.res.body.result.legs[1].no === "高鐵 668" && r.res.body.result.legs[1].dir === "回程", r.res.body.result);
  const tr = r.res.body.result.legs[0];
  ok("讀到一段火車:種類、班次、時間、訂位代號、方向都留著", r.res.body.result.intent === "transport" && tr.kind === "火車" && tr.no === "高鐵 615" &&
    tr.depart === "2026-11-01T08:30" && tr.arrive === "2026-11-01T10:15" && tr.code === "07123456" && tr.dir === "去程", tr);
  ok("火車座位照票上寫的留著;不是這一團的人丟掉", JSON.stringify(tr.seats) === JSON.stringify([{ member: "m-aaa", seat: "6車 12A" }]), tr.seats);
  ok("票上有、團裡還沒有的乘客:不記座位,只回個數", tr.others === 1, tr.others);
  ok("模型說 none,但班次 + 日期對得上已經有的那一段 → 自己認出來(不要多加一筆)", tr.match === "leg-1", tr.match);
  r = await call({ text: "x", context: CTX }, () => okJson(JSON.stringify({
    intent: "transport", kind: "飛機", no: "BR 198", depart: "2026-11-01 8點", match: "leg-不存在", dir: "unknown",
    seats: [{ member: "m-aaa", seat: "27A" }, { member: "m-bbb", seat: "隨便" }], message: "" })));
  const pl = (r.res.body.result.legs || [])[0] || {};
  ok("模型把一段攤在最外層(舊的形狀)也接得住", r.res.body.result.legs.length === 1, r.res.body.result);
  ok("座位不檢查格式(照票上寫的);時間格式不對就清掉;不存在的 id 不認;unknown 方向變空的",
    JSON.stringify(pl.seats) === JSON.stringify([{ member: "m-aaa", seat: "27A" }, { member: "m-bbb", seat: "隨便" }]) && pl.depart === "" && pl.match === "" && pl.dir === "", pl);
  /* 記帳(2026-10-01):收據 → 項目、金額、幣別、日期、分類 */
  r = await call({ text: "這張收據", context: CTX }, () => okJson(JSON.stringify({ intent: "expense", title: "一蘭拉麵", amount: 2980, currency: "JPY",
    date: "2026-11-02", category: "餐飲", note: "", legs: [], message: "拉麵店收據" })));
  const ex = r.res.body.result;
  ok("讀到一筆花費:項目、金額、幣別、日期、分類", ex.intent === "expense" && ex.title === "一蘭拉麵" && ex.amount === 2980 && ex.currency === "JPY" && ex.date === "2026-11-02" && ex.category === "餐飲", ex);
  r = await call({ text: "x", context: CTX }, () => okJson(JSON.stringify({ intent: "expense", title: "x", amount: -5, currency: "USD", date: "昨天", category: "亂寫", legs: [], message: "" })));
  const bad = r.res.body.result;
  ok("金額不合理、幣別不認得、日期格式不對、分類亂寫 → 清掉", bad.amount === 0 && bad.currency === "" && bad.date === "" && bad.category === "", bad);
  r = await call({ text: "x", context: CTX }, () => okJson(JSON.stringify({ intent: "seats", seats: [], message: "" })));
  ok("以前的 seats(只改座位)當成交通", r.res.body.result.intent === "transport", r.res.body.result);
  r = await call({ text: "x", context: { days: ["亂寫"], members: "不是陣列", legs: [{ kind: "火箭" }] } }, () => okJson(GOOD));
  ok("前端亂送的 context 不會讓它掛掉", r.res.code === 200, r.res.body);

  /* ---- 第 2 期:要登入 ---- */
  r = await call({ text: "想去築地市場" }, () => okJson(GOOD), true);
  ok("沒登入 → 401,**而且一次都沒打 Gemini**(額度不會被路人用掉)",
    r.res.code === 401 && r.seen.length === 0, { code: r.res.code, seen: r.seen.length });
  /* 模型說「已加入」:那時候還沒存,那句不能給使用者看(2026-10-02) */
  r = await call({ text: "想去淺草寺" }, () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({
    intent: "wish", title: "淺草寺", day: 0, time: "", note: "", amount: 0, currency: "unknown", date: "", category: "其他", legs: [], items: [], message: "已將淺草寺加入許願清單" }) }] } }] }) }));
  ok("AI 說「已將…加入許願清單」→ 那句不給(還沒存)", r.res.code === 200 && r.res.body.result && r.res.body.result.message === "" && r.res.body.result.title === "淺草寺", r.res.body);
  r = await call({ text: "想去淺草寺" }, () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({
    intent: "wish", title: "淺草寺", day: 0, time: "", note: "", amount: 0, currency: "unknown", date: "", category: "其他", legs: [], items: [], message: "看起來是想去的地方" }) }] } }] }) }));
  ok("正常的那句照給", r.res.body.result && r.res.body.result.message === "看起來是想去的地方", r.res.body);
  /* 複合的內容(2026-10-04):一張高鐵票有班次座位也有票價 → 交通 + 花費兩份,交通在前、花費在後 */
  const LEG1 = { kind: "火車", no: "125", company: "台灣高鐵", depart: "2026-11-02T11:20", from: "南港", arrive: "2026-11-02T13:05", to: "左營", code: "", dir: "其他", match: "none", note: "", seats: [{ member: "m-aaa", seat: "5車 2C" }] };
  const EXP1 = { title: "高鐵 南港→左營", day: 0, time: "", note: "", amount: 1530, currency: "TWD", date: "2026-11-02", category: "交通" };
  r = await call({ text: "這張", context: CTX }, () => okJson(JSON.stringify({ intent: "transport", title: "", day: 0, time: "", note: "", amount: 0, currency: "unknown", date: "", category: "交通",
    legs: [LEG1], items: [], message: "高鐵票", parts: [{ intent: "expense", legs: [], items: [EXP1] }, { intent: "transport", legs: [LEG1], items: [] }] })));
  const cp = r.res.body.result;
  ok("複合:parts 兩份,交通在前、花費在後(模型先給花費也排回來)", cp.parts.length === 2 && cp.parts[0].intent === "transport" && cp.parts[1].intent === "expense", cp.parts);
  ok("複合:交通那份有座位,花費那份有票價和日期", cp.parts[0].legs[0].seats[0].seat === "5車 2C" && cp.parts[1].items[0].amount === 1530 &&
    cp.parts[1].items[0].currency === "TWD" && cp.parts[1].items[0].date === "2026-11-02" && cp.parts[1].items[0].category === "交通", cp.parts);
  ok("複合:最外層照舊(舊的前端只看最外層也接得住)", cp.intent === "transport" && cp.legs.length === 1, cp);
  r = await call({ text: "x", context: CTX }, () => okJson(JSON.stringify({ intent: "expense", title: "x", amount: 100, currency: "JPY", date: "", category: "其他", legs: [], items: [], message: "",
    parts: [{ intent: "expense", legs: [], items: [EXP1] }] })));
  ok("只有一種資料 → parts 空的(走原本的路)", r.res.body.result.parts.length === 0, r.res.body.result.parts);
  r = await call({ text: "x", context: CTX }, () => okJson(JSON.stringify({ intent: "transport", legs: [LEG1], items: [], message: "",
    parts: [{ intent: "transport", legs: [LEG1], items: [] }, { intent: "transport", legs: [LEG1], items: [] }, { intent: "expense", legs: [], items: [] }] })));
  ok("同一種重複、空的那份丟掉 → 剩一種就不算複合", r.res.body.result.parts.length === 0, r.res.body.result.parts);
  r = await call({ text: "x", context: CTX }, () => okJson(GOOD));
  ok("回應的格式有 parts(schema 裡要有它,模型才會填)", !!sent(r.seen).generationConfig.responseSchema.properties.parts && Array.isArray(r.res.body.result.parts), "");

  /* 一張收據是一筆(2026-10-05,Lulu 拿 HANDS 的收據問「為什麼拆成兩筆」):要寫在給模型的話裡,「一張收據要拆兩筆」那個例子不能再出現 */
  r = await call({ text: "這張收據", context: CTX }, () => okJson(GOOD));
  const said = JSON.stringify(sent(r.seen));
  ok("給模型的話:一張收據就是一筆、合計、品項寫 note;說要分開才拆", /一張收據就是一筆/.test(said) && /品項寫在 note/.test(said) && /分開記/.test(said) && !/一張收據要拆兩筆/.test(said), "");

  console.log(fails ? "\n✗ " + fails + " 項沒過" : "\n全部通過");
  process.exit(fails ? 1 : 0);
})();
