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
  /* 2026-10-14(Lulu):App 裡寫成兩步;輸入框一直能打字,「登入」鈕湊滿 8 碼(不算 - 和空白、大小寫都行)才亮 */
  out.步驟 = Array.prototype.map.call(d.querySelectorAll("#home-card .ls-h"), e => e.textContent.trim());
  var type = v => { var i = q("#h-login-code"); i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); return q("#h-code-go").disabled; };
  out.登入鈕 = { 一開始灰的: q("#h-code-go").disabled, 輸入框能打字: !q("#h-login-code").disabled, 七碼: type("abcd-123"), 八碼含減號: type("abcd-1234"), 八碼小寫: type("ab12cd34"), 九碼: type("abcd12345"), 清空: type("") };
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
