/* api/auth.js —— LINE 登入那一支。用法:
 *     node adopt-harness/api-auth-test.js
 *
 * 形狀照 api-ai-test.js:`global.fetch` 換成樁。所以測到的是
 * 「LINE 這樣回的時候,我寫的那段做了什麼」——**不是**「LINE 真的會這樣回」。
 * 這裡沒有 channel secret,也不該有。
 *
 * **探針碰不到這支,而且它壞掉的樣子最難看見**:簽章驗錯邊、cookie 少一個旗標、
 * state 沒比對 —— 這幾件在畫面上全都長得像「登入成功」。
 */
const path = process.env.SRC ||
  require("path").join(__dirname, "..", "tokyo-trip", "api", "auth.js");

const SECRET = "test-channel-secret";

function mkres() {
  const r = { code: 200, body: null, headers: {}, ended: false };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.getHeader = k => r.headers[k.toLowerCase()];
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.end = () => { r.ended = true; return r; };
  Object.defineProperty(r, "statusCode", {
    get() { return r.code; }, set(v) { r.code = v; },
  });
  return r;
}

async function call(query, opts) {
  const o = opts || {};
  if (o.noSecret) delete process.env.LINE_CHANNEL_SECRET;
  else process.env.LINE_CHANNEL_SECRET = SECRET;
  /* 「人」那張表。`people` 給幾列就代表現在有幾個人;沒設就當成沒有 NOTION_TOKEN,
     那條路整個跳過(既有的每一條都走這裡,所以它們一個字都不用改)。 */
  if (o.people === undefined) delete process.env.NOTION_TOKEN;
  else process.env.NOTION_TOKEN = "ntn_test";
  process.env.TRIP_MAX_PEOPLE = String(o.limit || 30);
  delete require.cache[require.resolve("../tokyo-trip/api/_people.js")];
  process.env.LINE_REDIRECT = "https://example.test/api/auth";
  delete require.cache[require.resolve(path)];
  const handler = require(path);
  const seen = [];
  global.fetch = (u, init) => {
    const su = String(u);
    /* Notion 的呼叫不算在 LINE 的次數裡 —— `stub(n)` 數的是第幾次打 LINE。 */
    if (su.indexOf("api.notion.com") >= 0) {
      notionCalls.push({ url: su, method: (init && init.method) || "GET",
                         body: String((init && init.body) || "") });
      if (o.notionDown) return Promise.resolve({ ok: false, status: 500,
        json: async () => ({ message: "Notion 掛了" }) });
      if (/\/query/.test(su)) {
        const b = JSON.parse((init && init.body) || "{}");
        const byId = b.filter && b.filter.title && b.filter.title.equals;
        const rows = o.people || [];
        return Promise.resolve({ ok: true, status: 200, json: async () => ({
          results: byId ? rows.filter(r => r.id === byId) : rows }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ id: "new" }) });
    }
    seen.push({ url: su, body: String((init && init.body) || ""), init });
    const r = (o.stub || (() => ({ ok: false, status: 500, json: async () => ({}) })))(seen.length);
    if (r === "hang") {
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
  await handler({
    method: "GET",
    query,
    headers: { host: "example.test", cookie: o.cookie || "" },
  }, res);
  return { res, seen };
}

const cookies = res => {
  const raw = res.getHeader("set-cookie") || [];
  const out = {};
  (Array.isArray(raw) ? raw : [raw]).forEach(s => {
    const name = s.slice(0, s.indexOf("="));
    out[name] = s;
  });
  return out;
};
const valueOf = line => decodeURIComponent(line.slice(line.indexOf("=") + 1, line.indexOf(";")));

const TOKEN_OK = { ok: true, status: 200, json: async () => ({ access_token: "at-123" }) };
const PROFILE_OK = { ok: true, status: 200, json: async () => ({
  userId: "U0000000000000000000000000000001", displayName: "阿輝",
  pictureUrl: "https://profile.line-scdn.net/abc" }) };
const happy = n => (n === 1 ? TOKEN_OK : PROFILE_OK);

let notionCalls = [];
let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? "✓ " : "✗ ") + name + (cond ? "" : "   ← " + JSON.stringify(extra)));
  if (!cond) fails++;
}

