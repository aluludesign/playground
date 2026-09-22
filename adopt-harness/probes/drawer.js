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
/* 跟 index.html 的 `FRACS` / `MINMAIN` 一字不差。**抄一份是有代價的**:
   那邊改了這邊沒跟上,斷言會紅而程式是對的(這一輪就發生過一次,
   見「關掉再打開」那條的註解)。留著是因為探針要能獨立算出期望值 ——
   從程式裡讀的話,程式錯了期望值也跟著錯,那就不是斷言了。 */
var FRACS = [1 / 4, 5 / 12, 7 / 12, 3 / 4], MINMAIN = 240;
var iw = w.innerWidth;
var want = function (k) { return Math.round(Math.max(240, Math.min(iw * FRACS[k - 1], iw - MINMAIN))); };
/* **量 `--drawer`,不要量 `getBoundingClientRect()`。**

   `applyDrawer()` 是同步寫進 `--drawer` 的,那是**狀態**;
   而 `.sheet` 上有 `transition: width .18s`,所以 rect 讀到的是**動畫跑到一半的值**。

   這害我把一個會動的修法判成壞的。量到的(診斷探針):

   | | css 變數 | rect |
   | --- | --- | --- |
   | 放開當下 | **480px** | 520 |
   | 350ms 後 | 480px | 480 |

   而且它是**間歇的**:探針前面做得越多,`--virtual-time-budget` 剩得越少,
   過場就越可能完全不推進,rect 於是一直停在拖曳時那個值。
   第一版探針(斷言少)過了,這一版(斷言多)沒過,**而程式是好的**。

   判準:**量一個有過場動畫的東西時,先問你要的是狀態還是畫面。**
   要狀態就讀來源(CSS 變數、dataset、localStorage);
   要畫面就得等動畫結束,而那在虛擬時間下不保證會發生。 */
function drawerPx() {
  var v = w.getComputedStyle(d.documentElement).getPropertyValue("--drawer").trim();
  return Math.round(parseFloat(v) || 0);
}
/* **拖曳要照真人的事件路徑走,不是三個事件都丟在握把上。**

   第一版就是那樣寫的,9 條全過,而 Lulu 在真的瀏覽器上拖一次就翻掉了 ——
   放開之後抽屜停在原地,沒有吸附。

   量出來的對照(這支探針自己跑的):

   | 在哪裡放開 | 結果 |
   | --- | --- |
   | 握把上 | 700 → 吸到 640 ✓ |
   | **body 上** | **500 → 500,完全沒有吸附** |

   而且 `grip.hasPointerCapture(1)` 回 **false** —— `setPointerCapture` 失敗了,
   而它包在 try/catch 裡,**失敗是無聲的**。
   拖曳一開始游標就離開那條 14px 的握把了,所以「放開落在握把上」
   本來就是少數情況 —— 第一版的探針量的是一條沒有人會走的路。

   **判準(給下一個要測互動的人):** 合成事件對「點一下」夠用;
   對**拖曳**不夠,因為拖曳的語意有一半在「指標抓取」和「事件落在誰身上」,
   而那正是合成事件最不像真人的地方。**把落點當成變數測一次**,
   兩種落點結果不同,就代表你的測法本身是那個結果的成因之一。 */
var pid = 0;
function drag(toWidth, releaseOn) {
  var grip = d.getElementById("map-grip");
  var x = iw - toWidth;
  pid++;
  var mk = function (t, cx) {
    return new w.PointerEvent(t, { clientX: cx, bubbles: true, cancelable: true, pointerId: pid, isPrimary: true });
  };
  grip.dispatchEvent(mk("pointerdown", iw - Math.round(d.getElementById("map-sheet").getBoundingClientRect().width)));
  /* 移動丟在 window 上 —— 真人的游標這時早就不在握把上了 */
  w.dispatchEvent(mk("pointermove", x));
  (releaseOn === "grip" ? grip : d.body).dispatchEvent(mk("pointerup", x));
}

