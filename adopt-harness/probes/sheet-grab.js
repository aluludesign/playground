// 手機上浮在底部的那幾層:分頁列、許願那條、地圖 sheet —— 誰蓋誰,誰還按得到。
// 以及地圖那條握把:上下拖,一路拖到全螢幕。
//
// 為什麼另外開一支而不是加進 drawer.js:**那支量的是寬度,這支量的是高度**,
// 而且兩者活在不同的寬度regime —— drawer.js 的檔頭寫著它測 1100 和 641,
// 那幾條在 390 下本來就不成立(`--drawer` 240、內容只剩 150,低於它自己的 MINMAIN)。
// 把手機的東西塞進去,會讓一支好好的探針在某個寬度下永遠是紅的。
//
// 為什麼要有這一支:那條握把**以前只是裝飾**。它長得可以拖,拖了什麼都不會發生 ——
// 一個承諾了做不到的事的控制項,比沒有那個控制項更糟。
//
//   WIDTH=390 ./probe.sh probes/sheet-grab.js
var log = [], out = { 步驟: log, 沒過的: [] };
function ok(name, cond, extra) {
  log.push((cond ? "✓ " : "✗ ") + name + (cond ? "" : "   ← " + JSON.stringify(extra)));
  if (!cond) out.沒過的.push(name);
}
var sleep = function (ms) { return new Promise(function (r) { w.setTimeout(r, ms); }); };
async function until(fn, tries) {
  for (var i = 0; i < (tries || 120); i++) { if (fn()) return true; await sleep(50); }
  return false;
}
function pt(type, y) {
  return new w.PointerEvent(type, { clientX: 20, clientY: y, pointerId: 7,
    bubbles: true, cancelable: true, pointerType: "touch" });
}
(async function () {
  try {
    if (w.innerWidth > 640) {
      /* **不在桌機下斷言。** `.sheet-grab` 在那裡是 display:none,量一個看不見的
         東西永遠會過 —— 那種綠燈證明的是零。 */
      out.說明 = "**這個寬度沒有量** —— 這一支要 WIDTH=390。桌機那條是左邊拉寬的 .sheet-grip,由 drawer.js 負責。";
      out.結論 = "跳過(不是桌機的題目)";
      document.getElementById("r").textContent = JSON.stringify(out, null, 2);
      return;
    }
    /* ---- 底部那幾層的順序 ----
       手機上分頁列(行程／搭機／花費／分帳)是 `position:fixed; bottom:0`,
       而許願那條也釘在底部。**第一版兩條都寫 `bottom:0`,整條導覽被蓋掉** ——
       而畫面看起來只是「少了一排東西」,不像有人壓在上面。

       **判準用 `elementFromPoint`,不用幾何。** 兩個矩形不重疊不等於按得到:
       中間可能還有第三層、或是有 `pointer-events` 的東西蓋著。
       直接問「這個點按下去會碰到誰」,那就是使用者的手指會碰到的東西。 */
    var tabs = d.querySelector(".tabs");
    var wishBar = d.querySelector("#wishbox > summary");
    ok("手機上分頁列是浮在底部的(這一段的前提)",
      w.getComputedStyle(tabs).position === "fixed", w.getComputedStyle(tabs).position);
    var tb = tabs.getBoundingClientRect(), wr = wishBar.getBoundingClientRect();
    ok("許願那條坐在分頁列**上面**,不是蓋在它身上",
      wr.bottom <= tb.top + 1, { 許願那條下緣: Math.round(wr.bottom), 分頁列上緣: Math.round(tb.top) });
    var planTab = d.getElementById("tab-plan");
    var pb = planTab.getBoundingClientRect();
    var hitTab = d.elementFromPoint(Math.round(pb.left + pb.width / 2), Math.round(pb.top + pb.height / 2));
    ok("「行程」那顆分頁按下去真的碰得到它(不是碰到蓋在上面的東西)",
      !!hitTab && (hitTab === planTab || planTab.contains(hitTab)),
      hitTab && (hitTab.tagName.toLowerCase() + (hitTab.id ? "#" + hitTab.id : "")));
    var hitWish = d.elementFromPoint(Math.round(wr.left + wr.width / 2), Math.round(wr.top + wr.height / 2));
    ok("許願那條按下去也碰得到它自己",
      !!hitWish && (hitWish === wishBar || wishBar.contains(hitWish)),
      hitWish && (hitWish.tagName.toLowerCase() + (hitWish.className ? "." + String(hitWish.className).trim().split(/\s+/).join(".") : "")));
    ok("而且那條會報幾個願望", /\d/.test(wishBar.textContent), wishBar.textContent.trim());

    var sheet = d.getElementById("map-sheet"), grab = d.getElementById("map-grab");
    d.getElementById("day-map-btn").click();
    ok("地圖打得開", await until(function () { return !sheet.hidden; }), sheet.hidden);
    await sleep(100);
    var inEl = sheet.querySelector(".sheet-in");
    var h0 = Math.round(inEl.getBoundingClientRect().height);
    ok("手機上那條握把看得見", !!grab && w.getComputedStyle(grab).display !== "none",
      grab && w.getComputedStyle(grab).display);
    /* **`touch-action:none` 是功能不是樣式。** 少了它,手指往上滑會被瀏覽器當成
       捲頁面,拖到一半整張圖就跑掉 —— 而那看起來像「拖不動」,不像設定漏了。 */
    ok("握把吃得下拖曳手勢(touch-action:none)",
      w.getComputedStyle(grab).touchAction === "none", w.getComputedStyle(grab).touchAction);

    /* 用真的指標事件拖。**直接改 style 的話,量到的是我自己寫進去的值。** */
    var gb = grab.getBoundingClientRect(), y0 = gb.top + gb.height / 2;
    grab.dispatchEvent(pt("pointerdown", y0));
    w.dispatchEvent(pt("pointermove", y0 - 10000));
    w.dispatchEvent(pt("pointerup", y0 - 10000));
    await sleep(100);
    var h1 = Math.round(inEl.getBoundingClientRect().height);
    ok("往上拖 → 真的變高(以前拖了什麼都不會發生)", h1 > h0, { 拖之前: h0, 拖之後: h1 });
    ok("而且拖得到全螢幕(視窗多高就多高)", h1 >= w.innerHeight - 2,
      { 高度: h1, 視窗: w.innerHeight });
    ok("地圖自己也跟著長高,不是留一塊白的", 
      Math.round(d.getElementById("map").getBoundingClientRect().height) > 300,
      Math.round(d.getElementById("map").getBoundingClientRect().height));

    var gb2 = grab.getBoundingClientRect(), y1 = gb2.top + gb2.height / 2;
    grab.dispatchEvent(pt("pointerdown", y1));
    w.dispatchEvent(pt("pointermove", y1 + 10000));
    w.dispatchEvent(pt("pointerup", y1 + 10000));
    await sleep(100);
    var h2 = Math.round(inEl.getBoundingClientRect().height);
    /* 往下拖要縮得回來,**但不可以縮到不見** —— 要收起來有 ✕ 和 Esc,
       不該從拖拉裡長出第二個關閉方式(兩個關法就會有一個先過期)。 */
    ok("往下拖 → 縮得回來,而且沒有把地圖關掉",
      h2 < h1 && h2 >= 240 && !sheet.hidden, { 最高: h1, 縮回: h2, 收起來了嗎: sheet.hidden });
  } catch (e) {
    out.爆掉了 = String((e && e.stack) || e);
  }
  out.結論 = out.爆掉了
    ? "✗ 中途爆掉,跑到第 " + log.length + " 條就停了 —— 後面的沒跑到"
    : out.沒過的.length ? out.沒過的.length + " 項沒過" : "全部通過";
  document.getElementById("r").textContent = JSON.stringify(out, null, 2);
})();

return { 說明: "非同步" };
