// 桌機右邊那個地圖抽屜:四檔是不是固定的,拖完放手吸到哪一檔,窄視窗怎麼讓步。
//
// 為什麼要有這一支:Lulu 回報「抽屜沒有固定在四個尺寸會亂跑」。
// 量出來的根因是**四檔以前是「視窗的 1/4、2/4…」而不是固定寬度** ——
// 所以「吸附到第 2 檔」不代表一個寬度,視窗一變它就變。
// 而且 `readDrawK()` 用 `Math.round(440 / quarter())` 反推預設檔,
// 在 1173px 附近第 1 檔(293)和第 2 檔(587)離 440 剛好一樣遠 ——
// **那裡必然有個懸崖,不是四捨五入寫錯**:量到 1172px 給 586、1176px 給 294。
//
//   WIDTH=1100 ./probe.sh probes/drawer.js     桌機常見寬度
//   WIDTH=641  ./probe.sh probes/drawer.js     桌機斷點,測夾制
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
var STEPS = [360, 480, 620, 800], MINMAIN = 320;
var iw = w.innerWidth;
var want = function (k) { return Math.max(260, Math.min(STEPS[k - 1], iw - MINMAIN)); };
function drawerPx() {
  return Math.round(d.getElementById("map-sheet").getBoundingClientRect().width);
}
function drag(toWidth) {
  var grip = d.getElementById("map-grip");
  var x = iw - toWidth;
  ["pointerdown", "pointermove", "pointerup"].forEach(function (t) {
    grip.dispatchEvent(new w.PointerEvent(t, { clientX: x, bubbles: true, cancelable: true, pointerId: 1 }));
  });
}

(async function () {
  await sleep(0);   /* 陷阱 14-a:同步跑完的話結論會被 probe.sh 的佔位值蓋掉 */
  try {
    out.視窗寬 = iw;
    d.getElementById("day-map-btn").click();
    ok("抽屜打得開", await until(function () { return !d.getElementById("map-sheet").hidden; }), null);
    await sleep(400);
    out.預設 = drawerPx();
    ok("預設是第 2 檔(不再從一個目標寬度反推 —— 那是懸崖的來源)",
      drawerPx() === want(2), { 量到: drawerPx(), 該是: want(2) });
    ok("底下的版面至少留得到 " + MINMAIN + "px",
      iw - drawerPx() >= MINMAIN - 1, { 剩下: iw - drawerPx() });

    /* 吸附:拖到兩檔中間偏某一邊,放手要吸到那一邊。
       **比的是像素距離**,不是「除以一檔有多寬」—— 檔位不等寬時只有前者對。

       **窄視窗下這幾條會變成恆真的,而探針要自己講出來。** 例如 641px:
       四檔全被夾成 321,`want(2) === want(3)`,於是「吸到第 2 檔」和「吸到第 3 檔」
       量到的是同一個數字,兩條都綠 —— 而它們什麼都沒測到。
       (這正是「問錯的問題會拿到一個乾淨的、錯的綠燈」,工具陷阱 12 的形狀。) */
    out.吸附測得到嗎 = want(2) !== want(3)
      ? "測得到(四檔在這個寬度下不同寬)"
      : "**恆真,沒測到東西** —— 這個寬度下四檔被夾成同一個值 " + want(2) + "px";
    var mid23 = (want(2) + want(3)) / 2;
    drag(Math.round(mid23) - 30);
    await sleep(350);
    ok("拖到第 2、3 檔中間偏小 → 吸到第 2 檔",
      drawerPx() === want(2), { 量到: drawerPx(), 該是: want(2) });
    drag(Math.round(mid23) + 30);
    await sleep(350);
    ok("拖到第 2、3 檔中間偏大 → 吸到第 3 檔",
      drawerPx() === want(3), { 量到: drawerPx(), 該是: want(3) });

    drag(50);
    await sleep(350);
    ok("往最窄拖 → 停在第 1 檔,不會消失",
      drawerPx() === want(1), { 量到: drawerPx(), 該是: want(1) });
    drag(iw);
    await sleep(350);
    ok("往最寬拖 → 停在第 4 檔,而且版面還留得到 " + MINMAIN + "px",
      drawerPx() === want(4) && iw - drawerPx() >= MINMAIN - 1,
      { 量到: drawerPx(), 該是: want(4), 剩下: iw - drawerPx() });

    /* 每一檔都要記得住:存的是檔位不是像素,重開抽屜要回到同一檔。 */
    out.存的k = w.localStorage.getItem("tokyo5-drawer");
    ok("存的是檔位(1–4),不是像素", /^[1-4]$/.test(out.存的k || ""), out.存的k);
    d.getElementById("map-sheet-x").click();
    await sleep(120);
    d.getElementById("day-map-btn").click();
    await until(function () { return !d.getElementById("map-sheet").hidden; });
    await sleep(350);
    ok("關掉再打開 → 回到同一檔", drawerPx() === want(4), { 量到: drawerPx(), 該是: want(4) });
  } catch (e) {
    out.爆掉了 = String((e && e.stack) || e);
  }
  out.結論 = out.沒過的.length ? out.沒過的.length + " 項沒過" : "全部通過";
  /* #r 在**外層**頁面,不在 iframe 裡(陷阱 14-b:用 d 去找它會拋在非同步裡沒人接) */
  document.getElementById("r").textContent = JSON.stringify(out, null, 2);
})();

return { 說明: "非同步" };
