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
// Nominatim 那家預設回「查無」。osmReply 可以改成一筆結果 —— 有些段落要先讓
// 某一筆**真的有 pin**,才測得到「再查一次之後它不見了」。
var osmReply = [];
w.fetch = function (url, init) {
  // 順便把平常那家線上查詢也擋掉並記下來:這一支不該依賴網路,
  // 而「有沒有人在沒按按鈕的情況下發查詢」本身就是要看的事。
  if (/nominatim/.test(String(url))) {
    osm.push(String(url));
    var rr = osmReply;
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve(rr); } });
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

    // 5 ---- 地點欄答得出來的時候,標題那一步不生效 ----
    /* w2 的標題是「橫濱 港灣未來」,而「橫濱」就寫在 OUTSIDE 那張人工表裡。
       地點欄(「港灣未來」)在快取裡有答案,所以**輪不到標題** —— 這是這一輪
       「標題排在地點欄之後」那個順序的機器版證據。順序倒過來的話,這一顆會從
       快取的 35.4437,139.6380 跳到表裡的 35.444,139.638(差 33 公尺),
       06 / 07 兩張會多出一個沒有人登記的差異。 */
    flashes.length = 0; asked.length = 0;
    var wish = [].slice.call(d.querySelectorAll("#wish-list [data-wish]"))
      .filter(function (r) { return /港灣未來/.test(r.textContent); })[0];
    ok("找得到港灣未來那一列", !!wish, null);
    wish.click();
    ok("有標上去的願望問的是「不在這裡?」",
      await until(function () { return /港灣未來.*不在這裡/.test(barText()); }), barText());
    ok("地點欄答得出來 → 標題那一步不生效(標題含「橫濱」,人工表裡有,但沒有被用)",
      !/人工確認過/.test(barText()), barText());
    ok("地點欄答得出來 → 快取那一筆原封不動(沒有被人工表蓋掉)",
      JSON.stringify(pins()["港灣未來"]) === JSON.stringify({ la: 35.4437, lo: 139.638 }),
      pins()["港灣未來"]);

    // 5b ---- 「再查一次」要先查人工表:命中就直接用,一次 API 都不打 ----
    /* 這是 Lulu 那台裝置上的復原路徑。地點欄那一格裡如果躺著一個線上查來的錯座標,
       而標題在人工表裡 —— 以前按「再查一次」只會用**另一個**線上結果蓋掉它,
       錯得更確定;現在按下去會在表裡命中,直接換成人工驗過的那一個,而且不花錢。 */
    var netB5 = asked.length + osm.length;
    flashes.length = 0;
    q("#map-fix-go").click();
    ok("人工表命中 → flash 說用的是人工確認過的座標",
      await until(function () { return flashed(/人工確認過的座標/); }), flashes);
    ok("人工表命中 → 一次 API 都沒打(它不花錢,而且比線上準)",
      asked.length + osm.length === netB5, { 之前: netB5, 之後: asked.length + osm.length });
    ok("人工表命中 → 地點欄那一格被清掉,讓標題那一步接手",
      pins()["港灣未來"] === null, pins()["港灣未來"]);
    ok("人工表命中 → 那一顆 pin 沒有消失(換成表裡的座標)",
      await until(function () { return /橫濱 港灣未來.*人工確認過的座標/.test(barText()); }), barText());
    ok("人工表命中 → 「再查一次」收起來(表就是答案,再查只會拿比較差的來蓋)",
      q("#map-fix-go").hidden === true, q("#map-fix-go").outerHTML);

    // 5c ---- 查無:誠實說,而且不留下一個兩邊都不相信的座標 ----
    /* 以前這一段用 w2,現在不能用了(5b 那條路把它接走)。改用一筆現造的願望:
       標題和地點欄都不含人工表裡的任何關鍵字,所以它走的是純粹的線上那條路。 */
    flashes.length = 0; asked.length = 0;
    osmReply = [{ lat: "35.6812", lon: "139.7671" }];   /* 先讓它有一顆 pin */
    q("#add-wish-btn").click();
    q("#wf-title").value = "看夜景";
    q("#wf-place").value = "某某展望台";
    q("#wf-by").value = "hsieh_chinhui";
    q("#wf-submit").click();
    await until(function () {
      return [].slice.call(d.querySelectorAll("#wish-list [data-wish]"))
        .some(function (r) { return /看夜景/.test(r.textContent); });
    });
    ok("查得到的地點 → 送出時一句話都不講(不吵)",
      q("#wish-msg").hidden === true, q("#wish-msg").outerHTML);
    var night = [].slice.call(d.querySelectorAll("#wish-list [data-wish]"))
      .filter(function (r) { return /看夜景/.test(r.textContent); })[0];
    ok("找得到看夜景那一列", !!night, null);
    night.click();
    ok("有標上去的願望問的是「不在這裡?」",
      await until(function () { return /某某展望台.*不在這裡/.test(barText()); }), barText());
    var nWish = d.querySelectorAll(".map .pin").length;
    asked.length = 0; flashes.length = 0;
    reply = { body: { found: false } };
    q("#map-fix-go").click();
    ok("查無 → 誠實說還是找不到", await until(function () { return flashed(/還是找不到/); }), flashes);
    ok("查無 → 不假裝有結果(那一筆變成 null)", pins()["某某展望台"] === null, pins()["某某展望台"]);
    ok("查無 → 地圖上少一顆(不留下一個兩邊都不相信的座標)",
      await until(function () { return d.querySelectorAll(".map .pin").length === nWish - 1; }),
      { 之前: nWish, 之後: d.querySelectorAll(".map .pin").length });
    /* 願望那條路要帶 wish=:沒有通行碼的人只走得通「重查自己那筆願望的地點」,
       而伺服器核對的是**被問的是什麼**(那一筆的地點欄),不是誰在問。 */
    ok("願望那條路送出去的 URL 帶了 wish=", /[?&]wish=/.test(asked[0] || ""), asked[0]);
    ok("送出去的還是地點欄那個字串,不是標題",
      /q=%E6%9F%90%E6%9F%90%E5%B1%95%E6%9C%9B%E5%8F%B0/.test(asked[0] || ""), asked[0]);
    osmReply = [];

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
    /* 送出當下那句話用的是站上現成的 .note(分帳那條「還沒指定付款人」同一個),
       所以這一輪**沒有新的 class** —— 走鐘防護不該有話說。 */
    ok("note 有 CSS 規則(送出當下那句話用的就是它,沒有新 class)", known.note === 1, null);

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
    /* **話改講在許願表單那一槽上,不在頁尾的 #sync。** 上一輪這裡看的是 flashes ——
       而那正是問題二:訊息真的有發,只是發在頁面最底下 10.5px 的小字上,
       使用者在表單上按送出,眼睛在表單。位置的部分量在第 12 段。 */
    ok("許願沒填地點 → 講的是「不會出現在地圖上」和「補上地點就會」",
      await until(function () { return /沒填地點.*地圖上不會有它.*補上地點/.test(q("#wish-msg").textContent); }),
      { 槽: q("#wish-msg").textContent, 頁尾: flashes });
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
      await until(function () { return /早點睡.*沒填地點/.test(q("#stop-msg").textContent); }),
      { 槽: q("#stop-msg").textContent, 頁尾: flashes });
    ok("加行程沒填地點 → 照樣存下去",
      d.querySelectorAll("#route .stop").length === nStopBefore + 1,
      { 之前: nStopBefore, 之後: d.querySelectorAll("#route .stop").length });
    ok("加行程沒填地點 → 一次查詢都沒發",
      asked.length + osm.length === netBefore2, { 之前: netBefore2, 之後: asked.length + osm.length });

    // 11 ---- 問題一:人工表被規則一連帶砍掉的那一筆 ----
    /* ANCHORS["2026-10-03"][0] =
         { title: "桃園機場 第一航廈 報到", place: "樂桃 MM626 · 建議起飛前 2.5 小時" }
       地點欄裡填的是航班備註,而「桃園」寫在標題裡,OUTSIDE 表裡也有。
       規則一把標題從候選裡拿掉的時候,**連帶讓這張表也比對不到** ——
       於是它掉到線上查詢,拿一句航班備註去問,而「再查一次」那條路根本沒查表。 */
    asked.length = 0;
    var osmBefore = osm.length;
    d.querySelector('#days [data-day="2026-10-03"]').click();
    await until(function () {
      return [].slice.call(d.querySelectorAll("#route .stop"))
        .some(function (r) { return /桃園機場 第一航廈 報到/.test(r.textContent); });
    });
    var tpe = [].slice.call(d.querySelectorAll("#route .stop"))
      .filter(function (r) { return /桃園機場 第一航廈 報到/.test(r.textContent); })[0];
    ok("找得到桃園機場報到那一列", !!tpe, null);
    tpe.click();
    ok("人工表接回來了:那一條講的是「在人工確認過的表裡」",
      await until(function () { return /人工確認過的表裡/.test(barText()); }), barText());
    /* 協調者預期「桃園那顆 pin 回來」——**它不會回來,而且不該回來。**
       inJapan() 刻意擋掉 la ≤ 30(桃園是 25.080):一張圖同時要裝下台灣和成田,
       就得縮到看得見鹿兒島。所以回來的是**座標和說法**,不是 pin。 */
    ok("而且說得出為什麼它還是不在圖上(不在日本境內)", /不在日本境內/.test(barText()), barText());
    ok("那一條印的是標題那幾個字,不是地點欄那句航班備註",
      /桃園機場 第一航廈 報到/.test(barText()) && !/MM626/.test(barText()), barText());
    ok("人工表就是答案 → 不畫「再查一次」", q("#map-fix-go").hidden === true, q("#map-fix-go").outerHTML);
    ok("也不畫「對」", q("#map-fix-ok").hidden === true, null);
    q("#map-fix-go").click();          /* 硬戳 DOM 也不該送出去 */
    await sleep(100);
    ok("就算硬按也不發查詢", asked.length === 0, asked);
    ok("整段沒有多發任何一次線上查詢(以前這一筆每次開地圖就是兩次)",
      osm.length === osmBefore, osm.slice(osmBefore));
    /* 「沒發生」要有證據:整趟跑下來所有送出去的 URL 都不可以出現這幾個字。
       改之前實測是兩次 —— `樂桃 MM626` 和(拆掉前綴之後的)`MM626 建議起飛前 2.5 小時`。 */
    var all2 = osm.concat(asked).join(" ");
    ["樂桃", "%E6%A8%82%E6%A1%83", "MM626", "%E5%BB%BA%E8%AD%B0%E8%B5%B7%E9%A3%9B"].forEach(function (k) {
      ok("整趟沒有任何查詢問過「" + k + "」(那是航班備註,不是地名)", all2.indexOf(k) < 0, all2.slice(0, 500));
    });
    /* 同一天的另外兩筆航班,地點欄本身就命中表(TPE 桃園 T1 / NRT 成田 T1)——
       它們從頭到尾沒壞過,這裡順便確認這一輪沒有把它們弄壞。 */
    var nrt = [].slice.call(d.querySelectorAll("#route .stop"))
      .filter(function (r) { return /抵達成田機場/.test(r.textContent); })[0];
    nrt.click();
    ok("地點欄本身命中表的那幾筆沒有被弄壞(成田照樣標得出來)",
      await until(function () { return /不在這裡/.test(barText()); }), barText());
    ok("成田那一筆的「再查一次」照樣畫得出來(它有 pin,使用者說不對還是能按)",
      q("#map-fix-go").hidden === false, null);

    // 12 ---- 問題二:那句話講在使用者眼睛所在的地方 ----
    /* 上一輪那三句走的是 flash() → <footer> 裡的 #sync,10.5px 的小字。
       **程式是對的,訊息真的有發** —— 發在頁面最底下,而使用者的眼睛在表單上。
       這一段量的就是「它現在出現在哪裡」,而不只是「它有沒有出現」。 */
    d.querySelector('#days [data-day="2026-10-05"]').click();
    await sleep(100);
    ok("預設兩個訊息槽都是 hidden(這就是十一張截圖零差異的機制)",
      q("#stop-msg").hidden === true && q("#wish-msg").hidden === true,
      { stop: q("#stop-msg").outerHTML, wish: q("#wish-msg").outerHTML });

    /* 許願那一整塊住在 <details class="wishbox"> 裡,而它預設是收起來的。
       收起來的時候 Chrome 用 ::details-content 的 content-visibility:hidden ——
       **裡面的元素照樣量得到一個 rect**,只是那個 rect 跟使用者看到的東西無關。
       量位置之前一定要先打開它(05 那張截圖也是這樣打開的)。 */
    q("#wishbox").open = true;
    await sleep(50);
    flashes.length = 0;
    q("#add-wish-btn").click();
    q("#wf-title").value = "早點睡";
    q("#wf-place").value = "";
    q("#wf-by").value = "hsieh_chinhui";
    /* **要量的是「使用者的眼睛在哪」,而那是表單所在的位置,要在按下去之前量。**
       兩個踩過的坑都在這三行裡:
         1. 表單送出就 hidden,而 display:none 的元素 rect 全是 0 ——
            拿送出鈕在送出**之後**量,得到的是從 0 算起的乾淨假數字(840 / 884)。
         2. 改成「送出前量按鈕、送出後量訊息」也不對:表單一收,底下整片往上移
            約一個表單的高度,那個差被算進「距離」裡,結果是 361 vs 317 ——
            **看起來像訊息比頁尾還遠**。兩個位置不在同一個版面上就不能相減。
       所以錨點取表單的上緣(使用者視線落點,送出前量),另外兩個點在同一個
       版面上(送出後)一起量。 */
    var eyeY = q("#wish-form").getBoundingClientRect().top;
    var footA = q("#sync").getBoundingClientRect().top;   /* 按下去的那一刻,頁尾在哪 */
    q("#wf-submit").click();
    ok("許願沒填地點 → 話講在許願表單那一槽上",
      await until(function () { return q("#wish-msg").hidden === false; }), q("#wish-msg").outerHTML);
    ok("而且文案沒變(還是「不會有它」+「補上地點就會」)",
      /沒填地點.*地圖上不會有它.*補上地點/.test(q("#wish-msg").textContent), q("#wish-msg").textContent);
    ok("**不再寫到頁尾那行小字** —— 同一句話只有一個出口",
      !flashed(/沒填地點/), flashes);
    ok("用的是站上現成的 .note,沒有長出第三套提示機制",
      !!q("#wish-msg .note"), q("#wish-msg").innerHTML);
    /* 「講在眼睛所在的地方」是可以量的:比一比那句話離送出鈕多遠、離頁尾那行多遠。 */
    var hereY = q("#wish-msg").getBoundingClientRect().top;
    /* 頁尾那個距離用**按下去那一刻**的版面(footA):問的是「他按送出的時候,
       #sync 離他的視線有多遠」。拿送出後的版面去量會把表單收起來的位移算進去,
       那正是上面註解裡第 2 個坑。 */
    out.視線落點到訊息的距離 = Math.round(Math.abs(hereY - eyeY));
    out.按下去那一刻視線落點到頁尾sync的距離 = Math.round(Math.abs(footA - eyeY));
    ok("那句話落在使用者的視線落點上,而頁尾在幾百像素之外",
      Math.abs(hereY - eyeY) * 3 < Math.abs(footA - eyeY),
      { 到訊息: Math.round(Math.abs(hereY - eyeY)), 到頁尾: Math.round(Math.abs(footA - eyeY)) });
    out.訊息的樣子 = (function () {
      var n = q("#wish-msg .note"), cs = w.getComputedStyle(n);
      return { 字級: cs.fontSize, 前景: cs.color, 背景: cs.backgroundColor,
               圓角: cs.borderRadius, 內距: cs.padding, 寬: Math.round(n.getBoundingClientRect().width),
               高: Math.round(n.getBoundingClientRect().height), 文字: n.textContent };
    })();
    ok("它在 DOM 上的位置是「表單和清單之間」",
      q("#wish-form").nextElementSibling === q("#wish-msg") &&
      q("#wish-msg").nextElementSibling === q("#wish-list"), null);

    // 12b ---- 加行程那一槽,以及「查不到」「不在日本境內」兩句 ----
    flashes.length = 0;
    q("#add-stop-btn").click();
    q("#sf-time").value = "17:00";
    q("#sf-title").value = "多喝水";
    q("#sf-place").value = "";
    q("#stop-form button[type=submit]").click();
    ok("加行程沒填地點 → 話講在行程表單那一槽上",
      await until(function () { return q("#stop-msg").hidden === false; }), q("#stop-msg").outerHTML);
    ok("加行程那一句也不再寫到頁尾", !flashed(/沒填地點/), flashes);
    ok("它在 DOM 上的位置是「表單和行程列表之間」",
      q("#stop-form").nextElementSibling === q("#stop-msg") &&
      q("#stop-msg").nextElementSibling === q("#route"), null);

    /* 「查不到」也是送出當下要讀到的 —— 協調者要我順便判斷,答案是一樣的。 */
    osmReply = [];
    flashes.length = 0;
    q("#add-stop-btn").click();
    ok("再打開表單 → 上一句話收掉了(不留成背景)", q("#stop-msg").hidden === true, q("#stop-msg").outerHTML);
    q("#sf-time").value = "18:00";
    q("#sf-title").value = "找一家店";
    q("#sf-place").value = "查不到的那種地方";
    q("#stop-form button[type=submit]").click();
    ok("「查不到」也講在槽上,不講在頁尾",
      await until(function () { return q("#stop-msg").hidden === false && /查不到/.test(q("#stop-msg").textContent); }),
      q("#stop-msg").textContent);
    ok("「查不到」那句沒有同時寫到頁尾", !flashed(/查不到/), flashes);

    /* 「不在日本境內」:地點欄填 TPE 桃園 T1,人工表直接命中,一次查詢都不發。 */
    flashes.length = 0;
    var netB12 = asked.length + osm.length;
    q("#add-stop-btn").click();
    q("#sf-time").value = "19:00";
    q("#sf-title").value = "回程報到";
    q("#sf-place").value = "TPE 桃園 T1";
    q("#stop-form button[type=submit]").click();
    ok("「不在日本境內」也講在槽上",
      await until(function () { return /不在日本境內/.test(q("#stop-msg").textContent); }),
      q("#stop-msg").textContent);
    ok("「不在日本境內」那句沒有同時寫到頁尾", !flashed(/不在日本境內/), flashes);
    ok("而且它是人工表答的 —— 一次查詢都沒發",
      asked.length + osm.length === netB12, { 之前: netB12, 之後: asked.length + osm.length });

    // 12c ---- 換一天就收掉 ----
    d.querySelector('#days [data-day="2026-10-06"]').click();
    await sleep(100);
    ok("換一天 → 兩槽都收掉(那句話講的是剛才那一筆,換了一天就沒有對象了)",
      q("#stop-msg").hidden === true && q("#wish-msg").hidden === true, null);

    // 13 ---- flash() 的總數要變少,不是變多 ----
    /* 「不要長第三套」這句話是可以查的:改完之後 index.html 裡 `flash("` 的數量
       應該**比上一輪少**(那三句搬走了),而不是多出一套。 */
    out.flash字面數 = (d.documentElement.outerHTML.match(/flash\("/g) || []).length;
    ok("flash() 的字面數變少了(那三句搬走,沒有多出一套)",
      out.flash字面數 <= 30, out.flash字面數);
    out.sayHere字面數 = (d.documentElement.outerHTML.match(/sayHere\(/g) || []).length;
  } catch (e) {
    out.爆掉了 = String((e && e.stack) || e);
  }
  out.結論 = out.沒過的.length ? out.沒過的.length + " 項沒過" : "全部通過";
  document.getElementById("r").textContent = JSON.stringify(out, null, 2);
})();

return { 說明: "非同步,真正的結果會晚一點蓋掉這一段" };
