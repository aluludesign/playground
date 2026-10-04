/* 沒帶網址打開 App(主畫面的 App 被系統關掉後重開)時,今天在旅程中的團自動打開(2026-10-04,Lulu)。
 * 凍住的時鐘是 2026-09-19;fixture 的 mytrips= 決定「我的團」裡有哪幾團(now、now2、hidnow 包含那一天,later 是 10/03 才出發)。
 *   PAGE='/index.html?bare=1&mytrips=now,later'        一團進行中 → 直接打開它(網址變成 ?t=nowtrip1)
 *   PAGE='/index.html?bare=1&mytrips=now,now2,later'   兩團同時進行 → 先問「要開哪一團?」,只列那兩團;「看全部的團」列三團
 *   PAGE='/index.html?bare=1&mytrips=later'            沒有進行中的 → 照舊「我的團」清單
 *   PAGE='/index.html?bare=1&mytrips=hidnow,later'     進行中的那團被隱藏了 → 不自動開,照舊清單
 *   PAGE='/index.html?bare=1&admin=1&mytrips=now,hidnow,later'  最高權限:進行中的兩團有一團被他隱藏了 → 只剩一團,直接打開它
 *   PAGE='/index.html?home=1&admin=1&mytrips=now,hidnow,later'  最高權限的「我的團」:被隱藏的那團點得進去,標「隱藏中」
 *   PAGE='/index.html?home=1&mytrips=now,later'        從「我的團」回來(home=1)→ 不自動開,回得到清單
 *   PAGE='/index.html'                                 團裡面:選單的「我的團」帶 home=1 */
var wait = ms => new Promise(r => w.setTimeout(r, ms));
/* 打開的是哪個網址要問 iframe 的 src —— 自動開團會跳頁,跳過去之後頁面自己的網址已經是 ?t=… 了 */
var src = (w.frameElement && w.frameElement.getAttribute("src")) || "";
return (async function () {
  await wait(300);
  var D = w.document, q = s => D.querySelector(s), qa = s => Array.prototype.slice.call(D.querySelectorAll(s));
  var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
  var out = { 打開的網址: src.replace(/^.*\/index\.html/, ""), 現在的網址: w.location.search }, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var codes = () => qa("#home-overlay .home-trip").map(a => (/[?&]t=([^&]+)/.exec(a.getAttribute("href") || "") || [])[1] || "(點不進去)");
  var tripOpen = () => q("#home-overlay").hidden;
  var arrived = /[?&]t=/.test(w.location.search);   /* 已經被自動開進某一團了(探針在跳頁之後才跑) */
  var mt = (/[?&]mytrips=([a-z0-9,]*)/.exec(src) || [])[1];
  var admin = /[?&]admin=1/.test(src);
  if (admin && /[?&]bare=1/.test(src) && mt === "now,hidnow,later") {
    out.結果 = arrived ? "開了 " + w.location.search : txt("#home-title") + " " + codes().join();
    ok("最高權限:進行中的另一團被隱藏了 → 只剩一團,直接打開它(?t=nowtrip1)", /[?&]t=nowtrip1(&|$)/.test(w.location.search), out.結果);
  } else if (admin && /[?&]home=1/.test(src) && mt === "now,hidnow,later") {
    out.列 = qa("#home-overlay .home-trip").map(a => a.querySelector("b").textContent.replace(/\s+/g, " ").trim() + (a.getAttribute("href") ? "" : "(點不進去)"));
    ok("最高權限的「我的團」:被隱藏的那團點得進去、標「隱藏中」,其他的不標", out.列.join() === "大阪三日,關掉的團 · 隱藏中,東京五人行", out.列);
  } else if (/[?&]bare=1/.test(src) && mt === "now,later") {
    out.結果 = arrived ? "開了 " + w.location.search : txt("#home-title");
    ok("一團進行中 → 直接打開那一團(?t=nowtrip1)", /[?&]t=nowtrip1(&|$)/.test(w.location.search), out.結果);
  } else if (/[?&]bare=1/.test(src) && mt === "now,now2,later") {
    out.標題 = txt("#home-title"); out.說 = txt("#home-card p"); out.列 = codes();
    ok("兩團同時進行 → 先問「要開哪一團?」、只列那兩團、沒有自己跳走", !arrived && out.標題 === "要開哪一團?" &&
      out.列.join() === "nowtrip1,nowtrip2" && /今天有 2 團都在旅程中/.test(out.說), out);
    q("#h-all").click(); await wait(300);
    out.全部 = { 標題: txt("#home-title"), 列: codes() };
    ok("「看全部的團」→「我的團」三團都列", out.全部.標題 === "我的團" && out.全部.列.length === 3 && out.全部.列.slice(0, 2).join() === "nowtrip1,nowtrip2", out.全部);
  } else if (/[?&]bare=1/.test(src) && (mt === "later" || mt === "hidnow,later")) {
    out.標題 = txt("#home-title"); out.列 = codes();
    ok((mt === "later" ? "沒有進行中的" : "進行中的那團被隱藏了") + " → 照舊「我的團」清單、沒有跳走", !arrived && out.標題 === "我的團" && !tripOpen(), out);
  } else if (/[?&]home=1/.test(src)) {
    out.標題 = txt("#home-title"); out.列 = codes();
    ok("從「我的團」回來(home=1)→ 清單、不自動開", !arrived && out.標題 === "我的團" && out.列.indexOf("nowtrip1") > -1, out);
  } else {
    var a = q("#cloud-home");
    out.我的團連結 = a && a.getAttribute("href");
    ok("團裡選單的「我的團」帶 home=1(不然一按又被開回這一團)", !!a && /\?home=1$/.test(out.我的團連結), out.我的團連結);
  }
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
