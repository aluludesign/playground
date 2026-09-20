// 「再查一次」那條退路的前端行為,在真實 DOM 上跑一遍。
//
// 為什麼要有這一支:退路那一端要金鑰,而這個 session 沒有金鑰、也不該有。
// 沒有它的話,整條路唯一的證據會是「我讀過程式碼」—— 這個 repo 對那種證據的
// 評價寫在 ADOPTION.md 裡好幾遍了。
//
// 所以它**把 fetch 換成樁**:`?resource=geocode` 那幾筆由這裡回答,其餘原樣放行。
// 量到的是「伺服器照規格回 X 的時候,前端做了什麼」——
// **不是**「那個服務真的會回 X」。後者只有 Lulu 設好環境變數之後才驗得到。
//
// 這一支是非同步的(要點按鈕、等重畫),所以它自己晚一點覆寫 #r,
// 回傳值只是佔位。probe.sh 的 --virtual-time-budget 撐得住。
//
// 「沒填地點就不查 + 按『對』」那一輪擴了三段(見 geocode-place-and-confirm.md):
//   - 規則一:沒填地點的那幾筆,**一次查詢都不該發**,連按鈕都不該畫。
//     這裡把 Nominatim 的 URL 全部記下來事後對帳 —— 「沒發生」要有證據。
//   - 規則三:虛線圈要變得回來。按「對」→ 實線、不再問、**而且不打網路**。
//   - 送出去的 URL 在願望那條路上要帶 `wish=`,行程那條不帶。

var log = [];
var out = { 步驟: log, 沒過的: [] };
function ok(name, cond, extra) {
  log.push((cond ? "✓ " : "✗ ") + name + (cond ? "" : "   ← " + JSON.stringify(extra)));
  if (!cond) out.沒過的.push(name);
}
var sleep = function (ms) { return new Promise(function (r) { w.setTimeout(r, ms); }); };
var q = function (s) { return d.querySelector(s); };
// 虛擬時間下「睡 500ms」不代表別人的 1100ms 佇列已經跑完 —— 地圖在許願模式要
// 把六天的行程都解析一遍。所以等的是條件,不是時間。
async function until(fn, tries) {
  for (var i = 0; i < (tries || 120); i++) { if (fn()) return true; await sleep(50); }
  return false;
}

// flash() 2.8 秒就被 renderSync 蓋掉,而虛擬時間跑得比我讀得快。
// 所以用 MutationObserver 把 #sync 每一次的值都留下來,事後再比對。
var flashes = [];
new w.MutationObserver(function () { flashes.push(q("#sync").textContent); })
  .observe(q("#sync"), { childList: true, characterData: true, subtree: true });
function flashed(re) { return flashes.some(function (t) { return re.test(t); }); }

// ---- fetch 樁。只接手 resource=geocode,其餘原樣轉交。 ----
var realFetch = w.fetch.bind(w);
var reply = null, asked = [], osm = [];
w.fetch = function (url, init) {
  // 順便把平常那家線上查詢也擋掉並記下來:這一支不該依賴網路,
  // 而「有沒有人在沒按按鈕的情況下發查詢」本身就是要看的事。
  if (/nominatim/.test(String(url))) {
    osm.push(String(url));
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve([]); } });
  }
  if (String(url).indexOf("resource=geocode") < 0) return realFetch(url, init);
  asked.push(String(url));
  var r = reply;
  return Promise.resolve({
    ok: r.ok !== false,
    status: r.ok === false ? (r.status || 502) : 200,
    json: function () { return Promise.resolve(r.body); },
  });
};

function pins() { return JSON.parse(w.localStorage.getItem("tokyo5-pin3") || "{}"); }
function bar() { return q("#map-fix"); }
function barText() { return q("#map-fix-t").textContent; }
function approxPins() {
  return [].map.call(d.querySelectorAll(".map .pin.approx"), function (p) {
    return { 編號: p.textContent.replace(/約.*/, "").trim(), 標籤: (p.querySelector(".lab") || {}).textContent };
  });
}

