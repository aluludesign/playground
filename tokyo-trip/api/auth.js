// Trippps · LINE 登入
//
// 做的事只有一件:**把「你是誰」變成一件伺服器知道、前端偽造不了的事。**
// 在這之前,「我是誰」是 localStorage 裡一個字串,誰都能改成別人。
//
// 需要的環境變數:
//   LINE_CHANNEL_SECRET   LINE Developers → 你的 Login channel → Basic settings
//                         **只放在這裡,不進前端、不進 git。**
//   LINE_CHANNEL_ID       選填,預設就是下面那組(Channel ID 是公開值)
//   LOGIN_HOST            選填,登入網域(LINE 一律回到這裡)。預設正式站。
//                         **LINE 後台的 Callback URL 只要登記這一個網域的 /api/auth。**
//   LINE_REDIRECT         選填,直接指定回呼網址(設了就蓋掉 LOGIN_HOST)。驗收工具用。
//   PREVIEW_HOSTS         選填,登入票可以送去哪些 preview 網域(正規表示式)。
//
// 網址:
//   /api/auth?go=login    → 轉去 LINE 問「你要授權嗎」(&app=1:主畫面 App 出發,回來給登入碼)
//   /api/auth?go=take     → preview 收下登入網域發的票
//   /api/auth?go=code     → 主畫面 App 拿登入碼換票
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
/* **第 2 期起,LINE 一律回到同一個網域(正式站)。** 以前是「從哪個網域出發就回哪個」,
   代價是每開一個分支,Lulu 就要去 LINE 後台多登記一行 Callback URL。
   現在 LINE 那邊只登記正式站那一行;preview 出發的,正式站驗完身分發一張 60 秒的票,
   把人送回 preview 自己收(go=take)。iPhone 主畫面 App 也走這一套,只是票換成一組碼。

   LINE_REDIRECT 還是認(驗收工具靠它),設了的話它的網域就是登入網域。 */
const LOGIN_HOST = process.env.LINE_REDIRECT
  ? String(process.env.LINE_REDIRECT).replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  : (process.env.LOGIN_HOST || "playground-beta-liart.vercel.app");
function redirectUri() {
  return process.env.LINE_REDIRECT || "https://" + LOGIN_HOST + "/api/auth";
}
const thisHost = req => String(req.headers["x-forwarded-host"] || req.headers.host || "").toLowerCase();
/* 票只送去這些網域:登入網域自己,以及這個 Vercel 專案的 preview。
   **白名單,不是黑名單** —— 否則就是「LINE 登入完把你的身分送給任何網站」。 */
const PREVIEW = new RegExp(process.env.PREVIEW_HOSTS || "^playground-[a-z0-9-]{1,90}-lulu-6af6\\.vercel\\.app$");
const okHost = h => typeof h === "string" && (h === LOGIN_HOST || PREVIEW.test(h));

/* 登入碼:8 碼,去掉 0/O/1/I/L 這幾個抄的時候會看錯的字 */
const CODE_ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomCode(n) {
  const b = crypto.randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) out += CODE_ABC[b[i] % CODE_ABC.length];
  return out;
}

/* 主畫面 App 那條路停在瀏覽器裡,要給他一頁看得懂的東西(沒有「回去」可以按) */
const escH = v => String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function page(res, status, title, body, extra) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Trippps</title><body style="margin:0;font:16px/1.6 -apple-system,system-ui,sans-serif;background:#F1F2F6;color:#15171D">' +
    '<main style="max-width:360px;margin:15vh auto;padding:24px;background:#fff;border-radius:12px;text-align:center">' +
    '<h1 style="font-size:20px;margin:0 0 12px">' + escH(title) + '</h1><p style="margin:0;color:#555">' + escH(body) + "</p>" +
    (extra || "") + "</main></body>");
}
function codePage(res, code) {
  const shown = code.slice(0, 4) + "-" + code.slice(4);
  page(res, 200, "回到 Trippps App", "打開主畫面上的 Trippps,在登入卡貼上這組碼。10 分鐘內有效,只能用一次。",
    '<p style="font:600 32px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.12em;margin:24px 0 16px">' + shown + "</p>" +
    /* code 只有大寫英數(randomCode 產的),放進屬性裡不用再跳脫 */
    '<button onclick="navigator.clipboard.writeText(\'' + code + '\').then(function(){this.textContent=\'已複製\'}.bind(this))" ' +
    'style="font:inherit;padding:10px 20px;border:1px solid #15171D;border-radius:8px;background:#fff">複製</button>');
}

/* 登入成功或失敗都回首頁,理由帶在網址上給前端講人話。
   直接在這裡印一頁錯誤訊息的話,使用者會卡在一個沒有「回去」的畫面上。 */
