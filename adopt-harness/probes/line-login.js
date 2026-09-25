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

/* 這支跑的時候後面沒有 Notion,開機那趟 `goOnline()` 失敗 → `goLocal()`。
   **那種狀態下不該擋一張登入畫面** —— 連不上伺服器就登不了 LINE,
   擺一張登不了的門在那裡,使用者唯一能做的是把它關掉。 */
ok("連不上後端時,不會擋一張登不了的登入畫面",
  !!q("#signin-overlay") && q("#signin-overlay").hidden === true,
  { hidden: q("#signin-overlay") && q("#signin-overlay").hidden });

/* 保險:萬一第一輪還沒把結果存好就被第二輪追上,講出來,不要拋一個
   看起來像程式壞掉的 TypeError。 */
if (!q("#signin-overlay")) return { 說明: "這是按下去之後那一頁,第一輪還沒收工" };

/* 以下量的是那張畫面本身,所以照 shoot.sh 20-signin-gate 的做法直接打開它。 */
q("#signin-overlay").hidden = false;

var line = q("#si-line"), read = q("#si-read"), admin = q("#si-admin");
ok("三條路都在:LINE、先看看、通行碼",
  !!line && !!read && !!admin, { line: !!line, read: !!read, admin: !!admin });
ok("而且說的是人話",
  !!line && /LINE/.test(line.textContent) && !!read && /看/.test(read.textContent),
  { line: line && line.textContent, read: read && read.textContent });

/* 「看得到但按不到」比「看不到」更糟 —— 所以問的是那個點上真的是誰。 */
function onTop(e) {
  if (!e) return false;
  var r = e.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  var hit = d.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!hit && (hit === e || e.contains(hit));
}
ok("LINE 那顆碰得到(不是被什麼蓋住)", onTop(line), line && line.getBoundingClientRect());
ok("「先看看就好」也碰得到 —— **不登入也要進得去**,那是這個網站講好的事", onTop(read));

/* LINE 的綠是它的品牌色,不是設計系統的色。哪天有人「統一風格」把它換掉,
   使用者會少掉「按下去會跳到 LINE」那個提示 —— 而那不會有任何地方報錯。 */
var bg = line ? w.getComputedStyle(line).backgroundColor.replace(/\s/g, "") : "(沒有這顆按鈕)";
ok("LINE 那顆用的是 LINE 的綠(rgb(6,199,85))", bg === "rgb(6,199,85)", bg);

/* 沒登入就不要在任何地方自稱登入了。 */
ok("沒登入時,上面那條不會出現「登出 LINE」",
  !/登出 LINE/.test((q("#cloud-ops") || {}).innerHTML || ""),
  (q("#cloud-ops") || {}).innerHTML);

/* 先看看就好 → 關掉,不登入也進得來 */
read.click();
ok("按「先看看就好」→ 門關上,人進得去", q("#signin-overlay").hidden === true);
q("#signin-overlay").hidden = false;

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
    after !== before && /\/api\/auth\?go=login$/.test(after), { 之前: before, 之後: after });

  out.結論 = out.沒過的.length ? out.沒過的.length + " 項沒過" : "全部通過";
  window.__lineLoginResult = out;
  /* #r 在**外層**頁面,不在 iframe 裡 */
  document.getElementById("r").textContent = JSON.stringify(out, null, 2);
})();

return { 說明: "非同步,真正的結果會晚一點蓋掉這一段" };