(async function () {
  try {
    // 1 ---- 預設:沒點過任何一列,那一條不存在於畫面上 ----
    ok("#map-fix 在 markup 裡", !!bar(), null);
    ok("一開始是 hidden", bar().hidden === true, bar().outerHTML.slice(0, 120));
    ok("前端讀不到 GEOCODE_KEY 這個名字",
      d.documentElement.outerHTML.indexOf("GEOCODE_KEY") < 0, "index.html 裡出現了金鑰的環境變數名");

    // 2 ---- 從 DAY 那顆按鈕開地圖 = 06 那張截圖的狀態 ----
    q("#day-map-btn").click();
    await until(function () { return d.querySelectorAll(".map .pin").length >= 3; });
    ok("只開地圖(= 06 / 07 的狀態)時仍然 hidden", bar().hidden === true, barText());
    /* 3 顆而不是 5 顆:合羽橋道具街(行程,沒填地點)和 teamLab(願望,沒填地點)
       以前是**拿標題去查**才有 pin 的,規則一之後它們不該再出現。 */
    ok("地圖有畫出 pin(確認這一輪真的跑起來了)", d.querySelectorAll(".map .pin").length >= 3,
      d.querySelectorAll(".map .pin").length);
    var labs = [].map.call(d.querySelectorAll(".map .pin .lab"), function (e) { return e.textContent; });
    ok("沒填地點的沒有被標上去(合羽橋道具街)",
      !labs.some(function (t) { return /合羽橋/.test(t); }), labs);
    ok("沒填地點的沒有被標上去(teamLab)",
      !labs.some(function (t) { return /teamLab/.test(t); }), labs);

    // 3 ---- 點一列「有標上去」的 ----
    var rows = [].slice.call(d.querySelectorAll("#route .stop"));
    var row = rows.filter(function (r) { return /淺草寺/.test(r.textContent); })[0];
    ok("找得到淺草寺那一列", !!row, rows.map(function (r) { return r.textContent.slice(0, 12); }));
    row.click();
    ok("點過一列之後那一條出現", await until(function () { return bar().hidden === false; }),
      bar().outerHTML.slice(0, 160));
    ok("文案問的是「不在這裡?」", /淺草寺.*不在這裡/.test(barText()), barText());
    ok("文案沒有服務商的名字", !/[Gg]oogle/.test(bar().textContent), bar().textContent);

    // 4 ---- 再查一次,回「概略」 ----
    var was = pins()["淺草寺"];
    reply = { body: { found: true, la: 35.6764, lo: 139.65, precision: "area", label: "日本東京都" } };
    q("#map-fix-go").click();
    await until(function () { return (pins()["淺草寺"] || {}).la === 35.6764; });
    var now = pins()["淺草寺"];
    ok("查詢真的送出去了", asked.length === 1, asked);
    ok("送出去的是那個地名", /q=%E6%B7%BA%E8%8D%89%E5%AF%BA/.test(asked[0]), asked[0]);
    ok("送出去的帶了國家代碼", /cc=jp/.test(asked[0]), asked[0]);
    ok("快取蓋掉舊的(同一個 key、同一份 tokyo5-pin3)",
      !!now && now.la === 35.6764 && now.lo === 139.65 && was && was.la !== now.la, { 舊: was, 新: now });
    ok("概略的那一筆帶 ap 記號", now.ap === 1, now);
    ok("flash 講了「大概的範圍」", flashed(/只查到大概的範圍/), flashes);
    ok("flash 沒有服務商的名字", !flashes.some(function (t) { return /[Gg]oogle/.test(t); }), flashes);
    var ap = approxPins();
    ok("地圖上那顆 pin 畫成 approx", ap.length === 1, ap);
    ok("標籤前面加了「約 」", ap.length === 1 && /^約 /.test(ap[0].標籤 || ""), ap);
    ok("虛線圈真的生效(border-style)",
      w.getComputedStyle(q(".map .pin.approx")).borderTopStyle === "dashed",
      w.getComputedStyle(q(".map .pin.approx")).borderTopStyle);
    ok("行程那條路送出去的 URL 不帶 wish=", asked[0].indexOf("wish=") < 0, asked[0]);

    // 4b ---- 概略之後,那一條要改問「這個位置對嗎」,並且長出「對」 ----
    ok("概略之後改問「這個位置對嗎」", /淺草寺.*這個位置對嗎/.test(barText()), barText());
    ok("「對」出現了", q("#map-fix-ok").hidden === false, q("#map-fix-ok").outerHTML);
    ok("「再查一次」仍然在(「不對」就是再按一次它)", q("#map-fix-go").hidden === false, null);

    // 4c ---- 按「對」:變實線、不再問,而且**不打任何網路** ----
    var netBefore = asked.length + osm.length;
    flashes.length = 0;
    q("#map-fix-ok").click();
    ok("按「對」之後虛線圈不見了(變實線)",
      await until(function () { return d.querySelectorAll(".map .pin.approx").length === 0; }),
      d.querySelectorAll(".map .pin.approx").length);
    ok("按「對」沒有發出任何請求(它不花錢,所以也不需要通行碼)",
      asked.length + osm.length === netBefore, { 之前: netBefore, 之後: asked.length + osm.length });
    ok("確認記在同一份 tokyo5-pin3 的同一筆上(ok:1)", pins()["淺草寺"].ok === 1, pins()["淺草寺"]);
    ok("概略這件事本身沒有被抹掉(ap 還在)", pins()["淺草寺"].ap === 1, pins()["淺草寺"]);
    ok("確認過的 pin 是實線",
      w.getComputedStyle(d.querySelector('.map .pin[data-k="d0"]')).borderTopStyle === "solid",
      w.getComputedStyle(d.querySelector('.map .pin[data-k="d0"]')).borderTopStyle);
    ok("「約 」留著(座標仍然是那一區的中心,人只能說「我接受」)",
      /^約 /.test(d.querySelector('.map .pin[data-k="d0"] .lab').textContent),
      d.querySelector('.map .pin[data-k="d0"] .lab').textContent);
    /* 地圖是在 loadSheetMap 裡重畫的,那一條是**之後**才重畫的 ——
       等虛線圈消失就去問那一條,會早一步(這兩條第一次跑就是這樣紅的)。 */
    ok("那一條不再問了",
      await until(function () { return /淺草寺.*不在這裡/.test(barText()); }), barText());
    ok("「對」收回去了", q("#map-fix-ok").hidden === true, null);

    // 4d ---- 確認過的再按一次「再查一次」:同一個座標 → 確認留著,不重問 ----
    asked.length = 0; flashes.length = 0;
    reply = { body: { found: true, la: 35.6764, lo: 139.65, precision: "area", label: "日本東京都" } };
    q("#map-fix-go").click();
    ok("再查一次照樣送得出去", await until(function () { return asked.length === 1; }), asked);
    ok("查回同一個座標 → flash 說還是同一個位置",
      await until(function () { return flashed(/還是同一個位置/); }), flashes);
    ok("查回同一個座標 → 那個「對」留著(不再問第二次)", pins()["淺草寺"].ok === 1, pins()["淺草寺"]);
    ok("查回同一個座標 → 仍然是實線", d.querySelectorAll(".map .pin.approx").length === 0, null);
    ok("查回同一個座標 → 那一條沒有變回「對嗎」", !/對嗎/.test(barText()), barText());

    // 4e ---- 再查一次,這次回到**別的**概略位置 → 虛線圈回來、重新問 ----
    flashes.length = 0;
    reply = { body: { found: true, la: 35.70, lo: 139.70, precision: "area", label: "日本東京都" } };
    q("#map-fix-go").click();
    ok("換了座標 → 虛線圈回來",
      await until(function () { return d.querySelectorAll(".map .pin.approx").length === 1; }),
      pins()["淺草寺"]);
    ok("換了座標 → 那個「對」不跟著走(它講的是那個座標,不是那個名字)",
      pins()["淺草寺"].ok === undefined, pins()["淺草寺"]);
    ok("換了座標 → 又問一次「這個位置對嗎」", /對嗎/.test(barText()), barText());

    // 4f ---- 沒填地點的那一筆:不查、不畫按鈕、講清楚為什麼不在地圖上 ----
    asked.length = 0;
    var kappa = rows.filter(function (r) { return /合羽橋/.test(r.textContent); })[0];
    ok("找得到合羽橋那一列", !!kappa, null);
    kappa.click();
    ok("沒填地點 → 那一條講的是「沒填地點,不會出現在地圖上」",
      await until(function () { return /合羽橋.*沒填地點/.test(barText()); }), barText());
    ok("沒填地點 → 不畫「再查一次」(按了也只是再問一次同一個錯問題,而且要錢)",
      q("#map-fix-go").hidden === true, q("#map-fix-go").outerHTML);
    ok("沒填地點 → 也不畫「對」", q("#map-fix-ok").hidden === true, null);
    q("#map-fix-go").click();          /* 直接戳 DOM 也不該送出去 */
    await sleep(100);
    ok("沒填地點 → 就算硬按也不發查詢", asked.length === 0, asked);

    // 5 ---- 願望那條路:查無,以及送出去的 URL 要帶 wish= ----
    /* 泡溫泉(w3)以前是這一段的主角,現在它沒填地點,連查都不會查 —— 上面 4f 測的是
       那條路。查無這條要用**有填地點**的那一筆:w2「橫濱 港灣未來」,地點欄是「港灣未來」。
       它也剛好是 fixture 裡 tokyo5-me(hsieh_chinhui)自己許的那一個。 */
    flashes.length = 0; asked.length = 0;
    var wish = [].slice.call(d.querySelectorAll("#wish-list [data-wish]"))
      .filter(function (r) { return /港灣未來/.test(r.textContent); })[0];
    ok("找得到港灣未來那一列", !!wish, null);
    wish.click();
    ok("有標上去的願望問的是「不在這裡?」",
      await until(function () { return /港灣未來.*不在這裡/.test(barText()); }), barText());
    var nWish = d.querySelectorAll(".map .pin").length;
    reply = { body: { found: false } };
    q("#map-fix-go").click();
    ok("查無 → 誠實說還是找不到", await until(function () { return flashed(/還是找不到/); }), flashes);
    ok("查無 → 不假裝有結果(那一筆變成 null)", pins()["港灣未來"] === null, pins()["港灣未來"]);
    ok("查無 → 地圖上少一顆(不留下一個兩邊都不相信的座標)",
      d.querySelectorAll(".map .pin").length === nWish - 1,
      { 之前: nWish, 之後: d.querySelectorAll(".map .pin").length });
    /* 願望那條路要帶 wish=:沒有通行碼的人只走得通「重查自己那筆願望的地點」,
       而伺服器核對的是**被問的是什麼**(那一筆的地點欄),不是誰在問。 */
    ok("願望那條路送出去的 URL 帶了 wish=", /[?&]wish=w2(&|$)/.test(asked[0] || ""), asked[0]);
    ok("送出去的還是地點欄那個字串,不是標題",
      /q=%E6%B8%AF%E7%81%A3%E6%9C%AA%E4%BE%86/.test(asked[0] || ""), asked[0]);

    // 6 ---- 退路整個不能用時,不可以把本來好好的座標弄丟 ----
    flashes.length = 0;
    var keep = JSON.stringify(pins()["築地市場"]);
    var trow = rows.filter(function (r) { return /築地/.test(r.textContent); })[0];
    trow.click();
    await until(function () { return /築地/.test(barText()); });
    reply = { ok: false, status: 503, body: { error: "伺服器還沒設定 GEOCODE_KEY,再查一次目前不能用" } };
    q("#map-fix-go").click();
    ok("失敗時 flash 講得出原因", await until(function () { return flashed(/再查一次沒成功/); }), flashes);
    ok("失敗時舊座標原封不動", JSON.stringify(pins()["築地市場"]) === keep,
      { 原本: keep, 現在: pins()["築地市場"] });
    ok("失敗之後按鈕還能再按", q("#map-fix-go").disabled === false, null);

    // 7 ---- 收起來就不見 ----
    q("#map-sheet-x").click();
    await sleep(100);
    ok("收起地圖之後那一條回到 hidden", bar().hidden === true, null);
    q("#day-map-btn").click();
    await until(function () { return d.querySelectorAll(".map .pin").length >= 4; });
    ok("重新從按鈕打開,仍然 hidden(06 的狀態守住了)", bar().hidden === true, null);
    out.線上查詢被問了幾次 = osm.length;

    // 8 ---- 走鐘防護:新的 class 有沒有對應的 CSS 規則 ----
    var known = {};
    [].forEach.call(d.styleSheets, function (ss) {
      var rules; try { rules = ss.cssRules; } catch (e) { return; }
      (function walk(list) {
        [].forEach.call(list, function (r) {
          if (r.selectorText) {
            (r.selectorText.match(/\.-?[A-Za-z_][A-Za-z0-9_-]*/g) || [])
              .forEach(function (s) { known[s.slice(1)] = 1; });
          }
          if (r.cssRules) walk(r.cssRules);
        });
      })(rules);
    });
    ok("mapfix 有 CSS 規則(不然走鐘防護會叫)", known.mapfix === 1, null);
    ok("mf-t 有 CSS 規則", known["mf-t"] === 1, null);
    ok("approx 有 CSS 規則", known.approx === 1, null);

    // 9 ---- 規則一的總對帳:沒填地點的那三筆,從頭到尾一次查詢都沒發出去 ----
    /* 「沒發生」也要有證據。這裡看的是整趟跑下來所有送出去的 URL ——
       Nominatim 那家(osm)和退路那家(asked)都算。 */
    var all = osm.concat(asked).join(" ");
    ["合羽橋", "teamLab", "%E6%B3%A1%E6%BA%AB%E6%B3%89", "泡溫泉"].forEach(function (k) {
      ok("整趟沒有任何查詢問過「" + k + "」(它們都沒填地點)", all.indexOf(k) < 0, all.slice(0, 400));
    });
    out.線上查詢的完整清單 = osm;

    // 10 ---- 規則二:送出的當下就講「沒填地點 → 不會上地圖」 ----
    /* 這是規則一製造出來的那個新的無聲狀態的解藥:東西存進去了、地圖上沒有它,
       而「我沒填」「還在查」「壞了」三種長得一模一樣。**送出的當下是唯一
       他還能馬上處理的時機。** 講完不擋送出 —— 那一筆照樣要存下去。 */
    var netBefore2 = asked.length + osm.length;
    var nWishBefore = d.querySelectorAll("#wish-list [data-wish]").length;
    flashes.length = 0;
    q("#add-wish-btn").click();
    q("#wf-title").value = "多喝水";
    q("#wf-place").value = "";
    q("#wf-by").value = "hsieh_chinhui";
    q("#wf-submit").click();
    ok("許願沒填地點 → 講的是「不會出現在地圖上」和「補上地點就會」",
      await until(function () { return flashed(/沒填地點.*地圖上不會有它.*補上地點/); }), flashes);
    ok("許願沒填地點 → 照樣存下去(這是告知不是驗證)",
      d.querySelectorAll("#wish-list [data-wish]").length === nWishBefore + 1,
      { 之前: nWishBefore, 之後: d.querySelectorAll("#wish-list [data-wish]").length });
    ok("許願沒填地點 → 一次查詢都沒發",
      asked.length + osm.length === netBefore2, { 之前: netBefore2, 之後: asked.length + osm.length });

    flashes.length = 0;
    var nStopBefore = d.querySelectorAll("#route .stop").length;
    q("#add-stop-btn").click();
    q("#sf-time").value = "16:00";
    q("#sf-title").value = "早點睡";
    q("#sf-place").value = "";
    q("#stop-form button[type=submit]").click();
    ok("加行程沒填地點 → 同一句話(同一個 checkPlace,不是第二套機制)",
      await until(function () { return flashed(/早點睡.*沒填地點/); }), flashes);
    ok("加行程沒填地點 → 照樣存下去",
      d.querySelectorAll("#route .stop").length === nStopBefore + 1,
      { 之前: nStopBefore, 之後: d.querySelectorAll("#route .stop").length });
    ok("加行程沒填地點 → 一次查詢都沒發",
      asked.length + osm.length === netBefore2, { 之前: netBefore2, 之後: asked.length + osm.length });
  } catch (e) {
    out.爆掉了 = String((e && e.stack) || e);
  }
  out.結論 = out.沒過的.length ? out.沒過的.length + " 項沒過" : "全部通過";
  document.getElementById("r").textContent = JSON.stringify(out, null, 2);
})();

return { 說明: "非同步,真正的結果會晚一點蓋掉這一段" };
