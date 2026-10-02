/* Chip / Filter 選取態照 Figma(Secondary / Outlined):1px secondary 框、secondary container 底、on secondary container 字(2026-10-02)。
 * design-system 的選取態是 2px —— 只覆寫顏色會留著那 2px,這一支量的就是那個。
 *   WIDTH=390 ./probe.sh probes/chip-selected.js */
var q = s => d.querySelector(s), qa = s => Array.from(d.querySelectorAll(s)), wait = ms => new Promise(r => w.setTimeout(r, ms));
return (async function () {
  await wait(300);
  var bad = [], out = {};
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  if (q("#lay-wish").getAttribute("aria-pressed") !== "true") { q("#lay-wish").click(); await wait(100); }
  var cs = getComputedStyle(q("#lay-wish"));
  out.大家的許願 = { 框: cs.borderTopWidth + " " + cs.borderTopColor, 底: cs.backgroundColor, 字: cs.color };
  ok("大家的許願(選取):1px #A5887C 框、#C9C0BD 底、#4D3B33 字", cs.borderTopWidth === "1px" && cs.borderTopColor === "rgb(165, 136, 124)" &&
    cs.backgroundColor === "rgb(201, 192, 189)" && cs.color === "rgb(77, 59, 51)", out.大家的許願);
  q("#tab-cost").click(); await wait(80); q("#add-exp-btn").click(); await wait(100);
  var chip = qa("#ef-who .rm-chip").find(c => c.querySelector("input:checked"));
  var cc = chip && getComputedStyle(chip);
  out.誰分攤 = cc && { 框: cc.borderTopWidth + " " + cc.borderTopColor, 底: cc.backgroundColor };
  ok("誰分攤(勾了):一樣是 1px 框", cc && cc.borderTopWidth === "1px" && cc.backgroundColor === "rgb(201, 192, 189)", out.誰分攤);
  /* 選取 + 停用:許願頁「大家的許願」鎖著開 → #D4D4D4 底和框、#A3A3A3 字(Figma State=Disabled) */
  q("#tab-wish").click(); await wait(150);
  var lw = q("#lay-wish"), dc = getComputedStyle(lw), dot = getComputedStyle(lw, "::before");
  out.許願頁 = { 停用: lw.disabled, 選取: lw.getAttribute("aria-pressed"), 框: dc.borderTopWidth + " " + dc.borderTopColor, 底: dc.backgroundColor, 字: dc.color, 點: dot.backgroundColor };
  ok("許願頁的「大家的許願」:停用 + 選取的樣子(#D4D4D4 底和 1px 框、#A3A3A3 字,點也是灰的)", lw.disabled && dc.backgroundColor === "rgb(212, 212, 212)" &&
    dc.borderTopWidth === "1px" && dc.borderTopColor === "rgb(212, 212, 212)" && dc.color === "rgb(163, 163, 163)" && dot.backgroundColor === "rgb(163, 163, 163)", out.許願頁);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