/* **登入完要回到出發的那一頁,不是首頁。** 第 2 期的邀請連結長這樣:
   `/?t=團代號&i=邀請碼` —— 朋友點開、還沒登入、按 LINE 登入,回來的時候
   如果落在首頁,邀請就不見了,他只會看到「你還沒有任何團」。

   出發前把那一頁記在 cookie 裡(跟 state 同一種壽命),回來時取出來。
   **只收站內的相對路徑**:以 `/` 開頭、第二個字不是 `/` 或 `\`、只有網址安全的字元 ——
   否則就是一個「登入完把你送去任何網站」的洞。 */
const BACK_COOKIE = "trip_b";
function safeBack(v) {
  const s = String(v || "");
  return /^\/(?![\/\\])[A-Za-z0-9._~\-\/?=&%]{0,300}$/.test(s) ? s : "/";
}
function home(res, query, back) {
  const to = safeBack(back);
  const join = to.indexOf("?") >= 0 ? "&" : "?";
  res.statusCode = 302;
  res.setHeader("Location", to + (query ? join + query : ""));
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

  /* ---------- 出發 ----------
     state 以前是一串亂數,存在 cookie 裡回來比對。**現在它自己帶著三件事,而且簽過名**:
       n    這趟的亂數 —— 也存一份在出發那個網域的 cookie,回來時比對(「這趟是從這台瀏覽器出發的」)
       h    從哪個網域出發的 —— LINE 一律回到登入網域(LOGIN_HOST),要知道該把人送回哪裡
       app  是不是 iPhone 主畫面 App 出發的 —— 是的話回來之後給登入碼,不是給 cookie
     簽名的用意:回呼那一步不能讀出發網域的 cookie(跨網域),所以 h 和 app 只能帶在 state 裡,
     而它們不能讓人改 —— 改了 h 就是「把一張登入票送去別人的網站」。 */
  if (go === "login") {
    const n = crypto.randomBytes(16).toString("base64url");
    const state = S.sign({ n, h: thisHost(req), app: q.app === "1" ? 1 : 0, exp: Date.now() + 600000 }, key);
    S.setCookie(res, S.STATE_COOKIE, n, 600);
    S.setCookie(res, BACK_COOKIE, safeBack(q.back), 600);
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

  /* ---------- 交接:preview 收下登入網域發的票 ----------
     票裡有:是誰、要送去哪個網域、出發時那串亂數、60 秒的期限。
     **三件事都要對才收**:網域是我自己、還沒過期、亂數跟我這邊出發時存的 cookie 一樣。
     最後一條擋的是「把一張票塞給別人點」—— 別人的瀏覽器裡沒有那串亂數。 */
  if (go === "take") {
    const back = safeBack(S.readCookies(req)[BACK_COOKIE]);
    const n = S.readCookies(req)[S.STATE_COOKIE];
    S.clearCookie(res, S.STATE_COOKIE);
    S.clearCookie(res, BACK_COOKIE);
    if (q.err) return home(res, "login=" + (/^[a-z]{2,10}$/.test(String(q.err)) ? q.err : "fail"), back);
    const t = S.unsign(String(q.ticket || ""), key);
    if (!t || t.t !== "hand" || t.h !== thisHost(req) || !n || t.n !== n) return home(res, "login=state", back);
    S.setCookie(res, S.SESSION_COOKIE, S.sign({ sub: t.sub, name: t.name, pic: t.pic,
      exp: Date.now() + S.SESSION_DAYS * 86400000 }, key), S.SESSION_DAYS * 86400);
    return home(res, "login=ok", back);
  }

  /* ---------- 主畫面 App:拿登入碼換票 ----------
     這一支在 **App 自己的網域** 上被叫,所以票發在 App 的 cookie 倉庫裡 —— 那正是要的。 */
  if (go === "code") {
    let b = req.body;
    if (typeof b === "string") { try { b = JSON.parse(b); } catch (_) { b = {}; } }
    const code = String((b && b.code) || q.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z0-9]{8}$/.test(code)) return res.status(400).json({ error: "登入碼是 8 個英文或數字" });
    let who;
    try { who = await P.takeCode(code); }
    catch (_) { return res.status(503).json({ error: "現在查不到登入碼,等一下再試" }); }
    if (!who || !who.sub) return res.status(403).json({ error: "這組登入碼不對,或已經過期(10 分鐘)—— 回瀏覽器重新登入一次" });
    S.setCookie(res, S.SESSION_COOKIE, S.sign({ sub: who.sub, name: who.name, pic: who.pic,
      exp: Date.now() + S.SESSION_DAYS * 86400000 }, key), S.SESSION_DAYS * 86400);
    return res.status(200).json({ ok: true, user: { id: who.sub, name: who.name } });
  }

  /* ---------- 回呼 ---------- */

  if (!q.code && !q.error) {
    /* 不帶任何參數直接打這支的人(含搜尋引擎)——給他一個入口就好 */
    return res.status(200).json({ ok: true, hint: "/api/auth?go=login" });
  }

  const st = S.unsign(String(q.state || ""), key);
  const here = thisHost(req);
  const cookieN = S.readCookies(req)[S.STATE_COOKIE];
  const back = safeBack(S.readCookies(req)[BACK_COOKIE]);
  const local = st && st.h === here;
  /* 失敗了要送回**出發的那個網域**講人話,不是留在登入網域 —— 那裡他什麼都沒有 */
  const fail = why => {
    if (st && !local && okHost(st.h) && !st.app) {
      res.statusCode = 302;
      res.setHeader("Location", "https://" + st.h + "/api/auth?go=take&err=" + why);
      return res.end();
    }
    if (st && st.app) return page(res, 400, "登入沒有成功", "回主畫面上的 Trippps,再按一次「用 LINE 登入」。");
    return home(res, "login=" + why, back);
  };
  if (local) { S.clearCookie(res, S.STATE_COOKIE); S.clearCookie(res, BACK_COOKIE); }
  /* 按取消不需要驗什麼 —— 沒有身分要發,只要把人帶回一個講得出話的地方 */
  if (q.error && !st) return home(res, "login=cancel", back);

  /* **state 驗三件事**:簽名對、沒過期、出發網域是我們的。
     同一個網域出發的(正式站自己、或是 LINE_REDIRECT 指到自己),再比對亂數 cookie ——
     跟以前一樣,擋「別人把一段 callback 網址塞給你點」。
     App 出發的例外:它的 cookie 在 App 那邊,這裡(瀏覽器)讀不到。它不需要:
     拿到的是**一組印在畫面上的碼**,塞連結的人看不到那個畫面。 */
  if (!st || !okHost(st.h) || (local && !st.app && (!cookieN || cookieN !== st.n))) {
    return home(res, "login=state", back);
  }

  /* 使用者在 LINE 那頁按了取消,也會走這裡。那不是錯誤,是一個決定。 */
  if (q.error) return fail("cancel");

  try {
    const tok = await post(TOKEN, new URLSearchParams({
      grant_type: "authorization_code",
      code: String(q.code),
      redirect_uri: redirectUri(req),
      client_id: CHANNEL_ID,
      client_secret: process.env.LINE_CHANNEL_SECRET,
    }).toString());
    const tj = await tok.json().catch(() => ({}));
    if (!tok.ok || !tj.access_token) return fail("token");

    const pr = await get(PROFILE, tj.access_token);
    const pj = await pr.json().catch(() => ({}));
    if (!pr.ok || !pj.userId) return fail("profile");

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
    if (!seen.ok) return st.app ? page(res, 403, "試用名額目前滿了", "現在沒辦法加入新的人,之後有名額會再通知。") : fail("full");

    /* 主畫面 App:印一組碼,讓他回 App 貼上。瀏覽器這邊也順便登入(之後用瀏覽器開也不用再登一次)。 */
    if (st.app) {
      const code = randomCode(8);
      try { await P.putCode(who, code); }
      catch (_) { return page(res, 503, "登入碼發不出來", "伺服器暫時存不了登入碼,等一下再按一次「用 LINE 登入」。"); }
      S.setCookie(res, S.SESSION_COOKIE, S.sign(Object.assign({ exp: Date.now() + S.SESSION_DAYS * 86400000 }, who), key), S.SESSION_DAYS * 86400);
      return codePage(res, code);
    }

    /* preview 出發的:發一張 60 秒的票,送回它自己那邊收(go=take) */
    if (!local) {
      const ticket = S.sign(Object.assign({ t: "hand", h: st.h, n: st.n, exp: Date.now() + 60000 }, who), key);
      res.statusCode = 302;
      res.setHeader("Location", "https://" + st.h + "/api/auth?go=take&ticket=" + encodeURIComponent(ticket));
      return res.end();
    }

    S.setCookie(res, S.SESSION_COOKIE, S.sign(Object.assign({
      exp: Date.now() + S.SESSION_DAYS * 86400000,
    }, who), key), S.SESSION_DAYS * 86400);
    return home(res, "login=ok", back);
  } catch (_) {
    /* 逾時、LINE 掛掉、網路斷掉都到這裡。**不要把原始錯誤丟到網址上** ——
       那一串對使用者沒有意義,而且有機會把內部細節印在網址列上。 */
    return fail("fail");
  }
};
