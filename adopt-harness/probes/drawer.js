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
    /* **門檻從 641 拉到 1280(2026-09-23)。** 窄桌機整段改成跟手機一模一樣了:
       地圖是底、清單是三段式 sheet、分頁列在畫面下緣 —— 那裡**沒有抽屜**。
       所以這一支現在只問三欄版面那一段,1280 以下全部交給 sheet-grab。 */
    if (iw < 1280) {
      out.說明 = "**這個寬度沒有量** —— 這一支量的是三欄版面那個抽屜,要 WIDTH=1280 以上;" +
        "1280 以下是手機那一套,由 probes/sheet-grab.js 負責。";
      out.結論 = "跳過(不是這個寬度的題目)";
      document.getElementById("r").textContent = JSON.stringify(out, null, 2);
      return;
    }
    /* **不用開它。** 三欄版面裡地圖是第三塊,一進站就在;
       那顆「這天的地圖」已經刪掉了 —— 沒有人需要打開它。 */
    ok("一進站抽屜就在(三欄版面的第三塊,不必打開)",
      await until(function () { return !d.getElementById("map-sheet").hidden; }), null);
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
    /* **「關掉再打開 → 回到原來那一檔」這一條退場了(2026-09-23)。**
       它是這樣走的:按 ✕ 關掉、再按「這天的地圖」打開。**兩顆在這個寬度都不存在** ——
       ✕ 在三欄版面是 `display:none`(關不掉才是對的),而那顆地圖鈕整個刪掉了。
       也就是說它走的是一條沒有人走得到的路,而 `.click()` 在那上面照樣會成功:
       **綠了四輪,量的是一個不存在的行為。**
       它真正想守的是「檔位記得住」,那件事改由下面這條問:存起來的那個數字,
       要跟畫面上現在的寬度對得起來。 */
    ok("存起來的檔位跟畫面上的寬度是同一件事(重開之後才回得到原位)",
      drawerPx() === want(parseInt(out.存的k, 10)),
      { 存的: out.存的k, 那一檔該是: want(parseInt(out.存的k, 10)), 現在: drawerPx() });

    /* ---- 窄桌機那一段整個搬走了 ----
       641–1279 以前在這裡量「許願是不是一個分頁、日期那一列歸誰、頁面捲不捲得動」。
       那段寬度現在跟手機一模一樣,所以那些問題由 `probes/sheet-grab.js` 在
       WIDTH=390 和 WIDTH=900 各問一次 —— **同一個模型不要有兩份斷言**,
       兩份遲早會有一份先過期。 */
    {

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

      /* ---- 滑過願望卡 → 地圖上對應的點亮起來 ----
         **判準是「那一層開著嗎」,不是「在哪一個分頁」。** 這一條原本問的是
         地圖在不在許願模式,於是在行程分頁把「大家的許願」打開之後,
         圖上明明有那些點,滑過卡片卻什麼都不會發生 —— 看得到、沒有反應。
         所以這裡在**行程分頁**問,而且兩邊都問:層開著會亮、關掉不會。 */
      var wl0 = d.getElementById("wish-list");
      /* **挑一張地圖上真的有的卡。** 第一張是 teamLab,它沒填地點 ——
         圖上根本沒有那個點,滑過去不亮是對的,而我第一版就是挑了它,
         於是紅字指著程式,錯的卻是探針。
         判準用剛做的 📍:它的意思就是「地圖上找得到這一筆」。 */
      var wcard = (wl0.querySelector(".wish .pinmark") || {}).closest
        ? wl0.querySelector(".wish .pinmark").closest(".wish") : null;
      var lw = d.getElementById("lay-wish");
      if (lw.getAttribute("aria-pressed") !== "true") { lw.click(); await sleep(400); }
      ok("願望清單裡至少有一張卡是地圖上找得到的(沒有的話下面幾條問不出東西)",
        !!wcard, wl0.textContent.slice(0, 40));
      function hoverOn(e) {
        e.dispatchEvent(new w.MouseEvent("mouseover", { bubbles: true, cancelable: true }));
      }
      hoverOn(wcard);
      await sleep(120);
      var litKey = (function () { var p = d.querySelector(".map .pin.hot"); return p && p.dataset.k; })();
      ok("「大家的許願」開著時,滑過願望卡 → 地圖上那個點亮起來",
        !!litKey && litKey[0] === "w", { 亮的: litKey });
      /* 亮的要是**同一筆**,不是隨便一個願望的點 */
      /* **不要叫 `want`。** 這支檔案上面已經有一個 `want(檔位)` 的助手,
         而 `var` 會提升到整個函式 —— 取同一個名字會把它整個蓋掉,
         於是**前面**那條呼叫 `want(2)` 的斷言炸在「is not a function」,
         而錯的地方在後面幾十行。 */
      var mineIdx = [].slice.call(wl0.querySelectorAll(".wish[data-wish]")).indexOf(wcard);
      ok("而且亮的是同一筆,不是隨便一個點",
        litKey === "w" + mineIdx, { 亮的: litKey, 該是: "w" + mineIdx });
      wl0.dispatchEvent(new w.MouseEvent("mouseleave", { bubbles: true }));
      await sleep(120);
      ok("移開就不亮了", !d.querySelector(".map .pin.hot"),
        (d.querySelector(".map .pin.hot") || {}).dataset);
      /* 另外半邊:那一層關掉之後,圖上根本沒有那個點,滑過去不該有任何反應 */
      lw.click();
      await sleep(400);
      hoverOn(wcard);
      await sleep(120);
      ok("**那一層關掉之後滑過去沒有反應**(圖上根本沒有那個點)",
        !d.querySelector(".map .pin.hot"), (d.querySelector(".map .pin.hot") || {}).dataset);
      lw.click();
      await sleep(300);

      /* ---- 桌機才有的:長按願望卡,拖進時間軸 ----
         **這件事 2026-09-17 被拿掉過**,理由是「用大拇指做這件事太難」——
         那是手機的理由。三欄版面有滑鼠、而且時間軸和願望並排看得到,所以它回來了。
         這裡問三件事:那一欄標著「可以拖」、長按真的會浮起來、放開會進到問時間那一關。
         (真正插進去那一步不做 —— 它會寫資料,而寫入的形狀 geofix 已經在問了。) */
      var wl = d.getElementById("wish-list");
      ok("願望清單標著「可以拖」(桌機才有)",
        wl.classList.contains("can-sort"), wl.className);
      var card = wl.querySelector(".wish[data-wish]");
      var cb = card.getBoundingClientRect();
      function pev(t, x, y) {
        return new w.PointerEvent(t, { clientX: x, clientY: y, pointerId: 7,
          bubbles: true, cancelable: true, pointerType: "mouse" });
      }
      card.dispatchEvent(pev("pointerdown", cb.left + 30, cb.top + 12));
      await sleep(120);
      ok("**按下去就浮起來不算拖**(短按是點,不是拖 —— 要按住才算)",
        !card.classList.contains("lifted"), card.className);
      await sleep(400);
      ok("長按之後卡片浮起來了", card.classList.contains("lifted"), card.className);
      var rt = d.getElementById("route").getBoundingClientRect();
      /* **事件要發在卡片上,不是 window。** 卡片浮起來的時候做了 `setPointerCapture`,
         真實瀏覽器從此把這根指標的事件都送到那張卡片(再往上冒泡到清單,
         處理器就掛在那裡)。發到 window 的話,那一路冒泡經過的是別的地方,
         處理器一條都收不到 —— 而畫面上看起來就像「拖不動」。 */
      card.dispatchEvent(pev("pointermove", rt.left + 60, rt.top + 30));
      await sleep(80);
      ok("拖到時間軸上會標出要插在哪一格", !!d.querySelector(".dropline"),
        d.getElementById("route").className);
      card.dispatchEvent(pev("pointerup", rt.left + 60, rt.top + 30));
      await sleep(250);
      ok("放開之後會先問幾點(插在兩筆中間要有時間,不然清單順序跟時間會打架)",
        !d.getElementById("time-overlay").hidden, d.getElementById("time-overlay").outerHTML.slice(0, 80));
      var tc = d.getElementById("tf-cancel") || d.querySelector("#time-overlay [data-cancel]");
      if (tc) tc.click();
      await sleep(120);
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
