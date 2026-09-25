// 登入之後那一段:認領一個位子,以及認領完「你是誰」就不再讓你選別人。
//
// **這一支要用 `PAGE=` 跑**,不然一條都測不到:
//     PAGE='/index.html?fake=login' ./probe.sh probes/claim.js
//
// 為什麼要那個參數:登入的證據是一張 HttpOnly cookie,而開機那一趟
// (`askWhoAmI()` → `loadTeam()`)在探針裝樁之前就跑完了。也就是說
// **「登入之後的畫面」以前一條斷言都驗不到** —— 而那是身分那一整塊,
// 包含這個專案裡最不該出錯的一件事:誰許的願算在誰頭上。
// `fixture.py` 看到 `?fake=login` 就在頁面自己身上裝樁,趕在 index.html 的
// <script> 之前。沒帶那個參數的話樁不會裝,所有既有的截圖和探針一個字都不受影響。
var log = [], out = { 步驟: log, 沒過的: [] };
function ok(name, cond, extra) {
  log.push((cond ? "✓ " : "✗ ") + name + (cond ? "" : "   ← " + JSON.stringify(extra)));
  if (!cond) out.沒過的.push(name);
}
var q = function (sel) { return d.querySelector(sel); };
var sleep = function (ms) { return new Promise(function (r) { window.setTimeout(r, ms); }); };
async function until(fn, tries) {
  for (var i = 0; i < (tries || 80); i++) { if (fn()) return true; await sleep(50); }
  return false;
}

(async function () {
  /* **先讓出一次,再開始做事。**
     `(async function(){...})()` 的內容會同步跑到第一個 await 為止,而外層的
     probe.sh 在那之後才把同步回傳值寫進 `#r`。所以如果這一支在第一個 await
     之前就爆掉(例如卡片沒開、`btns[0]` 是 undefined),catch 寫好的結果會**被
     那個佔位字蓋掉** —— 印出來的是「非同步,真正的結果會晚一點蓋掉這一段」,
     看起來像什麼都沒發生。
     反向對照就是這樣騙到我的:把「開機自動跳出認領卡」拿掉之後,這一支印出佔位字,
     而那跟「跑掉了但沒結論」長得一模一樣。 */
  await sleep(0);
  try {
    /* 樁沒裝的話下面每一條都會用一個誤導的理由紅掉,所以先把這件事講清楚。 */
    if (!/fake=login/.test(String(w.location.search))) {
      out.結論 = "✗ 這一支要 PAGE='/index.html?fake=login' 才跑得動";
      d.getElementById; document.getElementById("r").textContent = JSON.stringify(out, null, 2);
      return;
    }

    var ov = q("#claim-overlay");
    ok("登入了但還沒有位子 → 自己跳出「你是哪一位?」", !!ov && ov.hidden === false,
      { 有: !!ov, hidden: ov && ov.hidden });

    var btns = [].slice.call(d.querySelectorAll(".claim-one"));
    var names = btns.map(function (b) { return b.textContent.trim(); });
    ok("列出來的是這一團的人", btns.length > 0, names);
    /* 志偉在樁裡是 claimed:true —— **已經有人的位子不該出現在可選清單裡**。
       出現的話使用者會按下去,然後拿到一句「這個位子已經有人了」,
       而那是一條走得到、走不通的路。 */
    ok("**已經有人的位子不出現**(看得到但按不得,比看不到更糟)",
      names.join("|").indexOf("志偉") < 0, names);
    ok("沒有人認領的四個都在", btns.length === 4, names);

    /* 顏色要在那一顆上 —— 分帳和座位圖靠顏色認人,他在這裡先看到自己要拿哪個顏色。 */
    var dot = btns[0].querySelector(".dot");
    ok("每一個位子帶著自己的顏色",
      !!dot && w.getComputedStyle(dot).backgroundColor !== "rgba(0, 0, 0, 0)",
      dot && w.getComputedStyle(dot).backgroundColor);

    /* 碰得到 —— 「看得到但按不到」是這個專案登記過的老陷阱。 */
    function onTop(e) {
      var r = e.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      var hit = d.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && (hit === e || e.contains(hit));
    }
    ok("而且真的按得到", onTop(btns[0]), btns[0].getBoundingClientRect());

    /* ---- 認領 ---- */
    var want = btns.filter(function (b) { return b.textContent.indexOf("佳瑜") >= 0; })[0];
    ok("清單裡有佳瑜那個位子", !!want, names);
    want.click();
    await until(function () { return q("#claim-overlay").hidden === true; });
    ok("按下去 → 卡片收起來", q("#claim-overlay").hidden === true);
    ok("**而且真的送出去了**(不是只在畫面上收掉)",
      (w.__claimCalls || []).length === 1 && w.__claimCalls[0].member === "chang_chiayu",
      w.__claimCalls);

    /* ---- 認領完,身分就不是自己宣稱的了 ---- */
    q("#add-wish-btn").click();
    await sleep(60);
    var by = q("#wf-by");
    ok("許願表單的「你是誰」自動變成我認領的那個位子",
      by.value === "chang_chiayu", by.value);
    ok("**而且不能再改成別人** —— 這才是整件事的重點",
      by.disabled === true, by.disabled);
    var cancel = q("#wf-cancel"); if (cancel) cancel.click();

    /* ---- 上面那條要說得出我是誰,而且要給得出一條改的路 ---- */
    q("#menu-btn").click();
    await sleep(120);
    var seat = q("#cloud-seat");
    ok("上面那條說得出我是哪一位", !!seat && /佳瑜/.test(seat.textContent),
      seat && seat.textContent);
    seat.click();
    await until(function () { return q("#claim-overlay").hidden === false; });
    ok("按它可以再開一次(按錯了要救得回來)", q("#claim-overlay").hidden === false);
    ok("這次那顆會說「放掉這個位子」,不是「先跳過」",
      /放掉/.test(q("#claim-skip").textContent), q("#claim-skip").textContent);

    q("#claim-skip").click();
    await until(function () { return (w.__claimCalls || []).length === 2; });
    ok("放掉 → 送出去的是空的位子代號",
      w.__claimCalls[1] && w.__claimCalls[1].member === "", w.__claimCalls);
    /* **等那一趟真的跑完,不要只等請求發出去。** `takeSeat()` 發完 POST 之後還要
       重抓一次成員、重畫。第一版等的是請求,然後馬上開表單 —— 那時候 `myMember`
       還沒清掉,於是斷言紅了,而**紅的是探針不是程式**。
       等的東西改成「畫面上已經說我沒有位子了」。 */
    await until(function () {
      var s = q("#cloud-seat");
      return s && /哪一位/.test(s.textContent);
    });
    q("#add-wish-btn").click();
    await sleep(60);
    ok("放掉之後「你是誰」又可以自己選了", q("#wf-by").disabled === false, q("#wf-by").disabled);

  } catch (e) {
    out.爆掉了 = String((e && e.stack) || e);
  }
  out.結論 = out.爆掉了
    ? "✗ 中途爆掉,跑到第 " + log.length + " 條就停了 —— 後面的沒跑到"
    : out.沒過的.length ? out.沒過的.length + " 項沒過" : "全部通過";
  document.getElementById("r").textContent = JSON.stringify(out, null, 2);
})();

return { 說明: "非同步,真正的結果會晚一點蓋掉這一段" };
