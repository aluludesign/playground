/* 最高權限(2026-10-02,Lulu):隱藏/刪除任何一團。
 *   PAGE='/index.html?admin=1'  WIDTH=390 ./probe.sh probes/admin.js   選單有「管理所有團」→ 列出所有團、隱藏/取消隱藏、刪除要打團名
 *   PAGE='/index.html'          ...  一般人:選單沒有那顆
 *   PAGE='/index.html?hidden=1' ...  這一團被隱藏:進來只看到「這一團暫時關閉了」 */
var q = s => d.querySelector(s), qa = s => Array.from(d.querySelectorAll(s)), wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
return (async function () {
  await wait(300);
  var qs = (w.performance.getEntriesByType("navigation")[0] || {}).name || "", bad = [], out = {};
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  if (/hidden=1/.test(qs)) {
    out.卡片 = txt("#home-overlay");
    ok("被隱藏的團:進來只看到「這一團暫時關閉了」", !q("#home-overlay").hidden && /這一團暫時關閉了/.test(out.卡片), out.卡片);
    q("#home-overlay a.btn").click && null;
  } else {
    q("#menu-btn").click(); await wait(80);
    var btn = q("#cloud-admin");
    out.有管理鈕 = !!btn;
    if (!/admin=1/.test(qs)) ok("一般人:選單沒有「管理所有團」", !btn, "");
    else {
      ok("最高權限:選單有「管理所有團」", !!btn, "");
      btn.click(); await wait(300);
      out.清單 = qa(".home-trip.adm").map(x => x.textContent.replace(/\s+/g, " ").trim());
      ok("列出所有的團(含不是自己的、隱藏中的),有團主和人數", out.清單.length === 2 && /別人的團 · 隱藏中/.test(out.清單[1]) && /團主 阿輝 · 2 人/.test(out.清單[1]), out.清單);
      q('[data-adm="unhide"][data-code="other123"]').click(); await wait(300);
      ok("取消隱藏 → 重畫,那團變成「隱藏」鈕", !!q('[data-adm="hide"][data-code="other123"]'), qa(".home-trip.adm").map(x => x.textContent));
      w.prompt = () => "打錯了"; q('[data-adm="delete"][data-code="other123"]').click(); await wait(300);
      ok("刪除打錯團名 → 不刪,講原因", qa(".home-trip.adm").length === 2 && /團名打得不一樣/.test(txt("#adm-err")), txt("#adm-err"));
      w.prompt = () => "別人的團"; q('[data-adm="delete"][data-code="other123"]').click(); await wait(300);
      ok("刪除打對團名 → 那團不見了", qa(".home-trip.adm").length === 1, qa(".home-trip.adm").map(x => x.textContent));
      var cancelCalls = 0; w.prompt = () => { cancelCalls++; return null; };
      var before = (w.__calls || []).length;
      q('[data-adm="delete"]').click(); await wait(200);
      ok("按刪除後取消 → 什麼都沒送", cancelCalls === 1 && (w.__calls || []).slice(before).every(c => c.method !== "POST"), (w.__calls || []).slice(before));
    }
  }
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過";
  out.errors = w.__errors || [];
  return out;
})();
