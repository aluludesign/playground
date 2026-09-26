/* iPhone 主畫面 App 的登入:登入卡上有沒有「貼登入碼」、貼錯講不講、貼對有沒有真的去換票。
 * PAGE='/index.html?fake=app'(App 裡)或 fake=anon(一般瀏覽器,要先按「我有登入碼」)。 */
var q = s => d.querySelector(s), txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var wait = ms => new Promise(r => window.setTimeout(r, ms));
if (window.__appcode) return window.__appcode;
var opened = [];
w.open = function (u, t) { opened.push([String(u), t]); return null; };
return (async function () {
  var out = { 角色: (/fake=([a-z]+)/.exec(w.location.search) || [])[1] };
  out.卡上的字 = txt("#home-card").slice(0, 120);
  out.登入碼欄一開始看得到 = !q("#h-code-form").hidden;
  out.有我有登入碼 = !!q("#h-has-code");
  if (q("#h-has-code")) { q("#h-has-code").click(); await wait(30); out.按了之後看得到 = !q("#h-code-form").hidden; }
  if (out.角色 === "app") {
    q("#h-line").click(); await wait(120);
    /* 以前是 window.open 另開一個視窗 —— iPhone 把 LINE 交給瀏覽器之後,那個視窗留在 App 裡一頁空白。
       現在要的是:**沒有另開任何視窗**,先問到 LINE 的網址,這一頁自己往那裡走。 */
    out.另開了視窗 = opened.length;
    out.先問了網址 = (w.__calls || []).some(c => /go=login/.test(c.url) && /json=1/.test(c.url) && /app=1/.test(c.url));
    out.往LINE走了 = w.location.hash === "#line-login";
    out.卡還在 = !q("#home-overlay").hidden && !!q("#h-login-code");
  }
  q("#h-login-code").value = "zzzz-zzzz"; q("#h-code-form").requestSubmit(); await wait(200);
  out.貼錯 = txt("#home-err");
  var calls = (w.__calls || []).filter(c => /go=code/.test(c.url)).map(c => JSON.stringify(c.body));
  out.送出去的 = calls;
  window.__appcode = out;
  q("#h-login-code").value = "abcd-2345"; q("#h-code-form").requestSubmit(); await wait(50);
  return out;
})();
