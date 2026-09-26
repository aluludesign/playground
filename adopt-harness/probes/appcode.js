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
  if (out.角色 === "app") { q("#h-line").click(); await wait(30); out.按LINE開了什麼 = opened.map(x => x[0].replace(/^.*\/api\//, "") + " " + x[1]); out.網址沒動 = /fake=app/.test(w.location.search); }
  q("#h-login-code").value = "zzzz-zzzz"; q("#h-code-form").requestSubmit(); await wait(200);
  out.貼錯 = txt("#home-err");
  var calls = (w.__calls || []).filter(c => /go=code/.test(c.url)).map(c => JSON.stringify(c.body));
  out.送出去的 = calls;
  window.__appcode = out;
  q("#h-login-code").value = "abcd-2345"; q("#h-code-form").requestSubmit(); await wait(50);
  return out;
})();
