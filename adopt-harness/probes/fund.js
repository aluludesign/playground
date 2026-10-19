/* 預收照這一團的設定(2026-10-02 修 30,000;2026-10-19 預算模式拿掉,改成預收)。
 *   WIDTH=390 ./probe.sh probes/fund.js                          fixture 的團只有舊的「基金」30,000 → 讀成「沒有」:預收整塊不見、第一格「每人平均」
 *   PAGE='/index.html?fund=boss' WIDTH=390 ./probe.sh ...      有預收 → 分帳有「預收」、花費第一格「預收剩餘」
 *   PAGE='/index.html?fund=budget' WIDTH=390 ./probe.sh ...    Notion 還存著「預算」的團 → 讀成「沒有」 */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
return (async function () {
  await wait(300);
  var none = !/fund=(boss|pot|diff)/.test((w.performance.getEntriesByType("navigation")[0] || {}).name || ""), bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  q("#tab-split").click(); await wait(100);
  var sec = q("#fund-sub").closest(".sec");
  var out = { 沒有基金: none, 基金區塊看得到: !sec.hidden, 基金說明: txt("#fund-sub") };
  q("#tab-cost").click(); await wait(100);
  out.第一格 = txt("#cost-stats .stat");
  if (none) {
    ok("沒有預收(含舊的預算、只有「基金」數字的團):分帳頁沒有預收那一塊", !out.基金區塊看得到, out);
    ok("沒有預收:花費第一格是「每人平均」", /每人平均/.test(out.第一格) && !/預收|基金/.test(out.第一格), out.第一格);
  } else ok("有預收:分帳頁有預收、每人 30,000;花費第一格「預收剩餘」", out.基金區塊看得到 && /30,000/.test(out.基金說明) && /預收剩餘/.test(out.第一格), out);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
