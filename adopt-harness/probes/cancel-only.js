/* 「加一筆行程」「許願」兩張對話框只有「取消」關得掉（2026-09-28）。
   點灰色背景、按 Esc 都不能關；Esc 也不能穿過去關掉底下的地圖／許願清單。 */
var q = s => d.querySelector(s);
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var open = id => !q("#" + id).hidden;
var clickBackdrop = id => q("#" + id).dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
var esc = () => d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
return (async function () {
  var out = {};
  for (var c of [["stop", "add-stop-btn", "stop-add-overlay", "sf-cancel"], ["wish", "add-wish-btn", "wish-add-overlay", "wf-cancel"]]) {
    var [k, btn, ov, cancel] = c;
    q("#" + btn).click(); await wait(80);
    var r = { opened: open(ov) };
    clickBackdrop(ov); await wait(40); r.afterBackdrop = open(ov);
    var sheetBefore = q("#map-sheet") ? !q("#map-sheet").hidden : null;
    esc(); await wait(40); r.afterEsc = open(ov);
    r.sheetUnchanged = q("#map-sheet") ? (!q("#map-sheet").hidden) === sheetBefore : true;
    q("#" + cancel).click(); await wait(40); r.afterCancel = open(ov);
    out[k] = r;
  }
  return out;
})();
