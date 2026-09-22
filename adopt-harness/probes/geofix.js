// 地點怎麼標上去、沒標上去的時候怎麼講,在真實 DOM 上跑一遍。
//
// **這一支本來叫「『再查一次』那條退路的前端行為」,而那條退路整條退場了**
// (mapfix-retire,2026-09-22:地圖上方那句小字 + 「對」/「再查一次」兩顆鈕)。
// 退場的理由是前提消失了 —— `merge-place-field` 之後座標是人從候選清單親手挑的,
// 對一個親手挑的點問「不在這裡?」,問的是一個他剛剛才回答完的問題。
//
// 所以這一支**退掉了 3–7 段、11/11b 的說明斷言、14b/14c/14d**,整整少了 243 行。
// 每一處都留著墓碑註解寫清楚「原本量的是什麼、為什麼沒有對象了、什麼東西
// 因此沒有人在守」—— 退場不該讓證據無聲消失。
//
// 留下來的是跟那條小字無關、而且還活著的那些:
//   - 開場對帳:舊快取裡那些人工表答得出來的 key,一載入就自己修好(1b)
//   - 規則一:沒填地點的那幾筆,**一次查詢都不該發**。這裡把送出去的 URL
//     全部記下來事後對帳 —— 「沒發生」要有證據(2 / 9 / 11 / 11c)
//   - 規則二:送出的當下就講「沒填地點 → 不會上地圖」,而且講在**使用者眼睛
//     所在的那一槽**上,不是頁尾那行 10.5px 的小字(10 / 12 / 12b / 12c / 13)
//   - 唯讀的那三個人:有「改」、沒有「刪掉」、那一排不換行、送出去的形狀對(14)
//
// 它**把 fetch 換成樁**:`?resource=geocode` 和 `/api/notion` 由這裡回答,
// Nominatim 那家也擋下來記帳,其餘原樣放行。
//
// 這一支是非同步的(要點東西、等重畫),所以它自己晚一點覆寫 #r,
// 回傳值只是佔位。probe.sh 的 --virtual-time-budget 撐得住。

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
/* 這三個是「切換成唯讀」那一段用的,預設關著 —— 前面每一段都還是離線模式。 */
var serveNotion = false, notionWrites = [], notionWishes = [];
w.fetch = function (url, init) {
  // 順便把平常那家線上查詢也擋掉並記下來:這一支不該依賴網路,
  // 而「有沒有人在沒按按鈕的情況下發查詢」本身就是要看的事。
  if (/nominatim/.test(String(url))) {
    osm.push(String(url));
    var rr = osmReply;
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve(rr); } });
  }
  /* **「沒有通行碼的人看到什麼」以前這支答不出來。**
     `online` 和 `canEdit` 是那個 IIFE 裡的 `let`,探針碰不到,所以第一直覺是
     「fixture 是離線模式,`editable()` 一律 true,那條路驗不到」——
     **而那句話是錯的,查證之後才知道。** 畫面上有一條真的路可以走到唯讀:
     `#cloud-in`(連上 Notion)→ `goOnline()` → `pull()` 成功 → `online=true`
     而 `canEdit` 仍然 false。所以只要這個樁**把 `/api/notion` 也接起來**,
     探針就能把自己切成那三個人的身分。
     (ADOPTION.md 驗收規則第 5 點:「我驗不到」跟「我預期它會變」一樣是一個斷言,
      一樣要有根據。這一條原本要被寫進「沒有驗到的」,查了才發現不必。) */
  if (serveNotion && /\/api\/notion/.test(String(url))) {
    var m = String(url).match(/resource=([a-z]+)/);
    var kind = m ? m[1] : "";
    var method = (init && init.method) || "GET";
    if (method !== "GET") notionWrites.push({ 方法: method, 網址: String(url), 內容: init && init.body });
    var body;
    if (method === "PATCH") body = { row: JSON.parse((init && init.body) || "{}") };
    else body = { rows: kind === "wishes" ? notionWishes : [] };
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(body); } });
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

/* **兩欄合併之後,要讓一筆資料有 `place`,只剩這一條路:搜尋並挑選。**
   以前這支探針到處在 `#wf-place` / `#sf-place` 上打字 —— 那兩個欄位不存在了,
   而那不是改個 id 就好:**「打字打出一個 place」這件事本身被刪掉了**,
   那正是「只有挑過的才上地圖」那個決定的內容。
   所以這裡把它換成使用者真正會走的那條路,量到的東西因此更接近真的。 */
async function pickPlace(prefix, name, lat, lon) {
  var keep = osmReply;
  osmReply = [{ lat: String(lat), lon: String(lon), display_name: name + ", 東京都, 日本" }];
  q('[data-seek="' + prefix + '-title"]').click();
  await until(function () { return d.querySelectorAll('[data-hit="' + prefix + '-title"]').length > 0; });
  q('[data-hit="' + prefix + '-title"]').click();
  await sleep(50);
  osmReply = keep;
  return name;
}
function pinsOf(k) { return pins()[k]; }
/* `bar()` / `barText()` / `approxPins()` 跟著 `#map-fix` 那一條一起退場了。
   它們讀的是地圖上方那句小字和那兩顆鈕,而那整條在 mapfix-retire 那一輪拆掉了。 */

