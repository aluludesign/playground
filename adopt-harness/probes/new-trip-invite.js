/* 剛開好的團一進來就先跳「邀請好友一起來參加」(2026-10-02,Lulu)。
 *   PAGE='/index.html?new=1' WIDTH=390 ./probe.sh probes/new-trip-invite.js   開團後:跳邀請,標題「邀請好友一起來參加」、有邀請碼
 *   PAGE='/index.html'       WIDTH=390 ./probe.sh probes/new-trip-invite.js   一般進來:不跳 */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
return (async function () {
  await wait(300);
  /* 網址上的 new=1 進來就被擦掉了,所以看「一開始載入的是哪個網址」 */
  var nav = (w.performance.getEntriesByType("navigation")[0] || {}).name || "";
  var fresh = /[?&]new=1/.test(nav), bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var ov = q("#invite-overlay");
  var out = { 開團後: fresh, 跳了: !ov.hidden, 標題: q("#inv-title").textContent, 邀請碼: q("#inv-code").textContent, 網址: w.location.search };
  if (fresh) {
    ok("開好團一進來就跳邀請,標題「邀請好友一起來參加」,邀請碼已經填好", out.跳了 && out.標題 === "邀請好友一起來參加" && !!out.邀請碼, out);
    ok("網址上的 new=1 擦掉了(重新整理不會再跳)", !/new=1/.test(out.網址), out.網址);
    ov.click(); await wait(80);
    ok("沒改任何東西,點外面就關(對話框規則)", ov.hidden, "");
    q("#menu-btn") && q("#menu-btn").click();
  } else ok("一般進來不跳邀請", !out.跳了, out);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過";
  out.errors = w.__errors || [];
  return out;
})();
