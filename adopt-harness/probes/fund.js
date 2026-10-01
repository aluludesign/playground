/* 共同基金照這一團的設定(2026-10-02 修):以前每一團都是舊東京團的 30,000。
 *   WIDTH=390 ./probe.sh probes/fund.js                        fixture 的團填 30,000 → 分帳有共同基金、花費第一格是「基金剩餘」
 *   PAGE='/index.html?nokitty=1' WIDTH=390 ./probe.sh ...    團主填 0 → 共同基金整塊不見、第一格改「每人平均」 */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
return (async function () {
  await wait(300);
  var none = /nokitty=1/.test((w.performance.getEntriesByType("navigation")[0] || {}).name || ""), bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  q("#tab-split").click(); await wait(100);
  var sec = q("#fund-sub").closest(".sec");
  var out = { 沒有基金: none, 基金區塊看得到: !sec.hidden, 基金說明: txt("#fund-sub") };
  q("#tab-cost").click(); await wait(100);
  out.第一格 = txt("#cost-stats .stat");
  if (none) {
    ok("填 0:分帳頁沒有共同基金那一塊", !out.基金區塊看得到, out);
    ok("填 0:花費第一格是「每人平均」,不是基金剩餘", /每人平均/.test(out.第一格) && !/基金/.test(out.第一格), out.第一格);
  } else ok("填 30,000:照設定顯示每人 30,000", out.基金區塊看得到 && /每人 NT\$30,000|每人 30,000|30,000/.test(out.基金說明) && /基金剩餘/.test(out.第一格), out);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
