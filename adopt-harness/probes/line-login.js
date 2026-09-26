// 登入畫面那一張,以及「用 LINE 登入」按下去會去哪裡。
//
// **為什麼要獨立一支,不併進 geofix**:最後一條斷言會讓 iframe 真的導覽出去。
// 那是這裡唯一能證明「按下去不是裝飾」的方法 —— 但它一走,後面的斷言就沒有頁面
// 可以量了,而**沒有跑到的斷言不會出現在「沒過的」裡**。併進去等於在一支很長的
// 探針中間挖一個無聲的洞。
//
// **這一支量不到的是整個登入本身**:cookie 有沒有簽章、state 有沒有比對、
// LINE 不回應時會不會一直掛著 —— 那些發生在伺服器上,瀏覽器看不到。
// 它們在 `adopt-harness/api-auth-test.js`,那支有拆掉每一道防線的反向對照。
//
//   ./probe.sh probes/line-login.js
//   WIDTH=390 ./probe.sh probes/line-login.js

/* **按下去會導覽,而導覽會讓 iframe 的 onload 再響一次** —— probe.sh 綁在
   onload 上,所以整支探針會在「按完之後那一頁」上再跑一遍:那頁一顆按鈕都沒有,
   於是斷言全紅,而且會把第一輪的真實結果**蓋掉**。查了兩輪才看出紅的是第二輪。
   所以第一輪的結果存在外層視窗上,第二輪原樣還回去。
   (`window` 是外層的,`w` 才是 iframe 的 —— 外層不受這次導覽影響。) */
if (window.__lineLoginResult) return window.__lineLoginResult;

var log = [], out = { 步驟: log, 沒過的: [] };
function ok(name, cond, extra) {
  log.push((cond ? "✓ " : "✗ ") + name + (cond ? "" : "   ← " + JSON.stringify(extra)));
  if (!cond) out.沒過的.push(name);
}
var q = function (sel) { return d.querySelector(sel); };
/* **計時器要用外層視窗的。** iframe 一導覽,它自己那個 window 上排隊的 setTimeout
   全部被丟掉 —— 而等導覽正是這支最後一條斷言在做的事。用 `w.setTimeout` 的話,
   那個迴圈會在按下去的瞬間無聲停住,結果永遠寫不回去(第一版就是這樣)。 */
var sleep = function (ms) { return new Promise(function (r) { window.setTimeout(r, ms); }); };

/* **第 2 期:沒登入就只有這一張卡。** 以前的門有三條路(LINE、先看看、通行碼),
   「先看看」是因為讀是公開的;第 2 期起別人的團要擋(Lulu 2026-09-26),通行碼也拿掉了 ——
   所以門上只剩 LINE 一條,而且門後面**一個字的行程都不該在**。
   要用 PAGE='/index.html?fake=anon' 跑:預設的 fixture 是已經登入的團主。 */
if (!/fake=anon/.test(w.location.search)) {
  if (/api\/auth/.test(w.location.href)) return { 說明: "這是按下去之後那一頁,第一輪還沒收工" };
  return { 結論: "✗ 這一支要 PAGE='/index.html?fake=anon' 才跑得動(預設是已經登入的團主)" };
}
var home = q("#home-overlay");
ok("沒登入 → 門是開著的", !!home && home.hidden === false, home && home.hidden);
var line = q("#h-line");
var btns = [].map.call(d.querySelectorAll("#home-card .btn"), function (b) { return b.textContent.trim(); });
/* 「我有登入碼」和它的「登入」是 LINE 那條路的後半段(主畫面 App 在瀏覽器登入完回來貼碼),
   不是另一條進門的路。這裡擋的是「先看看」和通行碼回來。 */
var other = btns.filter(function (t) { return !/LINE|登入碼|^登入$/.test(t); });
ok("門上只有 LINE 那條路(沒有「先看看」,沒有通行碼)", !!line && other.length === 0, btns);
ok("而且說的是人話", !!line && /LINE/.test(line.textContent), line && line.textContent);

/* 「看得到但按不到」比「看不到」更糟 —— 所以問的是那個點上真的是誰。 */
function onTop(e) {
  if (!e) return false;
  var r = e.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  var hit = d.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!hit && (hit === e || e.contains(hit));
}
ok("LINE 那顆碰得到(不是被什麼蓋住)", onTop(line), line && line.getBoundingClientRect());

/* LINE 的綠是它的品牌色,不是設計系統的色。哪天有人「統一風格」把它換掉,
   使用者會少掉「按下去會跳到 LINE」那個提示 —— 而那不會有任何地方報錯。 */
var bg = line ? w.getComputedStyle(line).backgroundColor.replace(/\s/g, "") : "(沒有這顆按鈕)";
ok("LINE 那顆用的是 LINE 的綠(rgb(6,199,85))", bg === "rgb(6,199,85)", bg);

/* **門後面不能有這一團的任何東西。** 門是蓋在畫面上的一層,拿掉那一層(開發者工具就做得到)
   底下如果已經畫好行程,那就不是擋,是擺設。 */
ok("門後面沒有行程、沒有團名(沒登入就沒有讀任何資料)",
  d.querySelectorAll(".stop").length === 0 && /^Trippps$/.test((q("#trip-name") || {}).textContent || ""),
  { stops: d.querySelectorAll(".stop").length, h1: (q("#trip-name") || {}).textContent });
ok("而且只問過「我是誰」,一支資料的 API 都沒打",
  (w.__calls || []).every(function (c) { return /auth\?go=me/.test(c.url); }),
  (w.__calls || []).map(function (c) { return c.url; }));

/* 沒登入就不要在任何地方自稱登入了。 */
ok("沒登入時,上面那條不會出現「登出」",
  !/登出/.test((q("#cloud-ops") || {}).innerHTML || ""),
  (q("#cloud-ops") || {}).innerHTML);

/* ---- 最後一條:按下去真的離開這一頁,而且去的是 LINE 那條路。
       前面的斷言只證明那顆按鈕長得對。**一顆長得對但沒接線的按鈕,
       畫面上跟接好的一模一樣。**

       `location.href = …` 是非同步的,設完當下讀回來還是舊網址 ——
       第一版就是這樣判成「沒有導覽」的。所以這裡要等。 ---- */
(async function () {
  var before = String(w.location.href);
  if (line) line.click();
  for (var i = 0; i < 60 && String(w.location.href) === before; i++) await sleep(50);
  var after = String(w.location.href);
  ok("按下去 → 真的往 /api/auth?go=login 走",
    after !== before && /\/api\/auth\?go=login&/.test(after), { 之前: before, 之後: after });
  /* 帶著回來的路:邀請連結(/?t=…&i=…)登入完要回到這裡,不是首頁 */
  ok("而且帶著「登入完回到這一頁」(back= 是現在這一頁,含團代號)",
    /back=%2Findex\.html%3F[^&]*t%3Dfixture1/.test(after), after);

  out.結論 = out.沒過的.length ? out.沒過的.length + " 項沒過" : "全部通過";
  window.__lineLoginResult = out;
  /* #r 在**外層**頁面,不在 iframe 裡 */
  document.getElementById("r").textContent = JSON.stringify(out, null, 2);
})();

return { 說明: "非同步,真正的結果會晚一點蓋掉這一段" };
