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
    /* **門檻從 640 拉到 1279(2026-09-23)。** 窄桌機整段改成跟手機一模一樣,
       所以這一支現在管的是「沒有三欄的每個寬度」,要 WIDTH=390 也要 WIDTH=900。 */
    if (w.innerWidth >= 1280) {
      out.說明 = "**這個寬度沒有量** —— 這一支量的是手機那一套(地圖是底、清單是三段式 sheet)," +
        "1280 以上是三欄版面,由 drawer.js 負責。";
      out.結論 = "跳過(不是這個寬度的題目)";
      document.getElementById("r").textContent = JSON.stringify(out, null, 2);
      return;
    }
    /* **量的是清單停在哪一段,不是動畫好不好看 —— 所以把過場關掉。**
       `#panel-plan` 的高度有 `transition:height .22s`。在這個無頭環境裡
       `requestAnimationFrame` 一格都不跑(量過:兩秒 0 格,兩版都一樣),
       而 2026-09-23 併進來的那三條 PR 之後,那個 transition 的 `currentTime`
       **永遠停在 0**,高度就卡在起點 —— 拖到哪一段都是 423px。
       同一支探針在 `4bcc6cf` 上跑三次全過、在合併後的 main 上跑三次全掛,
       所以不是飄。

       **我沒有找出為什麼。** 排除掉的:JS 錯誤(無)、無限重畫(1.5 秒內地圖
       DOM 變動 0 次)、卡住的網路(圖磚 12 張全部載完)、ResizeObserver 迴圈
       (style 只被改 4 次,值都一樣)、CSS 規則(兩版逐字相同)。

       關掉過場之後,`--det` 一改高度就立刻跟上(量過:800 → 800、600 → 600),
       這三條問的那件事就量得到了。

       **代價要講清楚:這一支從此看不到「動畫卡住」這種壞法。**
       如果哪天真機上清單拖了不動,這裡會是綠的。那件事目前靠人去拖一下確認。 */
    var _nofx = d.createElement("style");
    _nofx.textContent = "#panel-plan{transition:none!important}";
    d.head.appendChild(_nofx);
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
    /* **誰都不可以伸到分頁列底下。** `--tabh` 第一次量到 55 而它其實是 79
       (字體還沒換、第五個分頁還沒排進去),差 24px —— 地圖和清單的底都伸進去,
       而清單最後一列被蓋掉一截。**畫面上那看起來只是「最後一項有點擠」。** */
    var tabTop = d.querySelector(".tabs").getBoundingClientRect().top;
    ok("地圖的底停在分頁列上緣", map.getBoundingClientRect().bottom <= tabTop + 1,
      { 地圖底: Math.round(map.getBoundingClientRect().bottom), 分頁列上緣: Math.round(tabTop) });
    ok("清單 sheet 的底也停在那裡(最後一列不會被蓋掉)",
      sheet.getBoundingClientRect().bottom <= tabTop + 1,
      { 清單底: Math.round(sheet.getBoundingClientRect().bottom), 分頁列上緣: Math.round(tabTop) });
    var mr = map.getBoundingClientRect();
    /* **從頂列下面鋪到分頁列上面。** 第一版寫「佔視窗八成以上」,而頂列改成
       「把東西往下擠」之後地圖就從 115 開始了 —— 那是要的行為,不是縮水。
       閾值式的斷言碰到版面改動就會這樣:它守的是一個數字,不是一件事。
       改成問那件事本身:上緣貼著頂列、下緣貼著分頁列。 */
    var headBottom = d.querySelector(".topbar").getBoundingClientRect().bottom;
    var cb = d.getElementById("cloudbar");
    if (cb && !cb.hidden) headBottom = Math.max(headBottom, cb.getBoundingClientRect().bottom);
    ok("地圖從頂列下面開始(頂列不蓋住它,不然那兩個圖層開關會消失)",
      Math.abs(mr.top - headBottom) <= 1, { 地圖上緣: Math.round(mr.top), 頂列下緣: Math.round(headBottom) });
    ok("而且那兩個圖層開關看得見、按得到",
      (function () {
        var lay = d.getElementById("lay-plan");
        if (!lay || w.getComputedStyle(lay).display === "none") return false;
        var r = lay.getBoundingClientRect();
        var hit = d.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
        return !!hit && (hit === lay || lay.contains(hit));
      })(), "lay-plan");
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
    /* **捲動時,黏住的日期列要蓋住底下經過的東西。**
       「＋許願」和地圖那顆本來浮在日期卡上面 —— 我給它們墊了 `z-index:1`
       (為了擋 `<details>` 的開合),而那剛好跟黏住的日期列同一層、又排在後面。
       擋點擊該用 `stopPropagation()`,不是圖層。

       **判準是「那個位置最上面是誰」,不是兩個框有沒有重疊** ——
       捲到一半本來就會重疊,那是 sticky 的正常行為;要問的是誰蓋住誰。 */
    (function () {
      var sh = d.getElementById("panel-plan"), days = d.getElementById("days");
      var add = d.getElementById("add-wish-btn");
      sh.scrollTop = 150;
      return new Promise(function (r) { w.setTimeout(r, 350); }).then(function () {
        function topAt(e) {
          var q = e.getBoundingClientRect();
          var h = d.elementFromPoint(Math.round(q.left + q.width / 2), Math.round(q.top + q.height / 2));
          return h && (days === h || days.contains(h));
        }
        ok("捲動時「＋許願」被日期列蓋住(它在底下,不是浮在上面)", topAt(add), "add-wish-btn");
        sh.scrollTop = 0;
      });
    })();
    await sleep(450);

    /* **那條標頭不再是開關。** `#wishbox` 底層還是 `<details>`,而在這個版面裡
       「看行程還是看許願」是分頁在決定的 —— 那個收合開關已經沒有意義,
       但它還在:點一下整塊許願就收起來,使用者看到的是「內容整個不見了」。
       **開關要嘛有用,要嘛不要在。** */
    var sum = d.getElementById("wishbox").querySelector("summary");
    var wl = d.getElementById("wish-list");
    sum.click();
    await sleep(250);
    ok("點那條標頭不會把整塊許願收起來",
      d.getElementById("wishbox").open && wl.getBoundingClientRect().height > 10,
      { open: d.getElementById("wishbox").open, 清單高: Math.round(wl.getBoundingClientRect().height) });
    ok("而且它看起來就不可點(游標不是 pointer)",
      w.getComputedStyle(sum).cursor === "default", w.getComputedStyle(sum).cursor);

    d.getElementById("tab-plan").click();
    await sleep(400);
    ok("切回「行程」→ sheet 裡換回行程清單",
      w.getComputedStyle(d.getElementById("wishbox")).display === "none" &&
      w.getComputedStyle(d.querySelector(".cols > .col:not(#wishbox)")).display !== "none",
      { 許願: w.getComputedStyle(d.getElementById("wishbox")).display });

    /* ---- 開對話框不可以把底板抽走 ----
       **這一條是一個回報逼出來的,而且回報看起來像另一件事。**
       她說「許願時在對話框按取消,回到頁面地圖不見」,還說「按把手內容會消失」——
       兩句話聽起來是兩個 bug,實際上是同一個:開對話框前會把地圖收掉。

       那條規則是舊模型留下的:以前手機的地圖是 z70,會整片蓋住對話框。
       翻過來之後地圖是 z1 的背景,對話框本來就在它上面,收它只剩壞處 ——
       **而且沒有人會再打開它**。底板一抽走,收合 sheet 就變成「內容消失」。 */
    d.getElementById("add-wish-btn").click();
    await until(function () { return !d.getElementById("wish-add-overlay").hidden; });
    await sleep(200);
    ok("開「許願」對話框時,地圖還在(它是底,不該被收走)",
      !d.getElementById("map-sheet").hidden, d.getElementById("map-sheet").hidden);
    ok("而且對話框在地圖上面(所以本來就不必收它)",
      +w.getComputedStyle(d.getElementById("wish-add-overlay")).zIndex >
      +w.getComputedStyle(d.getElementById("map-sheet")).zIndex,
      { 對話框: w.getComputedStyle(d.getElementById("wish-add-overlay")).zIndex,
        地圖: w.getComputedStyle(d.getElementById("map-sheet")).zIndex });
    d.getElementById("wf-cancel").click();
    await sleep(300);
    ok("按取消回到頁面,地圖還在", !d.getElementById("map-sheet").hidden,
      d.getElementById("map-sheet").hidden);
    /* 收到剩一條的時候,底下露出來的必須是地圖 —— 不然「收起來」就等於「清空」。 */
    await drag(-9000);
    var mid = d.elementFromPoint(Math.round(w.innerWidth / 2), Math.round(w.innerHeight / 2));
    ok("收到剩一條時,畫面中央是地圖(不是頁面本身)",
      !!mid && !!mid.closest("#map-sheet"),
      mid && (mid.id || String(mid.className) || mid.tagName));
    await drag(0);

    /* ---- 對話框比畫面高的時候,要捲得到底 ----
       **這一條是一張截圖逼出來的**:搜「溫泉」回六筆候選,整張表比手機螢幕還高,
       而「你是誰」和送出鈕在畫面外、**而且捲不動**。使用者看到的是一張填不完的表。

       成因是 flex 置中的老坑:`align-items:center` 加上溢出時,項目比容器高的話
       上緣會溢出到捲不到的地方。改用 `margin:auto` 置中就沒有這件事。

       量的是**捲到底之後那兩個東西碰不碰得到** —— 存不存在不是重點,
       它們一直都存在。 */
    (function () {
      var real = w.fetch.bind(w), six = [];
      for (var i = 0; i < 6; i++) {
        six.push({ lat: "35." + (60 + i), lon: "139." + (70 + i),
          display_name: "溫泉" + i + ", 很長很長的地址, 兵庫縣/兵庫縣, 669-6899, 日本" });
      }
      w.fetch = function (u, init) {
        if (/nominatim/.test(String(u))) {
          return Promise.resolve({ ok: true, json: function () { return Promise.resolve(six); } });
        }
        return real(u, init);
      };
    })();
    d.getElementById("add-wish-btn").click();
    await until(function () { return !d.getElementById("wish-add-overlay").hidden; });
    d.getElementById("wf-title").value = "溫泉";
    d.querySelector('[data-seek="wf-title"]').click();
    await until(function () { return d.querySelectorAll('[data-hit="wf-title"]').length > 0; });
    await sleep(300);
    var ovr = d.getElementById("wish-add-overlay");
    ok("六筆候選會讓這張表比畫面高(這一條的前提)",
      d.getElementById("wish-form").getBoundingClientRect().height > w.innerHeight * 0.8,
      Math.round(d.getElementById("wish-form").getBoundingClientRect().height));
    ok("而且那一層捲得動", ovr.scrollHeight > ovr.clientHeight,
      { 內容: ovr.scrollHeight, 可見: ovr.clientHeight });
    ovr.scrollTop = ovr.scrollHeight;
    await sleep(200);
    function reach(e) {
      var r = e.getBoundingClientRect();
      if (r.bottom < 0 || r.top > w.innerHeight) return false;
      var h = d.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      return !!h && (h === e || e.contains(h));
    }
    ok("捲到底之後,送出鈕按得到", reach(d.getElementById("wf-submit")), "wf-submit");
    ok("捲到底之後,「你是誰」也選得到", reach(d.getElementById("wf-by")), "wf-by");
    /* 候選清單自己也要有上限 —— 不然「要挑的」和「要按的」會互相擠掉。
       **捲的那一層在 2026-09-24 換了**:以前是整個 `.seek-out`,現在是它裡面的
       `.hits`(候選最多露四則半),因為那句「沒找到?」的提示移到候選後面,
       而它必須留在捲動區外面才會一直看得到。
       這一條不是壞了,是它問的那個容器換了人 —— 問裡面那層才是現在的事實。 */
    var so = d.getElementById("wish-form").querySelector(".seek-out .hits")
      || d.getElementById("wish-form").querySelector(".seek-out");
    ok("候選清單自己有高度上限、自己捲", so.scrollHeight > so.clientHeight,
      { 容器: so.className, 內容: so.scrollHeight, 可見: so.clientHeight });
    d.getElementById("wf-cancel").click();
    await sleep(200);

    /* ---- 點小卡聚焦,再點一次退出來 ----
       以前只有「選進去」沒有「退出來」:要看回整片願望,得去點別的地方或換分頁,
       **用一個副作用去達成一件他直接想做的事**。 */
    d.getElementById("tab-wish").click();
    await sleep(500);
    var wrows = d.querySelectorAll("#wish-list [data-wish]");
    /* **挑一張真的有地點的。** 第一張是沒填地點的那一種,點它只會說
       「在地圖上沒有位置」—— 拿它測聚焦,量到的會是一個跟聚焦無關的 false。 */
    var target = null;
    for (var wi = 0; wi < wrows.length; wi++) {
      wrows[wi].click();
      await sleep(500);
      if (d.getElementById("map")._focus) { target = wrows[wi]; break; }
    }
    ok("點小卡 → 地圖聚焦到那一個點,那一列亮起來",
      !!target && d.querySelectorAll("[data-wish].on").length === 1 &&
      d.querySelectorAll(".map .pin.on").length === 1,
      { 聚焦: d.getElementById("map")._focus, 亮的列: d.querySelectorAll("[data-wish].on").length });
    /* **聚焦要把那個點放到「看得見的那一塊」的中央,不是地圖元素的中央。**
       手機上清單 sheet 蓋住地圖下半部 —— 照元素置中的話那個點會落在 sheet 後面,
       畫面上看起來是「按了小卡,地圖動了一下,但要找的東西不在」。
       **兩個 sheet 高度都量**:可見範圍差很多,只量一個的話另一個錯了沒人知道。 */
    function centreErr() {
      var mr2 = d.getElementById("map").getBoundingClientRect();
      var sr2 = d.getElementById("panel-plan").getBoundingClientRect();
      var pin = d.querySelector(".map .pin.on");
      if (!pin) return null;
      var pr = pin.getBoundingClientRect();
      var top = mr2.top, bot = Math.min(mr2.bottom, sr2.top);
      return { 差: Math.abs(Math.round(pr.top + pr.height / 2 - (top + bot) / 2)),
               在範圍裡: pr.top >= top - 1 && pr.bottom <= bot + 1 };
    }
    var cA = centreErr();
    ok("聚焦之後那個點落在可見範圍的中央(不是躲在 sheet 後面)",
      !!cA && cA.在範圍裡 && cA.差 <= 4, cA);
    await drag(-9000);
    if (target) { target.click(); await sleep(600); target.click(); await sleep(700); }
    var cB = centreErr();
    ok("sheet 收起來之後再聚焦,一樣落在可見範圍的中央", !!cB && cB.在範圍裡 && cB.差 <= 4, cB);
    await drag(0);
    await sleep(300);

    var nBefore = d.querySelectorAll(".map .pin").length;
    if (target) { target.click(); await sleep(500); }
    ok("再點同一張 → 退出來,回到沒有選的樣子",
      !d.getElementById("map")._focus && d.querySelectorAll("[data-wish].on").length === 0 &&
      d.querySelectorAll(".map .pin.on").length === 0,
      { 聚焦: d.getElementById("map")._focus, 亮的列: d.querySelectorAll("[data-wish].on").length });
    ok("而且願望的點一顆都沒少(退出來不是篩掉)",
      d.querySelectorAll(".map .pin").length === nBefore,
      { 之前: nBefore, 之後: d.querySelectorAll(".map .pin").length });
    /* **行程小卡也要能切換,而且取消要回到預設視野。**
       兩件事第一版都漏了:只做了願望、而且取消只把亮的拿掉,地圖還停在剛才
       湊近看的位置 —— 使用者要的是「退出來看整片」,看到的是「不亮了但還是這麼近」。

       行程那邊還有一個更安靜的坑:手機上地圖放的是全部天數,點叫 `p<日期>-<序>`,
       而點擊處理寫死去找 `d<序>` —— **兩邊用不同的判準算同一件事**,
       於是點了行程小卡什麼都不會發生。畫哪些點和找哪一顆現在共用 `planFiltered()`。 */
    d.getElementById("tab-plan").click();
    await sleep(600);
    var mp = d.getElementById("map");
    var v0 = { z: mp._v.z, cx: +mp._v.cx.toFixed(2) };
    var srows = d.querySelectorAll("#route .stop"), shit = null;
    for (var si = 0; si < srows.length; si++) {
      srows[si].click();
      await sleep(600);
      if (mp._focus) { shit = srows[si]; break; }
    }
    ok("點行程小卡 → 地圖聚焦到那一個點", !!shit && !!mp._focus && !!mp._focus.length,
      { 聚焦: mp._focus });
    if (shit) { shit.click(); await sleep(700); }
    ok("再點同一張 → 取消聚焦", !mp._focus, { 聚焦: mp._focus });
    /* **回到預設視野,不只是不亮了。** 比的是縮放和中心,不是有沒有 class。 */
    ok("而且地圖縮回預設視野(跟沒選之前一樣)",
      mp._v.z === v0.z && +mp._v.cx.toFixed(2) === v0.cx,
      { 之前: v0, 現在: { z: mp._v.z, cx: +mp._v.cx.toFixed(2) } });
    d.getElementById("tab-wish").click();
    await sleep(500);

    /* ---- 左右滑換「行程 ⇄ 許願」 ----
       **每一條讓路規則都要問**,因為它們都是「兩個手勢搶同一塊地」——
       而搶輸的那一個不會報錯,只會安靜地不動作。 */
    /* **這一段以前包在一個沒有被 `await` 的 Promise 鏈裡。**
       它在探針印出結論之後才跑,所以那五條**一條都沒被算進去** ——
       把手勢整個關掉,結論照樣印「全部通過」。
       沒跑到的不會進「沒過的」,而「沒過的」是空的就會被當成全過。
       所以這裡全部攤平成 await,跟這支其他地方一樣。 */
    var sh2 = d.getElementById("panel-plan");
    async function sw(x0, y0, dx, dy, target, ms) {
      var t = target || sh2;
      t.dispatchEvent(new w.PointerEvent("pointerdown", { clientX: x0, clientY: y0,
        pointerId: 5, bubbles: true, cancelable: true, pointerType: "touch" }));
      await sleep(ms || 60);
      t.dispatchEvent(new w.PointerEvent("pointerup", { clientX: x0 + dx, clientY: y0 + dy,
        pointerId: 5, bubbles: true, cancelable: true, pointerType: "touch" }));
      await sleep(350);
    }
    d.getElementById("tab-plan").click();
    await sleep(350);
    var midX = Math.round(w.innerWidth / 2);
    var midY = Math.round(sh2.getBoundingClientRect().top + 120);
    await sw(midX, midY, -120, 4);
    ok("在清單上往左滑 → 換到「許願」", d.body.dataset.view === "wish", d.body.dataset.view);
    await sw(midX, midY, 120, 4);
    ok("往右滑 → 換回「行程」", d.body.dataset.view === "plan", d.body.dataset.view);
    /* 讓路 1:日期那一排自己會橫向捲,在它上面滑不該換頁 */
    var daysEl2 = d.getElementById("days"), db = daysEl2.getBoundingClientRect();
    await sw(Math.round(db.left + db.width / 2), Math.round(db.top + db.height / 2), -120, 4, daysEl2);
    ok("**在日期那一排上滑不會換頁**(那是在找日子,不是要換頁)",
      d.body.dataset.view === "plan", d.body.dataset.view);
    await sw(midX, midY, 30, 160);
    ok("**直著滑不會換頁**(那是在捲清單)", d.body.dataset.view === "plan", d.body.dataset.view);
    await sw(midX, midY, -30, 2);
    ok("滑一點點不算(要走夠遠才換)", d.body.dataset.view === "plan", d.body.dataset.view);


    /* **拖放是桌機才有的。** 願望卡長按拖進時間軸那條路,2026-09-17 就是因為
       「用大拇指做這件事太難」被拿掉的;它在三欄版面回來了,這裡守住它沒有跟著回到手機。
       判準是那個 class —— 它同時決定游標樣式和拖曳要不要理你。 */
    ok("手機上願望卡不能拖(那條路只給滑鼠)",
      !d.getElementById("wish-list").classList.contains("can-sort"),
      d.getElementById("wish-list").className);

    /* **那兩顆地圖鈕整個刪掉了(2026-09-23)**,不再是「藏起來」。
       問的東西也跟著換:從「它看不到」變成「它不存在」——
       藏起來的按鈕 `.click()` 照樣會動,不存在的不會。 */
    ok("那兩顆地圖鈕不存在(地圖一直都在,它們沒有工作了)",
      !d.getElementById("day-map-btn") && !d.getElementById("wish-map-btn"),
      { day: !!d.getElementById("day-map-btn"), wish: !!d.getElementById("wish-map-btn") });
    d.getElementById("tab-plan").click();
    await sleep(400);

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