(async () => {
  let r;

  /* ---- 還沒設 secret ---- */
  r = await call({ go: "login" }, { noSecret: true });
  ok("沒設 secret → 說出真正的原因,不是「登入失敗」",
    r.res.code === 503 && /LINE_CHANNEL_SECRET/.test((r.res.body || {}).error || ""), r.res.body);
  r = await call({ go: "me" }, { noSecret: true });
  ok("沒設 secret 時問「我是誰」→ 沒登入,而且說得出登入還沒開",
    r.res.body.user === null && r.res.body.ready === false, r.res.body);

  /* ---- 出發 ---- */
  r = await call({ go: "login" });
  const loc = r.res.getHeader("location") || "";
  const st = cookies(r.res).trip_s;
  ok("按登入 → 轉去 LINE", r.res.code === 302 && loc.startsWith("https://access.line.me/oauth2/v2.1/authorize"), loc);
  ok("帶著 state,而且同一個 state 存進 cookie",
    !!st && loc.indexOf("state=" + encodeURIComponent(valueOf(st))) > 0, { loc, st });
  ok("state cookie 是 HttpOnly + Secure + SameSite(前端拿不到,也不會被跨站帶出去)",
    /HttpOnly/.test(st) && /Secure/.test(st) && /SameSite=Lax/.test(st), st);
  ok("**channel secret 沒有出現在轉去 LINE 的網址裡**", loc.indexOf(SECRET) < 0, loc);

  /* ---- 回呼:state 對不上 ---- */
  r = await call({ code: "c1", state: "someone-elses" }, { cookie: "trip_s=mine", stub: happy });
  ok("state 對不上 → 不換 token,直接擋掉",
    r.seen.length === 0 && /login=state/.test(r.res.getHeader("location") || ""), r.res.getHeader("location"));
  ok("而且沒有發出任何登入身分", !cookies(r.res).trip_u, cookies(r.res));

  /* ---- 回呼:正常 ---- */
  r = await call({ code: "c1", state: "s1" }, { cookie: "trip_s=s1", stub: happy });
  const sess = cookies(r.res).trip_u;
  ok("換 token 用的 redirect_uri 跟出發那次是同一個字串",
    /redirect_uri=https%3A%2F%2Fexample.test%2Fapi%2Fauth/.test(r.seen[0].body), r.seen[0].body);
  ok("登入成功 → 發身分 cookie,並且回首頁",
    !!sess && /login=ok/.test(r.res.getHeader("location") || ""), r.res.getHeader("location"));
  ok("身分 cookie 是 HttpOnly + Secure(前端 JS 讀不到,只能問伺服器)",
    /HttpOnly/.test(sess) && /Secure/.test(sess) && /SameSite=Lax/.test(sess), sess);
  ok("**secret 沒有跟著 cookie 出去**", sess.indexOf(SECRET) < 0, sess);

  const good = valueOf(sess);
  r = await call({ go: "me" }, { cookie: "trip_u=" + encodeURIComponent(good) });
  ok("拿著這張 cookie 回來問 → 認得出是誰",
    (r.res.body.user || {}).name === "阿輝" &&
    (r.res.body.user || {}).id === "U0000000000000000000000000000001", r.res.body);

  /* ---- 竄改 ---- */
  const parts = good.split(".");
  const forged = "v1." + Buffer.from(JSON.stringify({
    sub: "U9", name: "我是管理員", pic: "", exp: Date.now() + 86400000,
  })).toString("base64url") + "." + parts[2];
  r = await call({ go: "me" }, { cookie: "trip_u=" + encodeURIComponent(forged) });
  ok("**自己改 cookie 裡的名字 → 認不出來**(不是「換一個人」,是沒登入)",
    r.res.body.user === null, r.res.body);

  const wrongMac = parts[0] + "." + parts[1] + "." + parts[2].split("").reverse().join("");
  r = await call({ go: "me" }, { cookie: "trip_u=" + encodeURIComponent(wrongMac) });
  ok("簽章亂改 → 認不出來", r.res.body.user === null, r.res.body);

  r = await call({ go: "me" }, { cookie: "trip_u=not-a-cookie-at-all" });
  ok("整串亂七八糟 → 認不出來,而且不是丟例外", r.res.body.user === null, r.res.body);

  /* ---- 過期 ---- */
  {
    const crypto = require("crypto");
    const key = crypto.createHash("sha256").update(SECRET + "|tokyo-trip-session").digest();
    const body = Buffer.from(JSON.stringify({ sub: "U1", name: "過期的人", pic: "", exp: Date.now() - 1000 })).toString("base64url");
    const mac = crypto.createHmac("sha256", key).update(body).digest().toString("base64url");
    r = await call({ go: "me" }, { cookie: "trip_u=" + encodeURIComponent("v1." + body + "." + mac) });
    ok("簽章對但過期 → 認不出來(**簽章對不等於還有效**)", r.res.body.user === null, r.res.body);
  }

  /* ---- 使用者按取消 ---- */
  r = await call({ error: "access_denied", error_description: "user denied" });
  ok("在 LINE 那頁按取消 → 回首頁說一句,不是錯誤頁",
    r.res.code === 302 && /login=cancel/.test(r.res.getHeader("location") || ""), r.res.getHeader("location"));

  /* ---- LINE 那邊出事 ---- */
  r = await call({ code: "c1", state: "s1" }, { cookie: "trip_s=s1",
    stub: n => (n === 1 ? { ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) } : PROFILE_OK) });
  ok("換 token 被拒 → 回首頁,不發身分",
    /login=token/.test(r.res.getHeader("location") || "") && !cookies(r.res).trip_u, r.res.getHeader("location"));

  const t0 = Date.now();
  r = await call({ code: "c1", state: "s1" }, { cookie: "trip_s=s1", stub: () => "hang" });
  const took = Date.now() - t0;
  ok("LINE 不回應 → 有 timeout,不會一直掛著(" + took + "ms)",
    took < 12000 && /login=fail/.test(r.res.getHeader("location") || ""), { took, loc: r.res.getHeader("location") });
  ok("而且網址上只有一個代號,沒有原始錯誤",
    !/aborted|Error|timeout/i.test(r.res.getHeader("location") || ""), r.res.getHeader("location"));

  /* ---- 試用名額 ---- */
  const person = id => ({ id });
  const thirty = Array.from({ length: 30 }, (_, i) => person("U" + i));

  notionCalls = [];
  r = await call({ code: "c1", state: "s1" },
    { cookie: "trip_s=s1", stub: happy, people: thirty });
  ok("**名額滿了 → 擋在登入,而且不發身分**",
    /login=full/.test(r.res.getHeader("location") || "") && !cookies(r.res).trip_u,
    { loc: r.res.getHeader("location"), cookie: cookies(r.res).trip_u });
  ok("而且沒有把第三十一個人寫進去",
    !notionCalls.some(c => c.method === "POST" && /\/pages$/.test(c.url)), notionCalls.map(c => c.method + " " + c.url));

  notionCalls = [];
  r = await call({ code: "c1", state: "s1" },
    { cookie: "trip_s=s1", stub: happy, people: thirty.slice(0, 29) });
  ok("還有位子 → 進得來,而且真的寫進「人」那張表",
    !!cookies(r.res).trip_u &&
    notionCalls.some(c => c.method === "POST" && /\/pages$/.test(c.url)), notionCalls.length);

  notionCalls = [];
  const me = { id: "U0000000000000000000000000000001" };
  r = await call({ code: "c1", state: "s1" },
    { cookie: "trip_s=s1", stub: happy, people: thirty.map((x, i) => i ? x : me) });
  ok("**來過的人不佔新名額** —— 滿的時候他照樣進得來",
    !!cookies(r.res).trip_u, cookies(r.res));
  ok("而且是更新那一列,不是又開一列",
    notionCalls.some(c => c.method === "PATCH") &&
    !notionCalls.some(c => c.method === "POST" && /\/pages$/.test(c.url)),
    notionCalls.map(c => c.method));

  r = await call({ code: "c1", state: "s1" },
    { cookie: "trip_s=s1", stub: happy, people: thirty, notionDown: true });
  ok("**Notion 掛掉時放行,不是把所有人鎖在外面**(那張表是記帳用的,不是安全邊界)",
    !!cookies(r.res).trip_u && /login=ok/.test(r.res.getHeader("location") || ""),
    { loc: r.res.getHeader("location") });

  /* ---- 登出 ---- */
  r = await call({ go: "logout" }, { cookie: "trip_u=" + encodeURIComponent(good) });
  ok("登出 → 把 cookie 收掉", /trip_u=;/.test(cookies(r.res).trip_u || "") &&
    /Max-Age=0/.test(cookies(r.res).trip_u || ""), cookies(r.res));

  console.log(fails ? "\n✗ " + fails + " 項沒過" : "\n全部通過");
  process.exit(fails ? 1 : 0);
})();