(async function () {
  try {
    // 1 ---- 那條小字整條退場了,所以先確認它真的不在 ----
    /* 退場的東西要有人守著它別回來 —— 這四個 id 是整條的全部入口。 */
    ["map-fix", "map-fix-t", "map-fix-ok", "map-fix-go"].forEach(function (id) {
      ok("`#" + id + "` 不存在了(那條小字和那兩顆鈕已退場)", !d.getElementById(id), id);
    });
    ok("前端讀不到 GEOCODE_KEY 這個名字",
      d.documentElement.outerHTML.indexOf("GEOCODE_KEY") < 0, "index.html 裡出現了金鑰的環境變數名");

    // 1b ---- 開場對帳:舊快取裡那些表答得出來的 key,一載入就自己修好 ----
    /* fixture 灌的是 Lulu 那台裝置的狀態:`TPE 桃園 T1` 躺著一個線上查來的錯座標
       (東京車站,離桃園 2000 公里),而且沒有 `via`。**沒有這段對帳的話,
       `pinFor()` 開頭那句 `place in pins` 會直接回頭**,錯的值留著,介面也
       因為缺 via 而講不出人工表那句話 —— 使用者要自己去按「再查一次」才會好,
       而程式不會告訴他要按。 */
    ok("舊的錯座標被換成人工表的值(不必按任何按鈕)",
      pins()["TPE 桃園 T1"] && pins()["TPE 桃園 T1"].la === 25.080 &&
      pins()["TPE 桃園 T1"].lo === 121.234, pins()["TPE 桃園 T1"]);
    ok("而且補上了 `via` —— 介面靠它才講得出這是人工表的座標",
      pins()["TPE 桃園 T1"] && pins()["TPE 桃園 T1"].via === "TPE 桃園 T1",
      pins()["TPE 桃園 T1"]);
    ok("對帳寫回了 localStorage(不是只改了記憶體裡那份)",
      /25\.08/.test(w.localStorage.getItem("tokyo5-pin3") || ""),
      (w.localStorage.getItem("tokyo5-pin3") || "").slice(0, 200));
    /* **只動這張表答得出來的 key。** 換快取 key 會把下面這些一起丟掉,
       然後每一顆重查一次、每次排隊 1.1 秒 —— 那是 `57473b5` 付過的代價。 */
    ok("表答不出來的 key 一個字都沒動(淺草寺)",
      JSON.stringify(pins()["淺草寺"]) === JSON.stringify({ la: 35.7134, lo: 139.7955 }),
      pins()["淺草寺"]);
    ok("`null`(查過了,沒有)也沒有被當成要修的東西",
      pins()["泡溫泉"] === null && "泡溫泉" in pins(), pins()["泡溫泉"]);

    /* 反方向:表會變(`富士` 被拆掉過),那些**聲稱來自人工表、而表已經不認得**
       的舊資料要被清掉,不然錯的座標永遠留著 —— 上面那圈只看表答得出來的 key,
       碰不到它們。 */
    ok("表不再認得的舊表資料被清掉(富士電視台,曾經被 `富士` 拉到河口湖)",
      !("富士電視台" in pins()), pins()["富士電視台"]);
    ok("而且是 delete 不是寫 null(null 會讓它再也不去問線上)",
      pins()["富士電視台"] === undefined, JSON.stringify(pins()).slice(0, 160));

    // 2 ---- 從 DAY 那顆按鈕開地圖 = 06 那張截圖的狀態 ----
    q("#day-map-btn").click();
    await until(function () { return d.querySelectorAll(".map .pin").length >= 3; });
    /* 3 顆而不是 5 顆:合羽橋道具街(行程,沒填地點)和 teamLab(願望,沒填地點)
       以前是**拿標題去查**才有 pin 的,規則一之後它們不該再出現。 */
    ok("地圖有畫出 pin(確認這一輪真的跑起來了)", d.querySelectorAll(".map .pin").length >= 3,
      d.querySelectorAll(".map .pin").length);
    var labs = [].map.call(d.querySelectorAll(".map .pin .lab"), function (e) { return e.textContent; });
    ok("沒填地點的沒有被標上去(合羽橋道具街)",
      !labs.some(function (t) { return /合羽橋/.test(t); }), labs);
    ok("沒填地點的沒有被標上去(teamLab)",
      !labs.some(function (t) { return /teamLab/.test(t); }), labs);

    /* ---- 3 到 7 段退場(2026-09-22,mapfix-retire) ----
       這五段量的是「再查一次」那條退路的前端行為:點一列 → 那條小字出現 →
       按「再查一次」→ 回概略 → 虛線圈 → 按「對」→ 變實線 → 失敗不弄丟座標 → 收起來就不見。
       **那條路整條拆掉了**,所以這幾段不是壞了,是測試對象沒了。

       跟著一起不見的證據,誠實登記在這裡:
         - 概略 pin(`ap`)那一整套的行為 —— `ap` 全檔只有 `regeoItem()` 會設,
           它退場之後**新的概略 pin 再也產生不出來**,所以這裡沒有東西可以量。
           `.pin.approx` 的畫法和 `.approx` 的 CSS 都還留著(舊快取裡可能還有 `ap:1`
           的資料),第 8 段仍然守著那條 CSS 規則。
         - 「再查一次」失敗時不弄丟舊座標 —— 入口沒了,這條路走不到。
         - 願望那條路送 `wish=` 的 URL 形狀 —— 送出的人沒了。
       這三件事現在**沒有任何探針在守**,要的話得先有新的入口。 */
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
    /* `mapfix` / `mf-t` 兩條沒有對象了 —— 那兩個 class 隨那條小字一起退場。
       `approx` 留著:舊快取裡可能還有 `ap:1` 的 pin,它們照樣畫得出虛線圈。 */
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
    q("#wf-by").value = "hsieh_chinhui";
    q("#wf-submit").click();
    /* **話改講在許願表單那一槽上,不在頁尾的 #sync。** 上一輪這裡看的是 flashes ——
       而那正是問題二:訊息真的有發,只是發在頁面最底下 10.5px 的小字上,
       使用者在表單上按送出,眼睛在表單。位置的部分量在第 12 段。 */
    ok("許願沒填地點 → 講的是「不會出現在地圖上」和「補上地點就會」",
      await until(function () { return /還沒挑地點.*地圖上不會有它.*搜尋/.test(q("#wish-msg").textContent); }),
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
    q("#stop-form button[type=submit]").click();
    ok("加行程沒填地點 → 同一句話(同一個 checkPlace,不是第二套機制)",
      await until(function () { return /早點睡.*還沒挑地點/.test(q("#stop-msg").textContent); }),
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
    /* **這一段原本問的是那條小字講了什麼**(「在人工確認過的表裡」、「不在日本境內」、
       「不畫再查一次」)—— 那條小字退場了,所以那幾條沒有對象。
       留下來的是它真正在守的那件事:**這一筆從頭到尾沒有拿航班備註去查過**。 */
    await sleep(100);
    var all2 = osm.concat(asked).join(" ");
    ["樂桃", "%E6%A8%82%E6%A1%83", "MM626", "%E5%BB%BA%E8%AD%B0%E8%B5%B7%E9%A3%9B"].forEach(function (k) {
      ok("整趟沒有任何查詢問過「" + k + "」(那是航班備註,不是地名)", all2.indexOf(k) < 0, all2.slice(0, 500));
    });
    // 11b ---- 關鍵字寫在**地點欄**的那幾筆(Lulu 回報的就是這一種) ----
    /* **上一輪這兩條斷言是綠的,而且是錯的。** 它們斷言成田講「不在這裡?」、
       「再查一次」照樣畫得出來 —— 那正是 bug 的樣子,被當成基準寫了下來。

       根因:`via`(「這顆座標來自人工表」的標記)以前只掛在 outsidePin() 的
       回傳值上,一寫進 `pins[place]` 就掉。於是只有**標題命中**那條路
       (`kp` 為 null、地點欄存 null、pinOf 掉到標題)看得到人工表那句話;
       **關鍵字寫在地點欄的那幾筆走 `pins[place]`,永遠講不出來**。

       11 段測的是標題那條路,所以 114 條全綠。**問錯的問題會得到一個乾淨的、
       錯的綠燈** —— 這一輪的版本是「只走了會過的那條路」。 */
    var mm = [].slice.call(d.querySelectorAll("#route .stop"))
      .filter(function (r) { return /MM626 起飛/.test(r.textContent); })[0];
    ok("找得到 MM626 起飛那一列(place = TPE 桃園 T1,關鍵字在地點欄)", !!mm, null);
    mm.click();
    await sleep(100);
    /* 原本這裡問那條小字有沒有印出「TPE 桃園 T1」「在人工確認過的表裡」「不在日本境內」,
       以及「再查一次」有沒有收起來 —— 整條退場之後那四條沒有對象。
       **人工表有沒有接住這兩筆,看得見的證據是 pin 和 via,不是那句話。** */
    ok("地點欄命中人工表 → 那一筆拿得到表裡的座標(TPE 桃園 T1)",
      !!pins()["TPE 桃園 T1"] && pins()["TPE 桃園 T1"].via === "TPE 桃園 T1",
      pins()["TPE 桃園 T1"]);
    var nrt = [].slice.call(d.querySelectorAll("#route .stop"))
      .filter(function (r) { return /抵達成田機場/.test(r.textContent); })[0];
    nrt.click();
    /* **這一條原本斷言的是「`pins["NRT 成田 T1"]` 在快取裡、而且帶 via」,而那是錯的。**
       量過了:成田在地圖上**有** pin,但那個 key 從來沒進過 `tokyo5-pin3` ——
       `pinOf` 的第二步直接問 `outsidePin()`,人工表現算現回,不寫快取。
       (`pinFor` 才會寫,而它走的是另一條路。)

       舊版之所以是綠的,是因為前面幾段的 `regeoItem()` 會把表的值寫回快取 ——
       **那條路退場之後,這條斷言量的東西就不存在了**。照抄過來只會得到一個
       紅燈,而它指的不是壞掉,是我問錯問題。
       改成問看得見的那件事:**表有沒有接住它**,證據是地圖上那顆 pin + 零查詢。 */
    var osmB11nrt = osm.length, askedB11nrt = asked.length;
    q("#day-map-btn").click();
    ok("成田那一筆在地圖上有 pin(人工表接住它,而且它在日本境內)",
      await until(function () {
        return [].some.call(d.querySelectorAll(".map .pin .lab"),
          function (e) { return /抵達成田機場/.test(e.textContent); });
      }),
      [].map.call(d.querySelectorAll(".map .pin .lab"), function (e) { return e.textContent; }));
    ok("而且接住它沒有發出任何查詢(表就是答案,不花錢)",
      osm.length === osmB11nrt && asked.length === askedB11nrt,
      { osm: osm.slice(osmB11nrt), geocode: asked.slice(askedB11nrt) });

    // 11c ---- 把 `富士` 從表裡拆掉(量測之後改的,見 table-vs-apis.js) ----
    /* `富士` 是子字串比對,所以「富士電視台」(台場)會被拉到河口湖 ——
       量到差 151km,而同一個字串 Nominatim 只差 0.03km。**表在那一筆上是
       比較差的答案**,所以 key 改成 `富士山`。

       **這幾條測的是看得見的行為,不是內部函式。** 第一版寫的是
       `w.eval('outsideHit("富士電視台")')` —— 那兩個函式不在全域,第一條因為我加了
       `typeof` 保護而回 ✓(**又一個假綠燈:它證明的是函式碰不到,不是行為對**),
       第二條直接 ReferenceError 把整支探針炸掉,126 條只跑到 111 條。
       表有沒有接住一個字串,**看得見的證據是「有沒有發出線上查詢」**。 */
    flashes.length = 0; asked.length = 0;
    var osmB11c = osm.length;
    /* **兩欄合併之後這一段的判準換了,而那是語意真的變了,不是改個選擇器。**
       以前「富士電視台」填在地點欄,拆掉 `富士` 之後它會**掉到線上查詢**,
       所以當時的證據是「有沒有發出查詢」。
       現在打了字而沒挑 = 沒有 `place`,而規則一不准自動查 —— **一次都不會發**。
       所以判準變成「**表有沒有接住它**」:接住就有 pin,沒接住就沒有 pin。 */
    q("#add-wish-btn").click();
    q("#wf-title").value = "富士電視台";
    q("#wf-by").value = "hsieh_chinhui";
    q("#wf-submit").click();
    await until(function () {
      return [].slice.call(d.querySelectorAll("#wish-list [data-wish]"))
        .some(function (r) { return /富士電視台/.test(r.textContent); });
    });
    await sleep(200);
    ok("表不再接住「富士電視台」→ 它沒有 pin(拆掉 `富士` 的效果)",
      !pinsOf("富士電視台"), pinsOf("富士電視台"));
    ok("而且沒挑就是沒挑 —— 一次線上查詢都不發(規則一)",
      osm.length === osmB11c, osm.slice(osmB11c));
    ok("送出時講的是「還沒挑地點」,不是默默什麼都不做",
      await until(function () { return /富士電視台.*還沒挑地點/.test(q("#wish-msg").textContent); }),
      q("#wish-msg").textContent);

    /* 另一半:拆 key 不能把它本來該接住的東西一起拆掉。
       「富士山」照樣要命中人工表 —— 而命中的證據是**它拿得到 pin,而且一次查詢都不發**。
       (這一筆的 place 是空的,所以走的是 pinForItem 第三步:標題比對人工表。) */
    var osmB11d = osm.length;
    q("#add-wish-btn").click();
    q("#wf-title").value = "富士山 五合目";
    q("#wf-by").value = "hsieh_chinhui";
    q("#wf-submit").click();
    await until(function () {
      return [].slice.call(d.querySelectorAll("#wish-list [data-wish]"))
        .some(function (r) { return /富士山/.test(r.textContent); });
    });
    await sleep(300);
    ok("「富士山 五合目」仍然被表接住 —— 一次查詢都不發",
      osm.length === osmB11d, osm.slice(osmB11d));
    ok("而且它講的不是「還沒挑地點」(表接住了,那句話會是假的)",
      !/富士山.*還沒挑地點/.test(q("#wish-msg").textContent), q("#wish-msg").textContent);

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
    q("#wf-by").value = "hsieh_chinhui";
    /* **錨點換了,因為表單搬走了。**
       原本拿的是 `#wish-form` 的上緣 —— 它那時候就長在清單正上方,所以「表單在哪」
       等於「使用者的眼睛在哪」。現在新增是一張置中的對話框(`#wish-add-overlay`),
       它的上緣在畫面正中央,跟送出**之後**要讀那句話的地方沒有關係了。
       在 1440 上這條就是這樣紅的:到訊息 603、到頁尾 1231,而兩個數字都不是它想問的。

       **要守的東西沒變**:那句話要出現在他接下來看的地方,不是頁尾那行 10.5px。
       送出之後他看的是**願望清單** —— 那一筆剛進去,他要確認它在不在。
       所以錨點換成清單的上緣,而且跟訊息在同一個版面上量(都在送出後)。

       兩個踩過的坑還在,換錨點沒有讓它們消失:
         1. 送出就 hidden 的東西,rect 全是 0 —— 不要拿送出後的表單當基準。
         2. 兩個位置不在同一個版面上就不能相減(表單一收底下整片會往上移)。
       頁尾那個距離仍然用**按下去那一刻**的版面,理由見下面。 */
    var footA = q("#sync").getBoundingClientRect().top;   /* 按下去的那一刻,頁尾在哪 */
    var eyeY = 0;   /* 送出後才量得準,見下面 */
    q("#wf-submit").click();
    ok("許願沒填地點 → 話講在許願表單那一槽上",
      await until(function () { return q("#wish-msg").hidden === false; }), q("#wish-msg").outerHTML);
    ok("而且文案沒變(還是「不會有它」+「按搜尋挑一個」)",
      /還沒挑地點.*地圖上不會有它.*搜尋/.test(q("#wish-msg").textContent), q("#wish-msg").textContent);
    ok("**不再寫到頁尾那行小字** —— 同一句話只有一個出口",
      !flashed(/還沒挑地點/), flashes);
    ok("用的是站上現成的 .note,沒有長出第三套提示機制",
      !!q("#wish-msg .note"), q("#wish-msg").innerHTML);
    /* 「講在眼睛所在的地方」是可以量的:比一比那句話離送出鈕多遠、離頁尾那行多遠。 */
    var hereY = q("#wish-msg").getBoundingClientRect().top;
    eyeY = q("#wish-list").getBoundingClientRect().top;   /* 他接下來要看的東西 */
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
    /* **原本問的是「表單 → 訊息 → 清單」這個順序,而表單搬走了。**
       許願的新增表單變成對話框(`#wish-add-overlay`),不再是清單上面那一塊,
       所以 `#wish-form.nextElementSibling` 是 null —— 那不是壞掉,是它換了位置。
       **要守的東西沒變**:那句話講的是「剛剛存進去的那一筆為什麼不在地圖上」,
       它要**貼著清單**被讀到,不能被搬進一個馬上會關掉的對話框裡。
       所以判準改成問它跟清單的關係,不是跟表單的。 */
    ok("那句話貼在清單前面(它講的是剛存進去的那一筆,要在清單旁邊讀到)",
      q("#wish-msg").nextElementSibling === q("#wish-list"),
      { 訊息的下一個: q("#wish-msg").nextElementSibling && q("#wish-msg").nextElementSibling.id });
    ok("而且它沒有被搬進對話框裡",
      !q("#wish-add-overlay").contains(q("#wish-msg")), q("#wish-msg").parentElement.className);

    // 12b ---- 加行程那一槽,以及「查不到」「不在日本境內」兩句 ----
    flashes.length = 0;
    q("#add-stop-btn").click();
    q("#sf-time").value = "17:00";
    q("#sf-title").value = "多喝水";
    q("#stop-form button[type=submit]").click();
    ok("加行程沒填地點 → 話講在行程表單那一槽上",
      await until(function () { return q("#stop-msg").hidden === false; }), q("#stop-msg").outerHTML);
    ok("加行程那一句也不再寫到頁尾", !flashed(/還沒挑地點/), flashes);
    /* 跟上面願望那條同一個形狀:**加行程的表單也搬進對話框了**
       (`#stop-add-overlay`),所以它不再是行程列表上面那一塊。
       要守的東西沒變:那句話講的是剛存進去的那一筆,要**貼著行程列表**被讀到。 */
    ok("那句話貼在行程列表前面(它講的是剛存進去的那一筆)",
      q("#stop-msg").nextElementSibling === q("#route"),
      { 訊息的下一個: q("#stop-msg").nextElementSibling && q("#stop-msg").nextElementSibling.id });
    ok("而且它沒有被搬進對話框裡",
      !q("#stop-add-overlay").contains(q("#stop-msg")), q("#stop-msg").parentElement.className);

    /* **「查不到」那一段拿掉了,而且它不是搬走,是變成到不了。**
       兩欄合併之後,送出時要有 `place` 只有一條路:從候選清單挑一個 ——
       而**挑到的東西必定有座標**(座標就是跟著候選一起來的)。
       所以「有 place 但查不到」這個狀態,新增的那一刻再也產生不出來。

       那句話的程式還留著,因為**舊資料到得了**:合併之前存下來的那些 place,
       在編輯時送出會走同一個 `checkPlace()`(`index.html:3256`)。
       要測它得在 fixture 裡種一筆查不到的舊資料,而那會多出一項行程、
       改掉天數計數,連帶動到 01 / 02 兩張截圖 —— **為了測一條legacy路徑去改基準,
       代價大於它買到的東西**。登記在 `merge-place-field.md` 的「沒有驗到的」。

       「不在日本境內」那條測得到,而且**判準換了**:以前靠地點欄填 `TPE 桃園 T1`,
       現在填在標題上 —— `pinForItem` 第三步會拿標題去比對人工表,一次查詢都不發。 */
    flashes.length = 0;
    var netB12 = asked.length + osm.length;
    q("#add-stop-btn").click();
    ok("再打開表單 → 上一句話收掉了(不留成背景)", q("#stop-msg").hidden === true, q("#stop-msg").outerHTML);
    q("#sf-time").value = "19:00";
    q("#sf-title").value = "TPE 桃園 T1";
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
    /* 門檻從 30 調到 31,再調到 32,而**每一次的理由都要寫下來,
       不然這就是「把期望值從現況抄過來」**(工具陷阱 12,這支自己登記過的)。
       31 那一次新增的是 `flash("改不成:" + err.message)` ——
       它跟既有的 `刪不掉:` / `+1 沒成功:` 是**同一套**(寫入失敗的回饋走頁尾),
       不是第三套。而 `只改得動自己許的願望` 跟 `mayEdit()` 那句同形。
       32 這一次新增的是 `mayWriteWish()` 裡那一句
       (`這是離線副本,改了存不下來`)—— 它是 `mayEdit()` 那句的姊妹:
       **同一個形狀(閘門擋下來就講一句)、同一個位置(頁尾)**,而且
       送出 handler 和 updateWish() 兩層**共用同一份字面**,所以只 +1 不是 +2。
       第一版真的寫成兩份,就是這一條把它抓出來的。
       **真正在防的那件事(那三句搬走的別回來)靠的是上面那幾條 `!flashed(...)`,
       它們量的是執行時有沒有出現,比數字面強。這一條只是漂移偵測。** */
    ok("flash() 的字面數沒有暴增(那三句沒回來,新增的是既有那一套的同類)",
      out.flash字面數 <= 32, out.flash字面數);
    out.sayHere字面數 = (d.documentElement.outerHTML.match(/sayHere\(/g) || []).length;

    /* ======================================================================
       14 ---- 唯讀的那三個人,在願望清單上看得到什麼、動得了什麼
       ======================================================================
       **這一段原本的主旨是「那句解釋對所有人顯示」** —— 而那句解釋住在地圖上方
       那條小字裡,整條在 mapfix-retire 那一輪退場了,所以主旨那一半沒有對象了。
       留下來的是同樣重要、而且跟那條小字無關的另一半:**唯讀的人有沒有「改」、
       有沒有被誤給「刪掉」、那一排會不會換行、以及他改完送出去的形狀對不對。**

       **這一段放在最後,因為它是單向的** —— `goOnline()` 之後回不到離線模式
       (要 reload),而上面每一段量的都是離線那一套。 */
    function wishRow(re) {
      return [].slice.call(d.querySelectorAll("#wish-list [data-wish]"))
        .filter(function (r) { return re.test(r.textContent); })[0];
    }
    /* `.wm` 那一排有沒有換到第二行 —— 問的是子元素落在幾個不同的 offsetTop 上。
       **那是 flex-wrap 有沒有發生的定義,不是它的代理指標。**
       (第一版比的是兩列的 offsetHeight,量出來 22 vs 18 看起來像換行,
        實際上 4px 差的是「按鈕比純文字高」,而真的換行會多一整個行高。
        **一個閾值式的比較分不出「高 4px」和「多一行」,除非你先知道一行有多高。**) */
    function rowsOf(wm) {
      var tops = {};
      [].forEach.call(wm.children, function (c) { tops[c.offsetTop] = 1; });
      return Object.keys(tops).length;
    }

    /* ---- 先造一筆「乾淨」的願望,而這一步是這一段成立的前提 ----
       **第一版用 w2(橫濱 港灣未來)來測「唯讀下再查一次不見了」,而那條綠燈是假的。**
       上面第 5 段已經把 `pins["港灣未來"]` 清成 null,所以 `pinOf` 會掉到標題那一步,
       而「橫濱」寫在 OUTSIDE 人工表裡 —— 也就是說 w2 **早就是「人工表就是答案」**,
       那顆按鈕本來就該 hidden。**沒有我這一輪的改動它也是 hidden。**

       那正是工具陷阱 12 的形狀,只是長在我自己剛寫的斷言上:
       **一條在改動前後都綠的斷言,證明的是零。**

       所以改用一筆標題裡不含任何人工表關鍵字、而且地點欄有真實快取座標的願望。
       「台場自由女神像」對 OUTSIDE 那十四組 key 一個都不中。 */
    var CLEAN = "台場自由女神像";
    q("#add-wish-btn").click();
    q("#wf-title").value = CLEAN;
    await pickPlace("wf", CLEAN, "35.6270", "139.7740");
    q("#wf-by").value = "hsieh_chinhui";
    q("#wf-submit").click();
    await until(function () { return !!wishRow(new RegExp(CLEAN)); });
    ok("造得出一筆「自己的、有座標、而且人工表答不出來」的願望",
      !!pins()[CLEAN] && !pins()[CLEAN].via, pins()[CLEAN]);

    /* **這一條是下面那個「不見了」的對照組。** 現在還是離線(`editable()` 為 true),
       同一筆願望、同一顆按鈕**是畫得出來的** —— 沒有這一條,下面那條紅不紅都沒有意義。 */
    /* 原本這裡有一條【對照組】:可編輯的時候這一筆在地圖上**有**「再查一次」,
       用來讓下面「唯讀下它不見了」那條不是恆真。兩邊的對象都退場了,一起走。 */
    /* ---- 05 那張截圖上那個換行,在這裡先量一次當對照組 ----
       離線(`editable()` 為 true)的時候「改」和「刪掉」同時出現,`.wm` 裝不下,
       **那正是 05 變胖 51px 的原因**。先量它,下面那條「唯讀不換行」才不是恆真 ——
       沒有這一條,`rowsOf() === 1` 有可能只是因為這支量錯了東西。 */
    /* **它只在窄視窗下換行,而那正是 05 的寬度(390)。** 第一版沒有分寬度,
       結果 1100 那一趟紅了 —— 那不是壞掉,是**那個寬度裝得下**。
       (ADOPTION.md:「一塊如果出現在手機圖上,兩個寬度都要量」——
        而這一條在兩個寬度下本來就該有兩個不同的答案。) */
    var wmEditable = wishRow(/港灣未來/).querySelector(".wm");
    var narrow = w.innerWidth <= 640;
    out.可編輯時那一排 = {
      視窗寬: w.innerWidth, 行數: rowsOf(wmEditable),
      內容: [].map.call(wmEditable.children, function (c) { return c.textContent.trim(); }),
    };
    if (narrow) {
      /* **這條原本斷言「窄視窗下那一排會換行」,而它的獨立證據過期了。**
         那個證據是 05 的比對:那張卡高了 51px、位移搜尋說 `dy=+51`。
         但 05 拍的是**許願還住在頁面裡**的版面 —— 現在它是一張滿版 sheet,
         `position:fixed; inset:0`,比原本那個有頁面邊距的盒子寬了三十幾 px,
         於是同一排裝得下了(量到:390px 下 1 行,不是 2 行)。

         **所以不下斷言,只記數字。** 寫「應該一行」就是把現況抄成期望值;
         而要重新有根據,得先有一張拍到新版面的 05。 */
      out.可編輯時那一排.說明 = "**這個版面沒有下斷言** —— 原本的根據是舊 05 的 +51px," +
        "而許願改成滿版 sheet 之後那張圖的前提沒了,要等新的基準截圖才談得上期望值。";
    } else {
      /* 這個寬度沒有截圖可以當獨立證據,所以**不在這裡下斷言** ——
         寫一條「1100 下不換行」等於把現況抄成期望值(工具陷阱 12)。 */
      out.可編輯時那一排.說明 = "**這個寬度沒有下斷言** —— 沒有對應的截圖當獨立證據," +
        "寫「不換行」會變成把現況抄成期望值。換行那條只在 390 量。";
    }

    var wishRows = [
      { id: "w1", title: "teamLab", place: "", note: "要先訂票", votes: ["chang_chiayu", "hsieh_chinhui"], by: "chang_chiayu", createdAt: "2026-09-16T01:00:00Z" },
      { id: "w2", title: "橫濱 港灣未來", place: "港灣未來", note: "本來的備註", votes: ["hsieh_chinhui"], by: "hsieh_chinhui", createdAt: "2026-09-16T02:00:00Z" },
      { id: "w3", title: "泡溫泉", place: "", note: "沒填地點的那種", votes: [], by: "chen_suchih", createdAt: "2026-09-16T03:00:00Z" },
      { id: "w4", title: CLEAN, place: CLEAN, note: "", votes: ["hsieh_chinhui"], by: "hsieh_chinhui", createdAt: "2026-09-16T04:00:00Z" },
    ];
    notionWishes = wishRows;

    // 14a ---- 切換到唯讀之前,先確認那條路真的把我們帶過去 ----
    serveNotion = true;
    ok("切換之前是離線模式(對照的起點)", /離線模式/.test(q("#cloud-msg").textContent), q("#cloud-msg").textContent);
    var cin = q("#cloud-in");
    ok("畫面上有「連上 Notion」這條路(唯讀是從這裡進去的)", !!cin, q("#cloud-ops").innerHTML);
    cin.click();
    ok("連上之後是**已連上但不是管理員**(= 那三個人的身分)",
      await until(function () { return /^已連上 Notion$/.test(q("#cloud-msg").textContent); }),
      q("#cloud-msg").textContent);
    /* **這一條是上面那句身分宣告的憑證。** 只看 cloud-msg 的話,我只是在讀一段
       我自己也可以寫錯的文案;`add-stop-btn` 被收起來是 `renderEditAbility()`
       對 `editable()` 的反應,那才是真的在問「這個 session 能不能編輯」。 */
    ok("而且 editable() 真的是 false(加行程的按鈕被收起來了)",
      q("#add-stop-btn").hidden === true, q("#add-stop-btn").outerHTML.slice(0, 100));

    /* ---- 14b / 14c / 14d 退場(mapfix-retire) ----
       這三小段量的是那條小字在唯讀下的行為:別人的願望有沒有解釋、自己的願望
       說明在不在、「再查一次」搬走了沒、「對」的判準裡有沒有身分。
       **那條小字和那兩顆鈕整條拆了,四件事都沒有對象。**

       要留下一句話給下一個人:Lulu 當初回報的是「唯讀的人點一列,地圖開了、
       什麼解釋都沒有」。那個解釋現在**對所有人都不存在了** —— 不是退回舊行為,
       是那條小字整條退場。使用者要知道「這一筆為什麼不在地圖上」,
       靠的是送出當下那一槽(第 10 / 12 段量的那個),不是地圖上那一條。 */
    var mineRow = wishRow(new RegExp(CLEAN));
    ok("找得到自己許的那一筆(" + CLEAN + ")", !!mineRow, null);

    // 14e ---- 「改」在唯讀下還在,「刪掉」不在 ----
    ok("唯讀 → 自己那一筆仍然有「改」(它的判準是 mineWish,不是通行碼)",
      !!mineRow.querySelector("[data-edit-wish]"), mineRow.innerHTML.slice(0, 300));
    ok("唯讀 → 別人那一筆沒有「改」",
      !wishRow(/泡溫泉/).querySelector("[data-edit-wish]"), null);
    ok("唯讀 → 「刪掉」不在(那一顆本來就是管理員的)",
      !mineRow.querySelector("[data-del-wish]"), null);

    /* **這一條是被截圖逼出來的。** 05 那張(離線,`editable()` 為 true)顯示:
       「改」和「刪掉」同時出現時,`.wm` 那一排(flex-wrap)裝不下,
       「刪掉」被擠到第二行,那張卡因此高了 51px。
       **但那是管理員看自己願望的樣子,不是那三個人看到的樣子** ——
       他們沒有「刪掉」。而 05 是唯一一張願望清單的截圖,**它拍不到唯讀**。

       所以這裡直接量那一排的高度:跟同一份清單裡沒有任何按鈕的那一列比,
       一樣高就代表沒有換行。**截圖答不出來的那一半,用探針補。** */
    /* **第一版比的是兩列的 offsetHeight,而那量錯了東西。** 量出來 22 vs 18,
       看起來像「換行了」,實際上 4px 差的是**按鈕比純文字高**(`.wdel` 有 padding),
       而真的換行會多一整個行高(~18px)。
       **一個閾值式的比較,分不出「高 4px」和「多一行」——除非你先知道一行有多高。**
       改成直接問那件事本身:`.wm` 的子元素是不是全部在同一個 `offsetTop` 上。
       那是 flex-wrap 有沒有發生的定義,不是它的代理指標。 */
    var wmMine = mineRow.querySelector(".wm");
    /* **這條原本無條件斷言「一行」,而那個前提在三欄版面之後不成立了。**
       許願區以前佔滿整個內容寬度;寬桌機改成「行程 ｜ 許願 ｜ 地圖」之後,
       它只剩一半 —— 在 1100px 上大約 300px,那一排裝不下是**設計如此**,不是缺陷。

       所以判準跟著換:**只有在它真的有整寬可用的時候才斷言一行**。
       門檻 480 是量出來的:兩欄版面(1100px)下那一排是 495px,三欄(1280px)下是 234px ——
       設 520 的話連整寬那一種都守不到,等於把原本的保護漏掉。
       窄的時候記下數字但不下斷言 —— 這個寬度沒有截圖可以當獨立證據,
       寫「應該換兩行」等於把現況抄成期望值(工具陷阱 12,上面那一段也是這樣處理的)。 */
    var wmW = Math.round(wmMine.getBoundingClientRect().width);
    out.唯讀下那一排 = {
      自己的行數: rowsOf(wmMine), 自己的高度: wmMine.offsetHeight, 那一排有多寬: wmW,
      內容: [].map.call(wmMine.children, function (c) { return c.textContent.trim(); }),
    };
    if (wmW >= 480) {
      ok("唯讀 + 整寬 → 多了「改」也沒有把那一排擠到第二行(他們沒有「刪掉」,所以裝得下)",
        rowsOf(wmMine) === 1, out.唯讀下那一排);
    } else {
      out.唯讀下那一排.說明 = "**這個寬度不下斷言** —— 許願是三欄版面裡的一欄(" + wmW +
        "px),裝不下是設計如此;沒有這個寬度的截圖當獨立證據,寫死行數會變成把現況抄成期望值。";
    }

    // 14f ---- 唯讀的人真的改得動自己那一筆,而且送出去的形狀是對的 ----
    /* 「再查一次」原本在這裡問兩次(這一筆畫得出來、人工表那一筆畫不出來)。
       `#we-again` 在 search-escalate 那一輪退場,兩條都刪,改由 `probes/escalate.js` 接手。
       **而它們刪掉之前是會拋例外的** —— null.hidden —— 所以 14f 之後的斷言
       每一輪都沒跑到,而結論照樣印「全部通過」,筆記照抄成「geofix 150 全過」。 */
    mineRow.querySelector("[data-edit-wish]").click();
    ok("「改」打得開",
      await until(function () { return q("#wish-edit-overlay").hidden === false; }),
      q("#wish-edit-overlay").outerHTML.slice(0, 120));
    q("#we-cancel").click();

    /* 換到 w2 測送出的形狀:它有備註和票,漏送哪一個看得出來。
       **順帶量到人工表那條規則在編輯框裡也成立** —— w2 現在是人工表答的
       (上面第 5 段把它的地點欄清成 null 了),所以這一筆**不該**有「再查一次」。 */
    notionWrites.length = 0;
    var w2row = wishRow(/港灣未來/);
    w2row.querySelector("[data-edit-wish]").click();
    await until(function () { return q("#wish-edit-overlay").hidden === false; });
    ok("既有的 place 在狀態列上講出來了(合併之後它只活在這一行)",
      /已標定/.test(q("#we-title-out").textContent), q("#we-title-out").textContent);
    q("#we-note").value = "改過了";
    q("#wish-edit-form button[type=submit]").click();
    ok("送出去了(唯讀的人動得了自己那一筆)",
      await until(function () { return notionWrites.length > 0; }), notionWrites);
    var patch = notionWrites[0] || {};
    var sent = JSON.parse(patch.內容 || "{}");
    ok("走的是 PATCH ?resource=wishes&id=w2",
      patch.方法 === "PATCH" && /resource=wishes/.test(patch.網址 || "") && /id=w2/.test(patch.網址 || ""), patch);
    ok("改到的是 note", sent.note === "改過了", sent);
    /* **這兩條不是防禦性程式碼,是那個資料形狀的要求。**
       後端 wishIn() 把「備註」寫成 joinNote(note, votes)、把「時間」寫成 by ——
       漏送哪一個,那一個在 Notion 上就會被寫成空的。
       漏送 by 尤其嚴重:`by` 是 `.mine`、「改」按鈕、和 geocode 那條窄路
       三者共同的地基,它一空,使用者就再也編不動自己那一筆了。 */
    ok("`by` 一起送回去(漏送的話 Notion 的「時間」欄會被寫空,這一筆從此沒有主人)",
      sent.by === "hsieh_chinhui", sent);
    ok("`votes` 一起送回去(漏送的話備註欄裡那串 +1 會被寫掉)",
      JSON.stringify(sent.votes) === JSON.stringify(["hsieh_chinhui"]), sent);
    ok("**沒有動 title**(只改了想說的,標題原樣)", sent.title === "橫濱 港灣未來", sent);
    ok("**沒有動 place**(標題沒改,所以原來那個留著,沒有被悄悄丟掉)",
      sent.place === "港灣未來", sent);
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
  document.getElementById("r").textContent = JSON.stringify(out, null, 2);
})();

return { 說明: "非同步,真正的結果會晚一點蓋掉這一段" };
