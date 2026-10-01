/* 邀請朋友的「用 LINE 傳給朋友」(2026-10-02):手機叫 LINE App(line.me/R/share),
 * 電腦走 LINE 的網頁分享(social-plugins.line.me/lineit/share)—— 電腦點 R/share 會被轉去 LINE 官網首頁。
 *   WIDTH=1440 ./probe.sh probes/line-share.js                 電腦
 *   PAGE='/index.html?touch=1' WIDTH=390 ./probe.sh ...       手機 */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
return (async function () {
  await wait(300);
  var phone = /touch=1/.test((w.performance.getEntriesByType("navigation")[0] || {}).name || ""), bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  q("#menu-btn").click(); await wait(80); q("#cloud-invite").click(); await wait(80);
  var href = q("#inv-line").getAttribute("href") || "", u = new URL(href);
  var out = { 手機: phone, href: href };
  if (phone) ok("手機:叫 LINE App(line.me/R/share),訊息裡有網址和邀請碼", u.host === "line.me" && u.pathname === "/R/share" && /邀請碼:q4wn8t/.test(u.searchParams.get("text")) && /t=fixture1/.test(u.searchParams.get("text")), out);
  else ok("電腦:走 LINE 網頁分享(lineit/share),帶網址和邀請碼", u.host === "social-plugins.line.me" && u.pathname === "/lineit/share" &&
    /t=fixture1&i=q4wn8t/.test(u.searchParams.get("url")) && /邀請碼:q4wn8t/.test(u.searchParams.get("text")), out);
  ok("另開分頁(不要把 App 本身換掉)", q("#inv-line").target === "_blank", q("#inv-line").target);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
