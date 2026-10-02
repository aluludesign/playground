/* 「＋記一筆」跳出對話框(2026-10-02,Lulu:要像其他地方一樣,不是在頁面上打開)。
 *   WIDTH=390 ./probe.sh probes/exp-dialog.js */
var q = s => d.querySelector(s), qa = s => Array.from(d.querySelectorAll(s)), wait = ms => new Promise(r => w.setTimeout(r, ms));
return (async function () {
  await wait(300);
  var bad = [], out = {};
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  q("#tab-cost").click(); await wait(100);
  var n0 = (w.__rows.expenses || []).length;
  q("#add-exp-btn").click(); await wait(150);
  var ov = q("#exp-edit-overlay");
  out.打開 = { 對話框: !ov.hidden, 標題: q("#xe-h2").textContent, 頁面上的表單: !!q("#exp-form"), 日期: q("#xe-date").value, 勾了幾個: qa("#xe-who input:checked").length, 共幾個: qa("#xe-who input").length, 項目: q("#xe-title").value, 疊: !!q("#exp-edit-form .stack-n:not([hidden])") };
  ok("跳出「記一筆」對話框(頁面上沒有展開的表單),空白、全員勾起來、不疊卡片", out.打開.對話框 && out.打開.標題 === "記一筆" && !out.打開.頁面上的表單 &&
    !!out.打開.日期 && out.打開.勾了幾個 === out.打開.共幾個 && out.打開.共幾個 >= 2 && !out.打開.項目 && !out.打開.疊, out.打開);
  /* 沒改東西:點外面就關 */
  ov.dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(100);
  ok("沒改任何東西 → 點外面就關(對話框規則)", ov.hidden, "");
  q("#add-exp-btn").click(); await wait(120);
  q("#xe-date").value = "2026-10-06"; q("#xe-title").value = "居酒屋"; q("#xe-amount").value = "8800";
  q("#xe-title").dispatchEvent(new Event("input", { bubbles: true }));
  ov.dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(100);
  ok("改過了 → 點外面不關(要按存或取消)", !ov.hidden, "");
  q("#exp-edit-form").requestSubmit(); await wait(300);
  out.存了 = { 關了: ov.hidden, 多了: (w.__rows.expenses || []).length - n0, 清單上: qa("#exp-list .exp").some(e => /居酒屋/.test(e.textContent)) };
  ok("存起來 → 對話框關掉、多一筆、清單上看得到", out.存了.關了 && out.存了.多了 === 1 && out.存了.清單上, out.存了);
  q("#add-exp-btn").click(); await wait(120);
  ok("再記一筆:日期接著剛剛那筆(連記通常是同一天),其他是空的", q("#xe-date").value === "2026-10-06" && !q("#xe-title").value && !q("#xe-amount").value, { 日期: q("#xe-date").value, 項目: q("#xe-title").value });
  q("#xe-cancel").click(); await wait(80);
  /* 改既有的那一筆:照舊是「改這一筆」 */
  var eb = q("[data-edit-exp]"); if (eb) { eb.click(); await wait(120); }
  ok("改既有的:標題「改這一筆」、有內容", q("#xe-h2").textContent === "改這一筆" && !!q("#xe-title").value, q("#xe-h2").textContent);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
