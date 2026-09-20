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
      await until(function () { return /合羽橋.*還沒挑地點/.test(barText()); }), barText());
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
    q("#wf-title").value = "某某展望台";
    /* 挑一個,這一筆才會有 place —— 合併之後「打字打出一個地點」已經不存在 */
    await pickPlace("wf", "某某展望台", "35.6812", "139.7671");
    q("#wf-by").value = "hsieh_chinhui";
    q("#wf-submit").click();
    await until(function () {
      return [].slice.call(d.querySelectorAll("#wish-list [data-wish]"))
        .some(function (r) { return /某某展望台/.test(r.textContent); });
    });
    ok("查得到的地點 → 送出時一句話都不講(不吵)",
      q("#wish-msg").hidden === true, q("#wish-msg").outerHTML);
    var night = [].slice.call(d.querySelectorAll("#wish-list [data-wish]"))
      .filter(function (r) { return /某某展望台/.test(r.textContent); })[0];
    ok("找得到某某展望台那一列", !!night, null);
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
    /* **等的條件必須是「這一列才有的字」。** 第一版等的是 /人工確認過的表裡/ ——
       而上一列(桃園機場報到)講的就是那句話,於是 until() 在這一列重畫之前
       就通過了,後面兩條斷言量的是**上一列的字**。第一次跑就抓到,寫下來:
       畫面上留著的舊字會讓「等到了」跟「換好了」看起來一模一樣。 */
    ok("地點欄命中表 → 講得出「在人工確認過的表裡」(Lulu 看到的是「沒標上去」)",
      await until(function () { return /TPE 桃園 T1/.test(barText()); }) &&
      /人工確認過的表裡/.test(barText()), barText());
    ok("而且同一句話說得出為什麼它不在圖上", /不在日本境內/.test(barText()), barText());
    ok("印的是地點欄那幾個字(TPE 桃園 T1),不是標題",
      /TPE 桃園 T1/.test(barText()) && !/第一航廈/.test(barText()), barText());
    ok("人工表就是答案 → 不畫「再查一次」(這一顆以前是畫得出來的)",
      q("#map-fix-go").hidden === true, q("#map-fix-go").outerHTML);

    /* 成田:同一條路,但它**在**日本境內 —— 所以走的是 manual 的另一半分支。
       兩半都要有人測,不然改壞一半另一半照樣綠。 */
    var nrt = [].slice.call(d.querySelectorAll("#route .stop"))
      .filter(function (r) { return /抵達成田機場/.test(r.textContent); })[0];
    nrt.click();
    ok("地點欄命中表 + 在日本境內 → 講「用的是人工確認過的座標」",
      await until(function () { return /NRT 成田 T1/.test(barText()); }) &&
      /人工確認過的座標/.test(barText()), barText());
    ok("成田那一條不該說「不在日本境內」", !/不在日本境內/.test(barText()), barText());
    ok("成田的「再查一次」也收起來(再查只會拿比較差的去蓋人工驗過的)",
      q("#map-fix-go").hidden === true, q("#map-fix-go").outerHTML);
    ok("成田那一顆 pin 還在(收起按鈕不等於失去座標)",
      !!pins()["NRT 成田 T1"] && pins()["NRT 成田 T1"].via === "NRT 成田 T1",
      pins()["NRT 成田 T1"]);

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
    ok("而且文案沒變(還是「不會有它」+「按搜尋挑一個」)",
      /還沒挑地點.*地圖上不會有它.*搜尋/.test(q("#wish-msg").textContent), q("#wish-msg").textContent);
    ok("**不再寫到頁尾那行小字** —— 同一句話只有一個出口",
      !flashed(/還沒挑地點/), flashes);
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
    q("#stop-form button[type=submit]").click();
    ok("加行程沒填地點 → 話講在行程表單那一槽上",
      await until(function () { return q("#stop-msg").hidden === false; }), q("#stop-msg").outerHTML);
    ok("加行程那一句也不再寫到頁尾", !flashed(/還沒挑地點/), flashes);
    ok("它在 DOM 上的位置是「表單和行程列表之間」",
      q("#stop-form").nextElementSibling === q("#stop-msg") &&
      q("#stop-msg").nextElementSibling === q("#route"), null);

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
    /* 門檻從 30 調到 31,而**理由要寫下來,不然這就是「把期望值從現況抄過來」**
       (工具陷阱 12,這支自己登記過的)。
       這一輪新增的是一句:`flash("改不成:" + err.message)` ——
       它跟既有的 `刪不掉:` / `+1 沒成功:` 是**同一套**(寫入失敗的回饋走頁尾),
       不是第三套。而 `只改得動自己許的願望` 跟 `mayEdit()` 那句同形。
       **真正在防的那件事(那三句搬走的別回來)靠的是上面那幾條 `!flashed(...)`,
       它們量的是執行時有沒有出現,比數字面強。這一條只是漂移偵測。** */
    ok("flash() 的字面數沒有暴增(那三句沒回來,新增的是既有那一套的同類)",
      out.flash字面數 <= 31, out.flash字面數);
    out.sayHere字面數 = (d.documentElement.outerHTML.match(/sayHere\(/g) || []).length;

    /* ======================================================================
       14 ---- 說明和動作拆開:那句解釋對**所有人**顯示
       ======================================================================
       Lulu 回報的是:那三個沒有通行碼的人點了一列,地圖開了、沒有東西被聚焦、
       **而完全沒有任何解釋**。

       **這一段放在最後,因為它是單向的** —— `goOnline()` 之後回不到離線模式
       (要 reload),而上面每一段量的都是離線那一套。

       先量一次改之前的形狀:現在(離線、editable() 為 true)整條是看得到的。
       那不是這一輪的成果,是**對照的起點** —— 沒有它,下面那幾條紅了也分不出
       是「唯讀看不到」還是「整條都壞了」。 */
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
    wishRow(new RegExp(CLEAN)).click();
    await until(function () { return bar().hidden === false; });
    ok("【對照組】可編輯的時候,這一筆在地圖上**有**「再查一次」",
      q("#map-fix-go").hidden === false, q("#map-fix-go").outerHTML);

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
      /* **期望值不是從現況抄來的**:05 的比對量到那張卡高了 51px、
         位移搜尋說 `dy=+51`,那是這條斷言的獨立證據。 */
      ok("【對照組】窄視窗 + 可編輯 + 自己的願望 → 那一排**真的換行了**(改 + 刪掉 裝不下,05 因此變胖 51px)",
        rowsOf(wmEditable) === 2, out.可編輯時那一排);
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

    // 14b ---- 唯讀 + 別人的願望:**以前一個字都沒有,現在有解釋** ----
    /* 挑 w3(泡溫泉,chen_suchih 許的、沒挑地點):它同時踩到兩個以前會靜默的條件 ——
       不是我的(`mineWish` false)、而且沒有 place(所以本來就不會上地圖)。
       **這一筆正是 Lulu 描述的那個畫面。** */
    var other = wishRow(/泡溫泉/);
    ok("找得到別人許的那一筆(泡溫泉)", !!other, null);
    other.click();
    ok("唯讀 + 別人的願望 → **那一條出現了**(這一輪之前它是 hidden)",
      await until(function () { return bar().hidden === false; }), bar().outerHTML.slice(0, 160));
    ok("而且講的是為什麼它不在圖上,不是叫他去做什麼",
      /泡溫泉.*還沒挑地點/.test(barText()), barText());
    ok("唯讀 → 不畫「再查一次」(沒挑地點本來就不畫,這裡兩個理由都成立)",
      q("#map-fix-go").hidden === true, q("#map-fix-go").outerHTML);

    // 14c ---- 唯讀 + 自己的願望:說明在、「再查一次」搬走了 ----
    /* **用的是上面那筆對照組驗過的願望**,不是 w2 —— 見上面那段註解。
       同一筆、同一顆按鈕,唯一換掉的變數是 `editable()`。 */
    var mineRow = wishRow(new RegExp(CLEAN));
    ok("找得到自己許的那一筆(" + CLEAN + ")", !!mineRow, null);
    var netB14 = asked.length + osm.length;
    mineRow.click();
    ok("唯讀 + 自己的願望 → 說明照樣在",
      await until(function () { return bar().hidden === false && new RegExp(CLEAN).test(barText()); }), barText());
    ok("**「再查一次」不在地圖上了** —— 它搬進「改我的願望」裡(對照組同一筆是畫得出來的)",
      q("#map-fix-go").hidden === true, q("#map-fix-go").outerHTML);
    q("#map-fix-go").click();          /* 硬戳 DOM 也不該送出去 */
    await sleep(60);
    ok("而且硬戳它一次查詢都不發",
      asked.length + osm.length === netB14, { 之前: netB14, 之後: asked.length + osm.length });

    // 14d ---- 「對」不分身分:它不打 API,作用域只有這台裝置 ----
    /* **這一條要小心變成恆真。** 「對」只在 `asking`(有 ap、而且沒按過 ok)時才畫,
       而 w2 的座標是 fixture 灌的、沒有 ap —— 也就是說它在唯讀下**本來就該是 hidden**,
       量它等於什麼都沒量(工具陷阱 12 的形狀)。
       所以這裡不去斷言「它出現了」,改成斷言**它的判準裡沒有身分** ——
       做法是先問一個已經帶著 ok/ap 的那一筆(上面第 4 段按過「對」的淺草寺
       已經不在了,因為 pull() 換掉了 state.stops),所以這裡誠實登記:
       **唯讀下「對」有沒有畫出來,這支探針沒有量到**,理由寫在 wish-edit.md。 */
    out.唯讀下的對按鈕 = "**沒測到東西** —— asking 要 ap 且未確認,而 pull() 之後" +
      "手上沒有這種資料;不要把 14c 的綠燈讀成「對」也驗過了";

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
    out.唯讀下那一排 = {
      自己的行數: rowsOf(wmMine), 自己的高度: wmMine.offsetHeight,
      內容: [].map.call(wmMine.children, function (c) { return c.textContent.trim(); }),
    };
    ok("唯讀 → 多了「改」也沒有把那一排擠到第二行(他們沒有「刪掉」,所以裝得下)",
      rowsOf(wmMine) === 1, out.唯讀下那一排);

    // 14f ---- 唯讀的人真的改得動自己那一筆,而且送出去的形狀是對的 ----
    /* 先在**同一筆**(對照組那一筆)上看「再查一次」有沒有接上 ——
       入口搬家最容易的失敗是舊的拿掉了、新的沒接上,而那兩件事要在同一筆上問。 */
    mineRow.querySelector("[data-edit-wish]").click();
    ok("「改」打得開",
      await until(function () { return q("#wish-edit-overlay").hidden === false; }),
      q("#wish-edit-overlay").outerHTML.slice(0, 120));
    ok("**「再查一次」在這裡**(入口搬家的另一半:地圖上沒有了,這裡有)",
      q("#we-again").hidden === false, q("#we-again").outerHTML);
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
    ok("人工表就是答案的那一筆 → 編輯框裡也不畫「再查一次」(跟地圖上同一條規則)",
      q("#we-again").hidden === true, { 按鈕: q("#we-again").outerHTML, 快取: pins()["港灣未來"] });
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
  out.結論 = out.沒過的.length ? out.沒過的.length + " 項沒過" : "全部通過";
  document.getElementById("r").textContent = JSON.stringify(out, null, 2);
})();

return { 說明: "非同步,真正的結果會晚一點蓋掉這一段" };
