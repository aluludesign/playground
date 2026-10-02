/* 頁尾只寫一句「2026 @ Trippps Beta」、置中(2026-10-02,Lulu);操作回饋(flash)照樣寫在這一行 2.8 秒再換回來。
 *   WIDTH=390 ./probe.sh probes/footer.js */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
return (async function () {
  await wait(400);
  var bad = [], out = {};
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var f = q("footer");
  out.頁尾 = f.textContent.replace(/\s+/g, " ").trim();
  out.置中 = getComputedStyle(q("#sync")).textAlign;
  ok("頁尾只有「2026 @ Trippps Beta」", out.頁尾 === "2026 @ Trippps Beta", out.頁尾);
  ok("置中", out.置中 === "center", out.置中);
  ok("沒有匯出備份、日期那一行", !q("#export-btn") && !q("#trip-foot") && !q("#backup-note"), "");
  q("#menu-btn").click(); await wait(50); q("#cloud-sync").click(); await wait(400);
  out.回饋 = q("#sync").textContent;
  ok("按重新整理 → 頁尾那一行講「已更新」", /已更新/.test(out.回饋), out.回饋);
  await wait(3200);
  ok("過一下換回「2026 @ Trippps Beta」", q("#sync").textContent === "2026 @ Trippps Beta", q("#sync").textContent);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
