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
  r.end = b => { r.ended = true; if (b) r._html = String(b); return r; };
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
    if (su.indexOf("api.notion.com") >= 0 && o.notionFake) {
      notionCalls.push({ url: su, method: (init && init.method) || "GET", body: String((init && init.body) || "") });
      return Promise.resolve(o.notionFake(su, init));
    }
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
    method: o.method || "GET",
    query,
    headers: { host: o.host || "example.test", cookie: o.cookie || "" },
    body: o.body,
  }, res);
  return { res, seen };
}

const txtOf = p => ((p && (p.title || p.rich_text)) || []).map(t => t.plain_text || (t.text && t.text.content)).join("");
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

/* state 現在是簽過名的一小包({ n: 亂數, h: 出發網域, app, exp }),cookie 裡只存 n。
   測試要自己簽一張 —— 跟伺服器用同一把鑰匙(從 secret 推出來的)。 */
const SESS = require("../tokyo-trip/api/_session.js");
function stateFor(n, h, app, exp) {
  process.env.LINE_CHANNEL_SECRET = SECRET;
  return SESS.sign({ n, h: h || "example.test", app: app ? 1 : 0, exp: exp || Date.now() + 600000 }, SESS.hmacKey());
}
const S1 = stateFor("s1");

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
  const sentState = new URL(loc).searchParams.get("state") || "";
  const opened = SESS.unsign(sentState, SESS.hmacKey()) || {};
  ok("帶著簽過名的 state,裡面那串亂數跟 cookie 存的是同一個",
    !!st && !!opened.n && opened.n === valueOf(st), { opened, st });
  ok("state 記著從哪個網域出發(回來時才知道要送回哪裡)", opened.h === "example.test", opened);
  ok("state cookie 是 HttpOnly + Secure + SameSite(前端拿不到,也不會被跨站帶出去)",
    /HttpOnly/.test(st) && /Secure/.test(st) && /SameSite=Lax/.test(st), st);
  ok("**channel secret 沒有出現在轉去 LINE 的網址裡**", loc.indexOf(SECRET) < 0, loc);

  /* ---- 回呼:state 對不上 ---- */
  r = await call({ code: "c1", state: "someone-elses" }, { cookie: "trip_s=mine", stub: happy });
  ok("state 對不上 → 不換 token,直接擋掉",
    r.seen.length === 0 && /login=state/.test(r.res.getHeader("location") || ""), r.res.getHeader("location"));
  ok("而且沒有發出任何登入身分", !cookies(r.res).trip_u, cookies(r.res));

  /* ---- 回呼:正常 ---- */
  r = await call({ code: "c1", state: S1 }, { cookie: "trip_s=s1", stub: happy });
  const sess = cookies(r.res).trip_u;
  ok("換 token 用的 redirect_uri 跟出發那次是同一個字串",
    /redirect_uri=https%3A%2F%2Fexample.test%2Fapi%2Fauth/.test(r.seen[0].body), r.seen[0].body);
  ok("登入成功 → 發身分 cookie,並且回首頁",
    !!sess && /login=ok/.test(r.res.getHeader("location") || ""), r.res.getHeader("location"));
  ok("身分 cookie 是 HttpOnly + Secure(前端 JS 讀不到,只能問伺服器)",
    /HttpOnly/.test(sess) && /Secure/.test(sess) && /SameSite=Lax/.test(sess), sess);
  ok("**secret 沒有跟著 cookie 出去**", sess.indexOf(SECRET) < 0, sess);

  /* ---- 登入完回到出發的那一頁(第 2 期:邀請連結 /?t=…&i=…) ---- */
  r = await call({ go: "login", back: "/?t=k7p2x9ab&i=q4wn8t" });
  ok("出發時把那一頁記下來", /trip_b=/.test(cookies(r.res).trip_b || "") &&
    decodeURIComponent(cookies(r.res).trip_b).indexOf("/?t=k7p2x9ab&i=q4wn8t") >= 0, cookies(r.res).trip_b);
  r = await call({ code: "c1", state: S1 },
    { cookie: "trip_s=s1; trip_b=" + encodeURIComponent("/?t=k7p2x9ab&i=q4wn8t"), stub: happy });
  ok("回來之後落在那一頁,後面接上 login=ok(邀請沒有不見)",
    r.res.getHeader("location") === "/?t=k7p2x9ab&i=q4wn8t&login=ok", r.res.getHeader("location"));
  for (const evil of ["//evil.example/x", "https://evil.example", "/\\evil.example", "javascript:alert(1)", "/?t=<x>"]) {
    r = await call({ go: "login", back: evil });
    ok("**不是站內路徑就不記(" + evil + ")** —— 不然登入完會被送去別的網站",
      decodeURIComponent(cookies(r.res).trip_b || "").split(";")[0] === "trip_b=/", cookies(r.res).trip_b);
  }
  r = await call({ code: "c1", state: S1 },
    { cookie: "trip_s=s1; trip_b=" + encodeURIComponent("//evil.example"), stub: happy });
  ok("cookie 被竄改成外站 → 回呼那一步也擋,回首頁", r.res.getHeader("location") === "/?login=ok", r.res.getHeader("location"));

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
  r = await call({ code: "c1", state: S1 }, { cookie: "trip_s=s1",
    stub: n => (n === 1 ? { ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) } : PROFILE_OK) });
  ok("換 token 被拒 → 回首頁,不發身分",
    /login=token/.test(r.res.getHeader("location") || "") && !cookies(r.res).trip_u, r.res.getHeader("location"));

  const t0 = Date.now();
  r = await call({ code: "c1", state: S1 }, { cookie: "trip_s=s1", stub: () => "hang" });
  const took = Date.now() - t0;
  ok("LINE 不回應 → 有 timeout,不會一直掛著(" + took + "ms)",
    took < 12000 && /login=fail/.test(r.res.getHeader("location") || ""), { took, loc: r.res.getHeader("location") });
  ok("而且網址上只有一個代號,沒有原始錯誤",
    !/aborted|Error|timeout/i.test(r.res.getHeader("location") || ""), r.res.getHeader("location"));

  /* ---- 試用名額 ---- */
  const person = id => ({ id });
  const thirty = Array.from({ length: 30 }, (_, i) => person("U" + i));

  notionCalls = [];
  r = await call({ code: "c1", state: S1 },
    { cookie: "trip_s=s1", stub: happy, people: thirty });
  ok("**名額滿了 → 擋在登入,而且不發身分**",
    /login=full/.test(r.res.getHeader("location") || "") && !cookies(r.res).trip_u,
    { loc: r.res.getHeader("location"), cookie: cookies(r.res).trip_u });
  ok("而且沒有把第三十一個人寫進去",
    !notionCalls.some(c => c.method === "POST" && /\/pages$/.test(c.url)), notionCalls.map(c => c.method + " " + c.url));

  notionCalls = [];
  r = await call({ code: "c1", state: S1 },
    { cookie: "trip_s=s1", stub: happy, people: thirty.slice(0, 29) });
  ok("還有位子 → 進得來,而且真的寫進「人」那張表",
    !!cookies(r.res).trip_u &&
    notionCalls.some(c => c.method === "POST" && /\/pages$/.test(c.url)), notionCalls.length);

  notionCalls = [];
  const me = { id: "U0000000000000000000000000000001" };
  r = await call({ code: "c1", state: S1 },
    { cookie: "trip_s=s1", stub: happy, people: thirty.map((x, i) => i ? x : me) });
  ok("**來過的人不佔新名額** —— 滿的時候他照樣進得來",
    !!cookies(r.res).trip_u, cookies(r.res));
  ok("而且是更新那一列,不是又開一列",
    notionCalls.some(c => c.method === "PATCH") &&
    !notionCalls.some(c => c.method === "POST" && /\/pages$/.test(c.url)),
    notionCalls.map(c => c.method));

  r = await call({ code: "c1", state: S1 },
    { cookie: "trip_s=s1", stub: happy, people: thirty, notionDown: true });
  ok("**Notion 掛掉時放行,不是把所有人鎖在外面**(那張表是記帳用的,不是安全邊界)",
    !!cookies(r.res).trip_u && /login=ok/.test(r.res.getHeader("location") || ""),
    { loc: r.res.getHeader("location") });

  /* ---- 登出 ---- */
  r = await call({ go: "logout" }, { cookie: "trip_u=" + encodeURIComponent(good) });
  ok("登出 → 把 cookie 收掉", /trip_u=;/.test(cookies(r.res).trip_u || "") &&
    /Max-Age=0/.test(cookies(r.res).trip_u || ""), cookies(r.res));


  /* ================= 第 2 期:preview 借登入網域登入 =================
     LINE 只登記一個網域(這裡是 example.test,正式站的替身)。preview 出發的,
     登入網域驗完身分發一張 60 秒的票,送回 preview 自己收。 */
  const PV = "playground-git-feat-x-lulu-6af6.vercel.app";
  r = await call({ go: "login", back: "/?t=abc" }, { host: PV });
  const pvLoc = new URL(r.res.getHeader("location"));
  const pvState = SESS.unsign(pvLoc.searchParams.get("state"), SESS.hmacKey()) || {};
  ok("preview 出發:LINE 的回呼網址還是登入網域那一個(LINE 後台不用再加一行)",
    pvLoc.searchParams.get("redirect_uri") === "https://example.test/api/auth", pvLoc.searchParams.get("redirect_uri"));
  ok("而且 state 記著是從哪個 preview 出發的", pvState.h === PV, pvState);
  const pvN = valueOf(cookies(r.res).trip_s);

  r = await call({ code: "c1", state: stateFor(pvN, PV) }, { stub: happy });
  const toPv = r.res.getHeader("location") || "";
  ok("回到登入網域 → 驗完身分,把人送回那個 preview 的 go=take", toPv.indexOf("https://" + PV + "/api/auth?go=take&ticket=") === 0, toPv);
  ok("**登入網域自己不發身分**(人不在這裡,cookie 發在這裡沒有用)", !cookies(r.res).trip_u, cookies(r.res));
  const ticket = new URL(toPv).searchParams.get("ticket");

  r = await call({ go: "take", ticket }, { host: PV, cookie: "trip_s=" + pvN + "; trip_b=" + encodeURIComponent("/?t=abc") });
  const pvSess = cookies(r.res).trip_u;
  ok("preview 收下票 → 發身分,回到出發那一頁", !!pvSess && r.res.getHeader("location") === "/?t=abc&login=ok", r.res.getHeader("location"));
  ok("發出去的身分就是 LINE 說的那個人", /U0000000000000000000000000000001/.test(JSON.stringify(SESS.unsign(valueOf(pvSess), SESS.hmacKey()) || {})),
    SESS.unsign(valueOf(pvSess), SESS.hmacKey()));
  r = await call({ go: "take", ticket }, { host: PV, cookie: "trip_s=someone-else" });
  ok("**票被塞給別人點**(他的瀏覽器裡沒有那串亂數)→ 不發身分", !cookies(r.res).trip_u && /login=state/.test(r.res.getHeader("location")), r.res.getHeader("location"));
  r = await call({ go: "take", ticket }, { host: "playground-git-other-lulu-6af6.vercel.app", cookie: "trip_s=" + pvN });
  ok("票拿去另一個 preview 用 → 不發身分(票寫死了要給哪一個網域)", !cookies(r.res).trip_u, r.res.getHeader("location"));
  const oldTicket = SESS.sign({ t: "hand", h: PV, n: pvN, sub: "U123", name: "x", pic: "", exp: Date.now() - 1000 }, SESS.hmacKey());
  r = await call({ go: "take", ticket: oldTicket }, { host: PV, cookie: "trip_s=" + pvN });
  ok("過期的票(超過 60 秒)→ 不發身分", !cookies(r.res).trip_u, r.res.getHeader("location"));
  r = await call({ go: "take", ticket: SESS.sign({ n: pvN, h: PV, exp: Date.now() + 60000 }, SESS.hmacKey()) }, { host: PV, cookie: "trip_s=" + pvN });
  ok("拿 state 冒充票(簽名對、種類不對)→ 不發身分", !cookies(r.res).trip_u, r.res.getHeader("location"));

  r = await call({ code: "c1", state: stateFor("n9", "evil.example") }, { stub: happy });
  ok("**state 說要送去別的網站 → 擋掉,連 token 都不換**", r.seen.length === 0 && !/evil/.test(r.res.getHeader("location") || ""),
    { seen: r.seen.length, loc: r.res.getHeader("location") });
  r = await call({ code: "c1", state: stateFor(pvN, PV) }, { stub: () => ({ ok: false, status: 400, json: async () => ({}) }) });
  ok("preview 出發、LINE 那邊失敗 → 送回 preview 講(不是留在登入網域)",
    r.res.getHeader("location") === "https://" + PV + "/api/auth?go=take&err=token", r.res.getHeader("location"));
  r = await call({ go: "take", err: "token" }, { host: PV, cookie: "trip_b=" + encodeURIComponent("/?t=abc") });
  ok("preview 收到失敗 → 回出發那一頁說一句", r.res.getHeader("location") === "/?t=abc&login=token", r.res.getHeader("location"));
  r = await call({ go: "take", err: "<script>" }, { host: PV });
  ok("失敗的理由不是一個字 → 不照抄進網址", r.res.getHeader("location") === "/?login=fail", r.res.getHeader("location"));

  /* ================= 第 2 期:iPhone 主畫面 App 的登入碼 ================= */
  const pdb = [{ id: "row-u123", properties: { "LINE ID": { title: [{ plain_text: "U0000000000000000000000000000001" }] },
    "名字": { rich_text: [{ plain_text: "阿輝" }] }, "頭像": { url: "" } } }];
  const pfake = (url, init) => {
    const b = JSON.parse((init && init.body) || "{}");
    const ok200 = body => ({ ok: true, status: 200, json: async () => body });
    const txt = p => ((p && (p.title || p.rich_text)) || []).map(t => t.plain_text || (t.text && t.text.content)).join("");
    if (/\/query/.test(url)) {
      const f = b.filter || {};
      const rows = f.title ? pdb.filter(r => txt(r.properties["LINE ID"]) === f.title.equals)
        : f.rich_text ? pdb.filter(r => txt(r.properties[f.property]) && txt(r.properties[f.property]) === f.rich_text.equals)
        : pdb;
      return ok200({ results: JSON.parse(JSON.stringify(rows)), has_more: false });
    }
    const m = /\/pages\/([^/]+)$/.exec(url);
    if (m) { const row = pdb.find(r => r.id === m[1]); Object.assign(row.properties, b.properties || {}); return ok200(row); }
    return ok200({ id: "new" });
  };
  r = await call({ go: "login", app: "1" }, {});
  const appState = SESS.unsign(new URL(r.res.getHeader("location")).searchParams.get("state"), SESS.hmacKey()) || {};
  ok("App 出發 → state 記著 app", appState.app === 1, appState);
  r = await call({ code: "c1", state: stateFor("app-n", "example.test", true) }, { stub: happy, people: [], notionFake: pfake });
  const html = String(r.res.headers["__body"] || "");
  const shownCode = (/(?:>)([A-Z2-9]{4})-([A-Z2-9]{4})</.exec(r.res.ended ? (r.res._html || "") : "") || []);
  ok("App 出發、在瀏覽器登入完 → 印一頁登入碼(**沒有 cookie 也放行**:App 的 cookie 在 App 那邊)",
    r.res.code === 200 && /text\/html/.test(r.res.getHeader("content-type") || "") && !!r.res._html && /回到 Trippps App/.test(r.res._html),
    { code: r.res.code, html: (r.res._html || "").slice(0, 200) });
  const code = txtOf(pdb[0].properties["登入碼"]);
  ok("登入碼寫進了那個人那一列,8 碼、沒有 0/O/1/I/L", /^[A-HJ-KM-NP-Z2-9]{8}$/.test(code) && (r.res._html || "").indexOf(code.slice(0, 4) + "-" + code.slice(4)) >= 0, code);
  ok("瀏覽器這邊也順便登入了(之後用瀏覽器開不用再登一次)", !!cookies(r.res).trip_u, cookies(r.res));

  r = await call({ go: "code" }, { method: "POST", body: JSON.stringify({ code: "abc" }), notionFake: pfake });
  ok("登入碼格式不對 → 400", r.res.code === 400, r.res.body);
  r = await call({ go: "code" }, { method: "POST", body: JSON.stringify({ code: "ZZZZZZZZ" }), notionFake: pfake });
  ok("登入碼不對 → 403,不發身分", r.res.code === 403 && !cookies(r.res).trip_u, r.res.body);
  r = await call({ go: "code" }, { method: "POST", body: JSON.stringify({ code: code.slice(0, 4) + "-" + code.slice(4).toLowerCase() }), notionFake: pfake });
  ok("App 貼上登入碼(照抄那個 - 也行、小寫也行)→ 發身分", r.res.code === 200 && !!cookies(r.res).trip_u && r.res.body.user.id === "U0000000000000000000000000000001", r.res.body);
  r = await call({ go: "code" }, { method: "POST", body: JSON.stringify({ code }), notionFake: pfake });
  ok("**同一組碼用第二次 → 不行**(用過就清掉)", r.res.code === 403 && !cookies(r.res).trip_u, r.res.body);
  pdb[0].properties["登入碼"] = { rich_text: [{ plain_text: "OLDCODE9" }] };
  pdb[0].properties["登入碼到期"] = { date: { start: new Date(Date.now() - 1000).toISOString() } };
  r = await call({ go: "code" }, { method: "POST", body: JSON.stringify({ code: "OLDCODE9" }), notionFake: pfake });
  ok("過期的碼(超過 10 分鐘)→ 不行", r.res.code === 403 && !cookies(r.res).trip_u, r.res.body);
  r = await call({ go: "code" }, { method: "POST", body: JSON.stringify({ code: "ABCDEFGH" }), notionFake: () => ({ ok: false, status: 500, json: async () => ({ message: "掛了" }) }) });
  ok("Notion 讀不到 → 503 並說等一下(不是假裝碼不對)", r.res.code === 503, r.res.body);

  console.log(fails ? "\n✗ " + fails + " 項沒過" : "\n全部通過");
  process.exit(fails ? 1 : 0);
})();
