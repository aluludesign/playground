// Trippps · LINE 登入
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
const S = require("./_session.js");
const P = require("./_people.js");

const AUTHZ = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN = "https://api.line.me/oauth2/v2.1/token";
const PROFILE = "https://api.line.me/v2/profile";

const CHANNEL_ID = process.env.LINE_CHANNEL_ID || "2011733122";
const CALL_MS = 10000;

/* 簽章、cookie、「這次是誰」都在 `_session.js`。**發票的是這裡,驗票的是 notion.js**,
   兩邊看的必須是同一件事 —— 複製一份的話,改了格式會變成「發的人改了、驗的人沒改」,
   而症狀是所有人突然都變成沒登入,一行錯誤訊息都沒有。 */

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

  const key = S.hmacKey();
  const go = String((req.query && req.query.go) || "");
  const q = req.query || {};

  /* 沒設 secret 就一件事都不要做。**不是回「登入失敗」** —— 那會讓人一直重試
     一個永遠不會成功的按鈕。說出真正的原因,而且說給看得懂的人聽。 */
  if (!key) {
    if (go === "me") return res.status(200).json({ user: null, ready: false });
    return res.status(503).json({ error: "伺服器還沒設定 LINE_CHANNEL_SECRET,登入目前不能用" });
  }

  if (go === "me") {
    const u = S.unsign(S.readCookies(req)[S.SESSION_COOKIE], key);
    return res.status(200).json({ user: u ? { id: u.sub, name: u.name, avatar: u.pic || "" } : null, ready: true });
  }

  if (go === "logout") {
    S.clearCookie(res, S.SESSION_COOKIE);
    return home(res);
  }

  if (go === "login") {
    /* state 擋的是「別人把一段 callback 網址塞給你點」。存成 cookie 再比對,
       意思是「這趟是從這台瀏覽器出發的」。 */
    const state = crypto.randomBytes(16).toString("base64url");
    S.setCookie(res, S.STATE_COOKIE, state, 600);
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

  const want = S.readCookies(req)[S.STATE_COOKIE];
  S.clearCookie(res, S.STATE_COOKIE);
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

    const who = {
      sub: pj.userId,
      name: String(pj.displayName || "").slice(0, 60),
      pic: String(pj.pictureUrl || "").slice(0, 300),
    };

    /* **名額滿了就在這裡擋,而且不要發身分。** 發了再擋的話,他會拿著一張
       登入成功的票看到一個處處說不行的畫面 —— 那比一開始就講清楚更難懂。
       (Notion 那邊出事時 `seeUser` 會放行,理由寫在 `_people.js`:
        那張表是記帳用的,不是安全邊界。) */
    const seen = await P.seeUser(who);
    if (!seen.ok) return home(res, "login=full");

    S.setCookie(res, S.SESSION_COOKIE, S.sign(Object.assign({
      exp: Date.now() + S.SESSION_DAYS * 86400000,
    }, who), key), S.SESSION_DAYS * 86400);
    return home(res, "login=ok");
  } catch (_) {
    /* 逾時、LINE 掛掉、網路斷掉都到這裡。**不要把原始錯誤丟到網址上** ——
       那一串對使用者沒有意義,而且有機會把內部細節印在網址列上。 */
    return home(res, "login=fail");
  }
};
