/* 手機的清單 sheet:最上面的把手和黏住的日期那一排要跟整張 sheet 一樣寬(2026-10-02,Lulu:「兩邊太短破圖」)。
 * 捲下去之後,左右兩邊最靠邊的那幾 px 必須是把手/日期排自己,不能是捲上來的時間軸。
 *   WIDTH=390 ./probe.sh probes/sheet-edges.js */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
return (async function () {
  await wait(400);
  var bad = [], out = {};
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var sh = q("#panel-plan"), gr = q("#plan-grab") || q(".pg-grab"), days = q("#days");
  var R = e => { var r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }; };
  days.scrollLeft = 0; await wait(80);   /* 測試的時間是 10/5,會自己捲到 Day 3;量位置前先捲回最前面 */
  out.sheet = R(sh); out.把手 = R(gr); out.日期排 = R(days); out.第一天 = R(days.querySelector("[data-day]"));
  ok("把手跟整張 sheet 一樣寬", out.把手.l === out.sheet.l && out.把手.r === out.sheet.r, out);
  ok("日期那一排跟整張 sheet 一樣寬", out.日期排.l === out.sheet.l && out.日期排.r === out.sheet.r, out);
  ok("第一天那張卡還在原本的位置(離左邊 15px)", out.第一天.l - out.sheet.l === 15, out.第一天.l - out.sheet.l);
  /* 捲下去,看最左、最右邊那條是誰 */
  sh.scrollTop = 400; await wait(200);
  var who = (x, y) => { var e = d.elementFromPoint(x, y); return e ? (e.closest(".pg-grab") ? "把手" : e.closest("#days") ? "日期排" : (e.id || e.className || e.tagName)) : "?"; };
  var g = R(gr), dd = R(days);

  out.邊 = { 把手左: who(g.l + 3, g.t + 8), 把手右: who(g.r - 3, g.t + 8), 日期排左: who(dd.l + 3, dd.t + 20), 日期排右: who(dd.r - 3, dd.t + 20) };
  /* 右邊不用 elementFromPoint 量:測試用的瀏覽器有一條浮在最右邊 15px 上的捲軸,點下去拿到的是捲軸(手機沒有)。
     右邊靠上面那兩條「跟 sheet 一樣寬」的位置量,外觀看截圖 */
  ok("捲下去之後,左邊最靠邊的是把手和日期排(下面的東西不會從縫裡露出來)", out.邊.把手左 === "把手" && out.邊.日期排左 === "日期排", out.邊);
  ok("捲下去之後,把手和日期排的右緣還是貼著 sheet 的右緣", R(gr).r === R(sh).r && R(days).r === R(sh).r, { 把手: R(gr), 日期排: R(days), sheet: R(sh) });
  sh.scrollTop = 0;
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
