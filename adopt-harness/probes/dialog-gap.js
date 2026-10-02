/* 全站對話框裡的輸入框,上下兩格之間要 12px(2026-10-02,Lulu:「團的設定每個輸入框都靠那麼近」)。
 * 量的是**輸入框的框**(.rm-input)之間的空白,不是 .fld —— 標題浮在框線上,看起來的距離就是框到框。
 * 同一欄(水平有重疊)、上下相鄰的才算;並排的兩格(.grid2)不算。
 *   WIDTH=390 ./probe.sh probes/dialog-gap.js
 *   WIDTH=1440 ./probe.sh probes/dialog-gap.js */
var q = s => d.querySelector(s), qa = s => Array.from(d.querySelectorAll(s)), wait = ms => new Promise(r => w.setTimeout(r, ms));
var vis = e => { var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest("[hidden]"); };
function gaps(ov) {
  var boxes = qa("#" + ov + " .rm-input").filter(vis).map(e => ({ id: e.id || e.name, r: e.getBoundingClientRect() }));
  var out = [];
  boxes.forEach(a => {
    /* 正下方最近的那一格 */
    var below = boxes.filter(b => b !== a && b.r.top >= a.r.bottom - 1 && b.r.left < a.r.right - 4 && b.r.right > a.r.left + 4)
      .sort((x, y) => x.r.top - y.r.top)[0];
    if (!below) return;
    /* 中間夾著別的東西(勾選、說明、按鈕)的不算「相鄰兩格」 */
    var between = qa("#" + ov + " .who, #" + ov + " .st-hint, #" + ov + " .rm-chip, #" + ov + " hr, #" + ov + " p, #" + ov + " .seek-out, #" + ov + " .seatfld > .rm-label, #" + ov + " .err").filter(vis)
      .some(e => { var r = e.getBoundingClientRect(); return r.top >= a.r.bottom - 1 && r.bottom <= below.r.top + 1 && r.height > 0; });
    /* 兩欄並排、最後一列空一格(5 個人排兩欄)的時候,正下方是更下面的東西 —— 中間其實有一整列,不算 */
    var rowBetween = boxes.some(c => c !== a && c !== below && c.r.top >= a.r.bottom - 1 && c.r.bottom <= below.r.top + 1);
    if (!between && !rowBetween) out.push({ 上: a.id, 下: below.id, gap: Math.round(below.r.top - a.r.bottom) });
  });
  return out;
}
var OPEN = {
  "settings-overlay": async () => { q("#menu-btn").click(); await wait(60); q("#cloud-set").click(); await wait(120);
    var m = q("#st-fund-mode"); m.value = "pot"; m.dispatchEvent(new Event("change")); await wait(40); },
  "settings-overlay(每人不一樣)": async () => { q("#menu-btn").click(); await wait(60); q("#cloud-set").click(); await wait(120);
    var m = q("#st-fund-mode"); m.value = "pot"; m.dispatchEvent(new Event("change"));
    var r = q("#st-fund-same0"); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); await wait(40); },
  "stop-add-overlay": async () => { q("#add-stop-btn").click(); await wait(120); },
  "wish-add-overlay": async () => { q("#tab-wish").click(); await wait(60); q("#add-wish-btn").click(); await wait(120); },
  "edit-overlay": async () => { q("#tab-plan").click(); await wait(60); var b = q("[data-edit-stop]"); if (b) b.click(); await wait(120); },
  "exp-edit-overlay": async () => { q("#tab-cost").click(); await wait(60); var b = q("[data-edit-exp]"); if (b) b.click(); await wait(120); },
  "flight-overlay": async () => { q("#tab-fly").click(); await wait(60); var b = q("[data-flight-add]"); if (b) b.click(); await wait(150); },
  "wish-edit-overlay": async () => { q("#tab-wish").click(); await wait(60); var b = q("[data-edit-wish]"); if (b) b.click(); await wait(120); },
  "ai-overlay": async () => { q("#ai-btn").click(); await wait(120); },
};
return (async function () {
  await wait(400);
  var out = { 寬: w.innerWidth, 對話框: {} }, bad = [];
  for (var name of Object.keys(OPEN)) {
    var ov = name.replace(/\(.*\)$/, "");
    try { await OPEN[name](); } catch (e) { out.對話框[name] = "打不開:" + e; continue; }
    if (q("#" + ov).hidden) { out.對話框[name] = "沒打開"; continue; }
    var g = gaps(ov);
    out.對話框[name] = g.map(x => x.上 + "→" + x.下 + " " + x.gap).join(" | ") || "(沒有上下相鄰的兩格)";
    g.filter(x => Math.abs(x.gap - 12) > 1).forEach(x => bad.push(name + ":" + x.上 + "→" + x.下 + " 是 " + x.gap + "px"));
    q("#" + ov).hidden = true; await wait(40);
  }
  out.結論 = bad.length ? "✗ " + bad.length + " 處不是 12px:" + bad.join(" ;; ") : "全部通過";
  out.errors = w.__errors || [];
  return out;
})();