(async function () {
  await sleep(0);   /* 陷阱 14-a:同步跑完的話結論會被 probe.sh 的佔位值蓋掉 */
  try {
    out.視窗寬 = iw;
    /* **這一支是桌機的題目,窄視窗不要跑。**
       它量的是右邊那個抽屜的四檔寬度,而 641 以下根本沒有抽屜 —— `.sheet` 是
       底部 sheet,`--drawer` 仍有值但沒有意義,於是「版面至少留得到 240px」
       必然紅(390 減掉 240 只剩 150)。**那是拿錯尺去量,不是壞掉。**
       我自己在一輪裡踩了兩次,所以擋在這裡:紅燈要留給真的壞掉的東西。
       手機上那條握把(量的是高度)由 `probes/sheet-grab.js` 負責。 */
    if (iw <= 640) {
      out.說明 = "**這個寬度沒有量** —— 這一支量的是桌機抽屜的寬度,要 WIDTH=1100 或 641;" +
        "手機上那條握把是 probes/sheet-grab.js。";
      out.結論 = "跳過(不是手機的題目)";
      document.getElementById("r").textContent = JSON.stringify(out, null, 2);
      return;
    }
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
    drag(Math.round(mid23) - 30, "body");
    await sleep(60);
    ok("拖到第 2、3 檔中間偏小 → 吸到第 2 檔",
      drawerPx() === want(2), { 量到: drawerPx(), 該是: want(2) });
    drag(Math.round(mid23) + 30, "body");
    await sleep(60);
    ok("拖到第 2、3 檔中間偏大 → 吸到第 3 檔",
      drawerPx() === want(3), { 量到: drawerPx(), 該是: want(3) });

    drag(50, "body");
    await sleep(60);
    ok("往最窄拖 → 停在第 1 檔,不會消失",
      drawerPx() === want(1), { 量到: drawerPx(), 該是: want(1) });
    drag(iw, "body");
    await sleep(60);
    out.最寬是螢幕的幾分之幾 = (want(4) / iw).toFixed(3) + "(該是 0.750,除非被夾制)";
    ok("往最寬拖 → 停在第 4 檔(= 螢幕的 3/4),而且版面還留得到 " + MINMAIN + "px",
      drawerPx() === want(4) && iw - drawerPx() >= MINMAIN - 1,
      { 量到: drawerPx(), 該是: want(4), 剩下: iw - drawerPx() });

    /* 每一檔都要記得住:存的是檔位不是像素,重開抽屜要回到同一檔。 */
    /* **落點對照:兩種放開方式要得到同一個結果。**
       不同的話,測法本身就是結果的成因之一(第一版正是如此)。 */
    drag(Math.round((want(1) + want(2)) / 2) + 20, "grip");
    await sleep(60);
    var onGrip = drawerPx();
    drag(Math.round((want(1) + want(2)) / 2) + 20, "body");
    await sleep(60);
    ok("在握把上放開、在別的元素上放開 → 吸到同一檔(落點不可以改變結果)",
      onGrip === drawerPx() && drawerPx() === want(2),
      { 握把上: onGrip, body上: drawerPx(), 該是: want(2) });

    out.存的k = w.localStorage.getItem("tokyo5-drawer");
    ok("存的是檔位(1–4),不是像素", /^[1-4]$/.test(out.存的k || ""), out.存的k);
    /* **期望值不要寫死檔位。** 第一版寫 `want(4)`,因為當時最後一次拖曳是拖到最寬;
       後來在它前面插了「落點對照」那組,檔位變成 2,而斷言沒跟著改 ——
       **紅的是斷言過期,不是程式壞掉**。改成「回到剛才那一個」就不會再過期。 */
    var beforeClose = drawerPx();
    d.getElementById("map-sheet-x").click();
    await sleep(120);
    d.getElementById("day-map-btn").click();
    await until(function () { return !d.getElementById("map-sheet").hidden; });
    await sleep(60);
    ok("關掉再打開 → 回到關掉之前那一檔",
      drawerPx() === beforeClose, { 關掉前: beforeClose, 打開後: drawerPx() });

    /* ---- 窄桌機的「許願」是一個分頁,不再是浮在底部的一條 ----
       **這一段以前量的是相反的東西。** 641–1279 以前的許願是一條 `position:fixed`
       釘在底部的 bar,點開會變成滿版 sheet —— 而抽屜也是 fixed,兩個 fixed
       不會互相閃避,所以那時候要量「那條有沒有從抽屜底下穿過去」。

       那條收掉了(2026-09-22):<1280 一律是分頁,許願是版面裡的一欄。
       **那三條不是壞了,是量的東西沒了。** 換成問新模型該成立的事:
       分頁在不在、切過去之後露出來的是誰、日期那一列歸誰、以及這一頁捲不捲得動。 */
    if (iw >= 641 && iw < 1280) {
      var wb = d.getElementById("wishbox");
      var tw = d.getElementById("tab-wish");
      ok("窄桌機看得到「許願」分頁", w.getComputedStyle(tw).display !== "none",
        w.getComputedStyle(tw).display);
      var tabs = Array.prototype.slice.call(d.querySelectorAll(".tab"))
        .filter(function (b) { return w.getComputedStyle(b).display !== "none"; })
        .map(function (b) { return b.dataset.tab; });
      ok("而且它排在「行程」後面", tabs[0] === "plan" && tabs[1] === "wish", tabs);

      tw.click();
      await sleep(250);
      ok("切過去之後,行程那一欄收起來了",
        w.getComputedStyle(d.getElementById("route").closest(".col")).display === "none",
        w.getComputedStyle(d.getElementById("route").closest(".col")).display);
      var wr = wb.getBoundingClientRect();
      ok("許願那一欄真的攤在畫面上(不是一個收起來的 `<details>`)",
        wb.open && wr.height > 100, { open: wb.open, 高: Math.round(wr.height) });
      /* 幾何之外再問一次:願望清單第一列上面那一點,手指會碰到誰。 */
      var row = d.querySelector("#wish-list .wish");
      var rr = row.getBoundingClientRect();
      var hit = d.elementFromPoint(Math.round(rr.left + 20), Math.round(rr.top + 10));
      ok("**願望那一列碰得到** —— `.click()` 在 display:none 上照樣會成功,所以這裡問的是手指",
        !!hit && row.contains(hit),
        hit && (hit.tagName.toLowerCase() + (hit.id ? "#" + hit.id : "." + hit.className)));

      /* **她之前踩過的那一個:頁面太長不能滑。** 許願攤開的時候 body 被鎖住過。
         手機上鎖是對的(那裡許願是一張 fixed 的 sheet),窄桌機上鎖就是這個 bug。 */
      ok("這一頁捲得動(body 沒有被鎖住)",
        w.getComputedStyle(d.body).overflow !== "hidden", w.getComputedStyle(d.body).overflow);

      /* 日期那一列:管理員看得到(它的用途是「排到哪一天」),沒登入的人看不到。 */
      var daysEl = d.getElementById("days");
      var canEdit = d.body.classList.contains("can-edit");
      ok("日期那一列在許願頁的去留,跟「能不能改」是同一件事(現在是 can-edit=" + canEdit + ")",
        (w.getComputedStyle(daysEl).display !== "none") === canEdit,
        { can_edit: canEdit, display: w.getComputedStyle(daysEl).display });

      /* **另外半邊也要問。** 上面那條在 can-edit=true 的時候兩邊都成立,
         單看它不知道規則是不是真的綁在那個 class 上。把 class 拿掉再問一次。 */
      d.body.classList.remove("can-edit");
      await sleep(80);
      ok("沒有通行碼的人,許願頁上沒有那一排日期(按了也排不進去的東西不要給他)",
        w.getComputedStyle(daysEl).display === "none", w.getComputedStyle(daysEl).display);
      d.body.classList.add("can-edit");
      await sleep(80);

      /* 底部那條 bar 真的不在了 —— 畫面最底那一點不可以碰到許願的標頭。 */
      var low = d.elementFromPoint(Math.round(w.innerWidth / 2), w.innerHeight - 6);
      var sum = wb.querySelector("summary");
      ok("畫面底部沒有一條浮著的許願 bar(它退場了,不是被蓋住)",
        !low || !(low === sum || sum.contains(low)),
        low && (low.tagName.toLowerCase() + (low.id ? "#" + low.id : "." + low.className)));

      d.getElementById("tab-plan").click();
      await sleep(200);
      ok("切回行程,許願那一欄就收起來(兩個分頁不會同時在畫面上)",
        w.getComputedStyle(wb).display === "none", w.getComputedStyle(wb).display);
    } else if (iw >= 1280) {
      /* ---- 三欄版面:關不掉,而且對話框不可以被抽屜蓋掉 ----
         **這一段是被一個「按了沒反應」逼出來的。** 對話框是 z60、抽屜是 z70,
         我原本判斷「桌機地圖是右邊一欄,跟畫面中央的對話框不重疊」——
         那句話在抽屜被拖寬之後就不成立:拖到 3/4 的時候置中的對話框整張都在
         抽屜底下。**元素在、值也對、只是看不到**,斷言那時候一條都不會紅。 */
      ok("三塊都在(行程 ｜ 許願 ｜ 地圖)",
        !!d.querySelector(".cols > .col") && !!d.getElementById("wishbox") &&
        !d.getElementById("map-sheet").hidden,
        { 欄: d.querySelectorAll(".cols > .col").length, 地圖收著: d.getElementById("map-sheet").hidden });
      ok("**那顆 ✕ 不在**(關不掉的東西不該有關閉鈕)",
        w.getComputedStyle(d.getElementById("map-sheet-x")).display === "none",
        w.getComputedStyle(d.getElementById("map-sheet-x")).display);
      /* 把抽屜拖到最寬,那是對話框最容易被蓋掉的狀態 —— 要測就測最壞的那一種。 */
      drag(want(4));   /* 用這支自己的拖曳助手,拖到第 4 檔 = 螢幕的 3/4 */
      await sleep(200);
      d.getElementById("add-stop-btn").click();
      await until(function () { return !d.getElementById("stop-add-overlay").hidden; });
      await sleep(150);
      var card = d.getElementById("stop-form").getBoundingClientRect();
      var mr = d.getElementById("map-sheet").getBoundingClientRect();
      ok("抽屜拉到最寬的時候,加行程那張對話框沒有躲在抽屜底下",
        card.right <= mr.left + 1,
        { 卡片: [Math.round(card.left), Math.round(card.right)], 抽屜左緣: Math.round(mr.left) });
      /* 幾何之外再問一次:那張卡上面那一點,手指會碰到誰。 */
      var hit = d.elementFromPoint(Math.round(card.left + card.width / 2), Math.round(card.top + 20));
      ok("而且那張卡真的在最上面(碰得到它自己)",
        !!hit && d.getElementById("stop-form").contains(hit),
        hit && (hit.tagName.toLowerCase() + (hit.id ? "#" + hit.id : "")));
      d.getElementById("sf-cancel").click();
      await sleep(80);

      /* ---- 但登入那一層是門,不是對話框 ----
         上面那條「往左縮到地圖邊緣」對每一個 `.overlay` 都成立,
         **而登入用的是同一個 `.overlay`** —— 結果還沒進來的人看到的是
         一張清清楚楚、還能拖能點的地圖擺在門旁邊(她在 iPad 上拍到的)。
         這裡問的是門本身:它要蓋到視窗最右邊,而且地圖中央那一點碰不到地圖。 */
      d.getElementById("signin-overlay").hidden = false;
      await sleep(150);
      var ov = d.getElementById("signin-overlay").getBoundingClientRect();
      ok("登入那一層蓋到視窗最右邊(它是門,不是擺在地圖旁邊的對話框)",
        ov.right >= w.innerWidth - 1,
        { 門的右緣: Math.round(ov.right), 視窗寬: w.innerWidth });
      var ms = d.getElementById("map-sheet").getBoundingClientRect();
      var over = d.elementFromPoint(Math.round(ms.left + ms.width / 2), Math.round(ms.top + ms.height / 2));
      ok("**地圖正中央那一點碰不到地圖** —— 幾何之外再問一次手指會碰到誰",
        !!over && !d.getElementById("map-sheet").contains(over),
        over && (over.tagName.toLowerCase() + (over.id ? "#" + over.id : "." + over.className)));
      d.getElementById("signin-overlay").hidden = true;
      await sleep(80);
    } else {
      out.許願讓開抽屜 = "**這個寬度沒有量** —— 641 以下沒有抽屜。要量那一段用 WIDTH=900。";
    }
  } catch (e) {
    out.爆掉了 = String((e && e.stack) || e);
  }
  /* **爆掉了不算通過。** `沒過的` 是空的,只代表「跑到的那些都過了」——
     中途拋例外的話後面的斷言一條都沒跑,而沒跑的不會進 `沒過的`。
     舊式子不看 `爆掉了`,於是一次中途爆炸印出來的是「全部通過」。
     `seek` 就這樣把 `#we-again` 退場後少跑的四條蓋掉了,而筆記照抄成「52 全過」。 */
  out.結論 = out.爆掉了
    ? "✗ 中途爆掉,跑到第 " + log.length + " 條就停了 —— 後面的沒跑到"
    : out.沒過的.length ? out.沒過的.length + " 項沒過" : "全部通過";
  /* #r 在**外層**頁面,不在 iframe 裡(陷阱 14-b:用 d 去找它會拋在非同步裡沒人接) */
  document.getElementById("r").textContent = JSON.stringify(out, null, 2);
})();

return { 說明: "非同步" };
