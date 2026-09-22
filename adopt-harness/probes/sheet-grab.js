// 手機版的層次:地圖是底,清單是疊在上面、可以三段收放的 sheet。
//
// **這一支原本量的是相反的東西** —— 地圖是從下面滑上來的 sheet、可以拖到全螢幕,
// 而許願是釘在底部的一條 bar。那個模型整個翻過來了(2026-09-22):
//
//   以前:頁面在底 → 地圖 sheet 蓋上去 → 要看地圖就看不到清單
//   現在:地圖在底 → 清單 sheet 疊上去 → 兩個同時看得到,sheet 可以縮到剩一條
//
// 所以那五條(地圖握把看得見、往上拖變高、拖得到全螢幕、往下拖縮得回來、
// 許願那條碰得到)**不是壞了,是測試對象沒了**:地圖的握把現在刻意 `display:none`
// (它不再是要縮放的東西),許願變成第二個分頁、那條 bar 不存在。
//
// 留下來、而且換成新模型的:誰疊在誰上面、誰按得到、三段收放是不是真的到得了。
//
//   WIDTH=390 ./probe.sh probes/sheet-grab.js
var log = [], out = { 步驟: log, 沒過的: [] };
function ok(name, cond, extra) {
  log.push((cond ? "✓ " : "✗ ") + name + (cond ? "" : "   ← " + JSON.stringify(extra)));
  if (!cond) out.沒過的.push(name);
}
var sleep = function (ms) { return new Promise(function (r) { w.setTimeout(r, ms); }); };
async function until(fn, tries) {
  for (var i = 0; i < (tries || 160); i++) { if (fn()) return true; await sleep(50); }
  return false;
}
function pt(t, y) {
  return new w.PointerEvent(t, { clientX: 40, clientY: y, pointerId: 9,
    bubbles: true, cancelable: true, pointerType: "touch" });
}
function H() { return Math.round(d.getElementById("panel-plan").getBoundingClientRect().height); }
function DET() { return d.getElementById("panel-plan").dataset.det; }
async function drag(dy) {
  var g = d.getElementById("plan-grab"), b = g.getBoundingClientRect(), y = b.top + 4;
  g.dispatchEvent(pt("pointerdown", y));
  if (dy !== 0) w.dispatchEvent(pt("pointermove", y - dy));
  w.dispatchEvent(pt("pointerup", y - dy));
  await sleep(420);
}
(async function () {
  try {
    if (w.innerWidth > 640) {
      out.說明 = "**這個寬度沒有量** —— 這一支是手機版的層次,要 WIDTH=390。桌機是三欄,由 drawer.js 負責。";
      out.結論 = "跳過(不是桌機的題目)";
      document.getElementById("r").textContent = JSON.stringify(out, null, 2);
      return;
    }
    await sleep(400);

    // ---- 分頁:五個,而且「許願」在行程旁邊 ----
    var tabs = [].map.call(d.querySelectorAll(".tab"), function (b) { return b.dataset.tab; });
    ok("五個分頁,順序是 行程／許願／搭機／花費／分帳",
      tabs.join(",") === "plan,wish,fly,cost,split", tabs);

    // ---- 疊法:地圖在底,清單在上 ----
    var map = d.getElementById("map-sheet"), sheet = d.getElementById("panel-plan");
    ok("地圖是開著的(它是底,不是「要打開的東西」)", !map.hidden, map.hidden);
    var mz = +w.getComputedStyle(map).zIndex, sz = +w.getComputedStyle(sheet).zIndex;
    ok("**地圖在清單底下**(這一輪把疊法翻過來了)", mz < sz, { 地圖: mz, 清單: sz });
    var mr = map.getBoundingClientRect();
    ok("地圖鋪滿分頁列以上的整塊(它是背景,不是一條)",
      Math.round(mr.height) > w.innerHeight * 0.8, Math.round(mr.height));
    /* 地圖的握把不該再出現:它已經不是要縮放的東西,留著會承諾一件做不到的事。 */
    ok("地圖那條舊握把收起來了(它不再是可縮放的 sheet)",
      w.getComputedStyle(d.getElementById("map-grab")).display === "none",
      w.getComputedStyle(d.getElementById("map-grab")).display);

    // ---- 三段:預設 → 全開 → 只剩一條 → 點回來 ----
    var full = Math.round(w.innerHeight -
      (parseFloat(w.getComputedStyle(d.documentElement).getPropertyValue("--tabh")) || 0));
    ok("預設停在中間那一段(約半個螢幕)", DET() === "1" && H() > full * 0.35 && H() < full * 0.7,
      { det: DET(), 高: H(), 可用: full });
    await drag(9000);
    ok("往上拖到底 → 吸到最上面那一段(幾乎整頁清單)",
      DET() === "2" && H() >= full - 3, { det: DET(), 高: H(), 可用: full });
    await drag(-9000);
    /* **收到剩一條,而不是收不見。** 不見的話就沒有東西可以點回來了 ——
       那是「關掉」,而這裡要的是「讓開」。 */
    ok("往下拖到底 → 只剩一條細 bar,而且還在畫面上", DET() === "0" && H() > 20 && H() < 80,
      { det: DET(), 高: H() });
    ok("而且地圖沒有被關掉(它是底,不該跟著消失)", !map.hidden, map.hidden);
    var g = d.getElementById("plan-grab"), gb = g.getBoundingClientRect();
    var hit = d.elementFromPoint(Math.round(gb.left + gb.width / 2), Math.round(gb.top + gb.height / 2));
    ok("那條 bar 按得到(不是被地圖或分頁列蓋住)", !!hit && (hit === g || g.contains(hit)),
      hit && (hit.tagName.toLowerCase() + (hit.id ? "#" + hit.id : "")));
    await drag(0);
    ok("點那條 bar → 回到中間那一段(iOS「尋找」那種)", DET() === "1", { det: DET(), 高: H() });

    // ---- 兩個檢視共用同一張地圖 ----
    var before = d.getElementById("map-sheet").hidden;
    d.getElementById("tab-wish").click();
    await sleep(400);
    ok("切到「許願」→ 地圖沒有重開(它一直都在)", !d.getElementById("map-sheet").hidden && !before,
      { 切之前開著: !before, 切之後開著: !d.getElementById("map-sheet").hidden });
    ok("切到「許願」→ sheet 裡換成願望清單",
      w.getComputedStyle(d.getElementById("wishbox")).display !== "none" &&
      w.getComputedStyle(d.querySelector(".cols > .col:not(#wishbox)")).display === "none",
      { 許願: w.getComputedStyle(d.getElementById("wishbox")).display,
        行程: w.getComputedStyle(d.querySelector(".cols > .col:not(#wishbox)")).display });
    d.getElementById("tab-plan").click();
    await sleep(400);
    ok("切回「行程」→ sheet 裡換回行程清單",
      w.getComputedStyle(d.getElementById("wishbox")).display === "none" &&
      w.getComputedStyle(d.querySelector(".cols > .col:not(#wishbox)")).display !== "none",
      { 許願: w.getComputedStyle(d.getElementById("wishbox")).display });

    // ---- 分頁列永遠按得到 ----
    var planTab = d.getElementById("tab-plan"), pb = planTab.getBoundingClientRect();
    var hitTab = d.elementFromPoint(Math.round(pb.left + pb.width / 2), Math.round(pb.top + pb.height / 2));
    ok("「行程」那顆分頁按得到(沒有被 sheet 或地圖蓋住)",
      !!hitTab && (hitTab === planTab || planTab.contains(hitTab)),
      hitTab && (hitTab.tagName.toLowerCase() + (hitTab.id ? "#" + hitTab.id : "")));
  } catch (e) {
    out.爆掉了 = String((e && e.stack) || e);
  }
  out.結論 = out.爆掉了
    ? "✗ 中途爆掉,跑到第 " + log.length + " 條就停了 —— 後面的沒跑到"
    : out.沒過的.length ? out.沒過的.length + " 項沒過" : "全部通過";
  document.getElementById("r").textContent = JSON.stringify(out, null, 2);
})();

return { 說明: "非同步" };
