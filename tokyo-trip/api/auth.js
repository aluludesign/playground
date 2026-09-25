// 東京五人行 · LINE 登入
//
// 做的事只有一件:**把「你是誰」變成一件伺服器知道、前端偽造不了的事。**
// 在這之前,「我是誰」是 localStorage 裡一個字串,誰都能改成別人。
//
// 需要的環境變數:
//   LINE_CHANNEL_SECRET   LINE Developers → 你的 Login channel → Basic settings
//                         **只放在這裡,不進前端、不進 git。**
//   LINE_CHANNEL_ID       選填,預設就是下面那組(Channel ID 是公開值)
//   LINE_REDIRECT         選填,回呼網址。不設就從這次請求的網域推出來 ——
//                         也就是說 **只有註冊過的網域登得進去**(LINE 會比對),
//                         預覽部署要登入的話,那個網址也要加進 channel 的
//                         Callback URL 清單。
//
// 網址:
//   /api/auth?go=login    → 轉去 LINE 問「你要授權嗎」
//   /api/auth?code=…      → LINE 問完把人送回這裡(這就是註冊的 Callback URL)
//   /api/auth?go=me       → 現在是誰(JSON;沒登入就是 {user:null})
//   /api/auth?go=logout   → 清掉

const crypto = require("crypto");

const AUTHZ = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN = "https://api.line.me/oauth2/v2.1/token";
const PROFILE = "https://api.line.me/v2/profile";

const CHANNEL_ID = process.env.LINE_CHANNEL_ID || "2011733122";
const SESSION_COOKIE = "trip_u";
const STATE_COOKIE = "trip_s";
const SESSION_DAYS = 30;
const CALL_MS = 10000;

/* ---------- 簽章 ----------

   session cookie 的內容是明文的(名字、頭像網址),重點不是藏起來,是
   **不能被改**。所以帶一段 HMAC;金鑰從 channel secret 推出來,不另外
   跟使用者要第二個密鑰 —— 少一個要保管的東西就少一個會外流的東西。
   推導過一次的用意是:萬一簽章外洩也推不回 channel secret。 */
function hmacKey() {
  const s = process.env.LINE_CHANNEL_SECRET;
  if (!s) return null;
  return crypto.createHash("sha256").update(s + "|tokyo-trip-session").digest();
}
const b64u = buf => Buffer.from(buf).toString("base64url");

function sign(obj, key) {
  const body = b64u(JSON.stringify(obj));
  const mac = b64u(crypto.createHmac("sha256", key).update(body).digest());
  return "v1." + body + "." + mac;
}

/* 壞掉的 cookie 一律回 null,不丟例外 —— 使用者不該因為手上有一張過期的票
   就看到一個錯誤頁。回 null 的意思是「沒登入」,而那是有畫面的狀態。 */
function unsign(raw, key) {
  if (!raw || !key) return null;
  const parts = String(raw).split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const want = Buffer.from(crypto.createHmac("sha256", key).update(parts[1]).digest().toString("base64url"));
  const got = Buffer.from(parts[2]);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  let obj;
  try { obj = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")); }
  catch (_) { return null; }
  if (!obj || typeof obj !== "object") return null;
  if (!obj.exp || Date.now() > obj.exp) return null;
  return obj;
}

/* ---------- cookie ---------- */
function readCookies(req) {
  const out = {};
  const raw = req.headers.cookie || "";
  raw.split(";").forEach(p => {
    const i = p.indexOf("=");
    if (i < 0) return;
    out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function setCookie(res, name, value, maxAge) {
  const bits = [
    name + "=" + encodeURIComponent(value),
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=" + maxAge,
  ];
  const prev = res.getHeader("Set-Cookie");
  const all = prev ? (Array.isArray(prev) ? prev.slice() : [prev]) : [];
  all.push(bits.join("; "));
  res.setHeader("Set-Cookie", all);
}
const clearCookie = (res, name) => setCookie(res, name, "", 0);

/* ---------- 回呼網址 ----------

   **必須跟 LINE 後台填的那一行一模一樣**,LINE 會逐字比對,差一個斜線就
   `redirect_uri` 不符。所以這裡只有一個地方算它,發出去和換 token 都用同一個
   —— 兩邊各算一次的話,哪天改了網域就會變成一邊對一邊錯。 */
function redirectUri(req) {
  if (process.env.LINE_REDIRECT) return process.env.LINE_REDIRECT;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return "https://" + host + "/api/auth";
}

/* 登入成功或失敗都回首頁,理由帶在網址上給前端講人話。
   直接在這裡印一頁錯誤訊息的話,使用者會卡在一個沒有「回去」的畫面上。 */
function home(res, query) {
  res.statusCode = 302;
  res.setHeader("Location", "/" + (query ? "?" + query : ""));
  res.end();
}

async function post(url, body) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), CALL_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: ctl.signal,
    });
  } finally { clearTimeout(t); }
}
async function get(url, token) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), CALL_MS);
  try {
    return await fetch(url, { headers: { Authorization: "Bearer " + token }, signal: ctl.signal });
  } finally { clearTimeout(t); }
}

