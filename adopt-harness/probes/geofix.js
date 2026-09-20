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
    await until(function () { return d.querySelectorAll(".map .pin").length >= 4; });
    ok("只開地圖(= 06 / 07 的狀態)時仍然 hidden", bar().hidden === true, barText());
    ok("地圖有畫出 pin(確認這一輪真的跑起來了)", d.querySelectorAll(".map .pin").length >= 4,
      d.querySelectorAll(".map .pin").length);

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

    // 5 ---- 點一列「沒標上去」的:泡溫泉 ----
    flashes.length = 0; asked.length = 0;
    var wish = [].slice.call(d.querySelectorAll("#wish-list [data-wish]"))
      .filter(function (r) { return /泡溫泉/.test(r.textContent); })[0];
    ok("找得到泡溫泉那一列", !!wish, null);
    wish.click();
    ok("沒標上去的文案不一樣", await until(function () { return /泡溫泉.*沒標上去/.test(barText()); }),
      barText());
    var nWish = d.querySelectorAll(".map .pin").length;
    reply = { body: { found: false } };
    q("#map-fix-go").click();
    ok("查無 → 誠實說還是找不到", await until(function () { return flashed(/還是找不到/); }), flashes);
    ok("查無 → 不假裝有結果(快取仍然是 null)", pins()["泡溫泉"] === null, pins()["泡溫泉"]);
    ok("查無 → 地圖上沒有多出一顆 pin", d.querySelectorAll(".map .pin").length === nWish,
      { 之前: nWish, 之後: d.querySelectorAll(".map .pin").length });

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
  } catch (e) {
    out.爆掉了 = String((e && e.stack) || e);
  }
  out.結論 = out.沒過的.length ? out.沒過的.length + " 項沒過" : "全部通過";
  document.getElementById("r").textContent = JSON.stringify(out, null, 2);
})();

return { 說明: "非同步,真正的結果會晚一點蓋掉這一段" };
