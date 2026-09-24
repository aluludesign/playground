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
async function call(body, stub) {
  process.env.GEMINI_KEY = "test-key";
  delete require.cache[require.resolve(path)];
  const handler = require(path);
  const seen = [];
  global.fetch = (u, init) => {
    seen.push({ url: String(u), headers: (init && init.headers) || {} });
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
  await handler({ method: "POST", body: JSON.stringify(body) }, res);
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

  console.log(fails ? "\n✗ " + fails + " 項沒過" : "\n全部通過");
  process.exit(fails ? 1 : 0);
})();
