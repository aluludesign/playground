// Trippps · 登入身分的那張票
//
// **auth.js 發票,notion.js 驗票 —— 兩邊看的必須是同一件事。**
// 一開始這段只長在 auth.js 裡,notion.js 要驗的時候最短的路是複製過去;
// 那樣的話哪天改了簽章格式,會變成「發的人改了、驗的人沒改」,
// 而症狀是**所有人突然都變成沒登入**,沒有任何一行錯誤訊息。
// 所以它住在這裡,兩邊都 require 它。
//
// 檔名開頭的底線是有意義的:Vercel 不會把 `api/_*.js` 當成一個網址,
// 所以它是一個模組,不是一支端點。

const crypto = require("crypto");

const SESSION_COOKIE = "trip_u";
const STATE_COOKIE = "trip_s";
const SESSION_DAYS = 30;

/* session cookie 的內容是明文的(名字、頭像網址),重點不是藏起來,是**不能被改**。
   金鑰從 channel secret 推出來,不另外跟使用者要第二個密鑰 —— 少一個要保管的
   東西就少一個會外流的東西。推導過一次的用意是:萬一簽章外洩也推不回 channel secret。 */
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

function readCookies(req) {
  const out = {};
  const raw = (req.headers && req.headers.cookie) || "";
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
    "Path=/", "HttpOnly", "Secure", "SameSite=Lax", "Max-Age=" + maxAge,
  ];
  const prev = res.getHeader("Set-Cookie");
  const all = prev ? (Array.isArray(prev) ? prev.slice() : [prev]) : [];
  all.push(bits.join("; "));
  res.setHeader("Set-Cookie", all);
}

const clearCookie = (res, name) => setCookie(res, name, "", 0);

/* 這次請求是誰。**沒登入不是錯誤** —— 讀是公開的,所以呼叫的人拿到 null
   要自己決定那代表什麼。 */
function whoIs(req) {
  const key = hmacKey();
  if (!key) return null;
  return unsign(readCookies(req)[SESSION_COOKIE], key);
}

module.exports = {
  SESSION_COOKIE, STATE_COOKIE, SESSION_DAYS,
  hmacKey, sign, unsign, readCookies, setCookie, clearCookie, whoIs,
};
