/* 「＋加行程」「＋許願」「＋記一筆」「＋加一段交通」要是同一顆 primary sm 按鈕(2026-10-02,Lulu)。
 * 一個屬性一個屬性比 computed style,連 ＋ 那個圖示一起比 —— 以前「＋許願」被一條舊樣式蓋成無框陶土色字,
 * class 對了、樣子不對,只看 class 抓不到。
 *   WIDTH=390 ./probe.sh probes/add-buttons.js */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var PROPS = ["background-color", "color", "border-top-width", "border-top-color", "border-top-left-radius", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "font-size", "font-weight", "font-family", "line-height", "height", "gap", "box-shadow"];
var ICON = ["color", "fill", "width", "height", "margin-right"];
function look(id) {
  var b = q("#" + id); if (!b) return null;
  var cs = getComputedStyle(b), o = {};
  PROPS.forEach(p => { o[p] = p === "height" ? Math.round(b.getBoundingClientRect().height) + "px" : cs.getPropertyValue(p); });
  var i = b.querySelector(".i"), ic = i && getComputedStyle(i);
  ICON.forEach(p => { o["圖示 " + p] = ic ? ic.getPropertyValue(p) : "沒有"; });
  return o;
}
return (async function () {
  await wait(300);
  var bad = [], out = {};
  q("#tab-plan").click(); await wait(80); out["add-stop-btn"] = look("add-stop-btn");
  q("#tab-wish").click(); await wait(120); out["add-wish-btn"] = look("add-wish-btn");
  q("#tab-cost").click(); await wait(80); out["add-exp-btn"] = look("add-exp-btn");
  q("#tab-fly").click(); await wait(80); out["fly-add"] = look("fly-add");
  var ref = out["add-exp-btn"];
  ["add-stop-btn", "add-wish-btn", "fly-add"].forEach(id => {
    var o = out[id]; if (!o) { bad.push(id + " 找不到"); return; }
    Object.keys(ref).forEach(k => { if (o[k] !== ref[k]) bad.push(id + " 的 " + k + " 是 " + o[k] + ",記一筆是 " + ref[k]); });
  });
  if (ref["圖示 color"] !== ref["color"]) bad.push("記一筆的 ＋ 跟字不同色:" + ref["圖示 color"] + " / " + ref["color"]);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過";
  out.errors = w.__errors || [];
  return out;
})();
