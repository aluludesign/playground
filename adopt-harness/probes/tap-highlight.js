/* 點下去不要有黑色的一塊(iOS tap highlight)、點完不留 focus 框;鍵盤的 focus 框照舊在(2026-10-02,Lulu)。
 *   WIDTH=390 ./probe.sh probes/tap-highlight.js */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
return (async function () {
  await wait(300);
  var bad = [], out = {};
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var els = ["#ai-btn", "#menu-btn", "#tab-plan", "#add-stop-btn", ".day", "a"].map(s => q(s)).filter(Boolean);
  out.tap = els.map(e => getComputedStyle(e).webkitTapHighlightColor);
  ok("按鈕、分頁、日子、連結都沒有 tap highlight(透明)", out.tap.every(c => c === "rgba(0, 0, 0, 0)" || c === "transparent"), out.tap);
  var css = Array.from(d.styleSheets).map(sh => { try { return Array.from(sh.cssRules).map(r => r.cssText).join("\n"); } catch (_) { return ""; } }).join("\n");
  ok("點完不留 focus 框的規則在(:focus:not(:focus-visible))", /:focus:not\(:focus-visible\)/.test(css), "");
  ok("鍵盤用的 focus-visible 框還在", /focus-visible\s*\{[^}]*outline:\s*3px/.test(css), "");
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