/* ---------- 入口 ---------- */
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const key = hmacKey();
  const go = String((req.query && req.query.go) || "");
  const q = req.query || {};

  /* 沒設 secret 就一件事都不要做。**不是回「登入失敗」** —— 那會讓人一直重試
     一個永遠不會成功的按鈕。說出真正的原因,而且說給看得懂的人聽。 */
  if (!key) {
    if (go === "me") return res.status(200).json({ user: null, ready: false });
    return res.status(503).json({ error: "伺服器還沒設定 LINE_CHANNEL_SECRET,登入目前不能用" });
  }

  if (go === "me") {
    const u = unsign(readCookies(req)[SESSION_COOKIE], key);
    return res.status(200).json({ user: u ? { id: u.sub, name: u.name, avatar: u.pic || "" } : null, ready: true });
  }

  if (go === "logout") {
    clearCookie(res, SESSION_COOKIE);
    return home(res);
  }

  if (go === "login") {
    /* state 擋的是「別人把一段 callback 網址塞給你點」。存成 cookie 再比對,
       意思是「這趟是從這台瀏覽器出發的」。 */
    const state = crypto.randomBytes(16).toString("base64url");
    setCookie(res, STATE_COOKIE, state, 600);
    const url = AUTHZ + "?" + new URLSearchParams({
      response_type: "code",
      client_id: CHANNEL_ID,
      redirect_uri: redirectUri(req),
      state,
      scope: "profile openid",
    });
    res.statusCode = 302;
    res.setHeader("Location", url);
    return res.end();
  }

  /* ---------- 回呼 ---------- */

  /* 使用者在 LINE 那頁按了取消,也會走這裡。那不是錯誤,是一個決定。 */
  if (q.error) return home(res, "login=cancel");

  if (!q.code) {
    /* 不帶任何參數直接打這支的人(含搜尋引擎)——給他一個入口就好 */
    return res.status(200).json({ ok: true, hint: "/api/auth?go=login" });
  }

  const want = readCookies(req)[STATE_COOKIE];
  clearCookie(res, STATE_COOKIE);
  if (!want || String(q.state || "") !== want) return home(res, "login=state");

  try {
    const tok = await post(TOKEN, new URLSearchParams({
      grant_type: "authorization_code",
      code: String(q.code),
      redirect_uri: redirectUri(req),
      client_id: CHANNEL_ID,
      client_secret: process.env.LINE_CHANNEL_SECRET,
    }).toString());
    const tj = await tok.json().catch(() => ({}));
    if (!tok.ok || !tj.access_token) return home(res, "login=token");

    const pr = await get(PROFILE, tj.access_token);
    const pj = await pr.json().catch(() => ({}));
    if (!pr.ok || !pj.userId) return home(res, "login=profile");

    setCookie(res, SESSION_COOKIE, sign({
      sub: pj.userId,
      name: String(pj.displayName || "").slice(0, 60),
      pic: String(pj.pictureUrl || "").slice(0, 300),
      exp: Date.now() + SESSION_DAYS * 86400000,
    }, key), SESSION_DAYS * 86400);
    return home(res, "login=ok");
  } catch (_) {
    /* 逾時、LINE 掛掉、網路斷掉都到這裡。**不要把原始錯誤丟到網址上** ——
       那一串對使用者沒有意義,而且有機會把內部細節印在網址列上。 */
    return home(res, "login=fail");
  }
};
