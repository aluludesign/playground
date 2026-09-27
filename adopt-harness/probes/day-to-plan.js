/* 在「許願」點上方某一天 → 回到「行程」,而且是那一天(Lulu 的決定)。
 * 三欄的寬桌機沒有許願分頁,點日子只換天、不切分頁。在「行程」點日子的老規則也不能變。 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var tab = () => (qa(".tab").filter(t => t.getAttribute("aria-selected") === "true")[0] || {}).id || "(無)";
var day = () => (q('#days [aria-pressed="true"]') || { dataset: {} }).dataset.day;
var other = () => qa("#days [data-day]").filter(b => b.getAttribute("aria-pressed") !== "true")[0];
return (async function () {
  var out = { width: w.innerWidth };
  q("#tab-wish").click(); await wait(150);
  var b = other(), want = b.dataset.day;
  b.click(); await wait(200);
  out.許願點別天 = { 分頁: tab(), 那天: day(), 要的天: want, 行程頁看得到: !q("#panel-plan").hidden };
  q("#tab-wish").click(); await wait(150);
  var cur = q('#days [aria-pressed="true"]'); cur.click(); await wait(200);
  out.許願點同一天 = { 分頁: tab(), 那天: day() };
  var b2 = other(), want2 = b2.dataset.day; b2.click(); await wait(200);
  out.行程點別天 = { 分頁: tab(), 那天: day(), 要的天: want2 };
  out.errors = w.__errors || [];
  return out;
})();
