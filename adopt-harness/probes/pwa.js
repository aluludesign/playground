// PWA 那幾件事的證據。
//
//   ./probe.sh probes/pwa.js            線上那一套(head 標籤、清單、圖示)
//   SNAP=1 ./probe.sh probes/pwa.js     再加上「離線 · 有副本」那個狀態
//
// 為什麼這支要存在:PWA 壞掉的方式**全部是無聲的**。
//   · sw.js 的 SHELL 少列一個檔 → 線上完全正常,只有斷線的人看到半個網站
//   · manifest 裡的圖示路徑打錯 → 加到主畫面才發現是白的
//   · icon.svg 改了但忘了重跑 make-icons.sh → PNG 停在舊的
//   · 離線副本沒讀到 → 畫面照常渲染,只是行程是空的
// 沒有一項會在 console 出現紅字,四項都要有人主動去問才問得出來。
//
// 用同步的 XMLHttpRequest 去抓檔案。probe.sh 是把回傳值直接 JSON.stringify 的,
// 沒有等 Promise 的地方 —— 在這裡同步是唯一能用的形狀,不是偷懶。
function get(url) {
  try {
    var x = new w.XMLHttpRequest();
    x.open("GET", url, false);
    x.send();
    return { status: x.status, text: x.responseText, len: (x.responseText || "").length };
  } catch (e) {
    return { status: 0, text: "", len: 0, error: String(e) };
  }
}
var abs = function (p) { return new w.URL(p, w.location.href).href; };
var meta = function (n) { var m = d.querySelector('meta[name="' + n + '"]'); return m && m.content; };

/* --- head 的標籤 --- */
var manifestHref = (d.querySelector('link[rel="manifest"]') || {}).getAttribute
  ? d.querySelector('link[rel="manifest"]').getAttribute("href") : null;
var head = {
  manifest: manifestHref,
  themeColor: meta("theme-color"),
  appleTouchIcon: (d.querySelector('link[rel="apple-touch-icon"]') || {}).getAttribute
    ? d.querySelector('link[rel="apple-touch-icon"]').getAttribute("href") : null,
  appleCapable: meta("apple-mobile-web-app-capable"),
  appleTitle: meta("apple-mobile-web-app-title"),
  appleStatusBar: meta("apple-mobile-web-app-status-bar-style"),
  // 舊的 emoji favicon 換掉了沒有。留著的話 iOS 會拿它去縮。
  favicons: [].slice.call(d.querySelectorAll('link[rel="icon"]')).map(function (l) {
    return l.getAttribute("href").slice(0, 40);
  })
};

/* --- manifest 本身 --- */
var mf = manifestHref ? get(abs(manifestHref)) : { status: 0 };
var manifest = null, manifestError = null;
if (mf.status === 200) {
  try { manifest = JSON.parse(mf.text); } catch (e) { manifestError = String(e); }
} else if (manifestHref) {
  manifestError = "HTTP " + mf.status;
}
var icons = (manifest && manifest.icons || []).map(function (ic) {
  var r = get(abs(ic.src));
  return { src: ic.src, sizes: ic.sizes, purpose: ic.purpose, status: r.status, bytes: r.len };
});

/* --- sw.js 的 SHELL 要對得上真的檔案 --- */
var sw = get(abs("sw.js"));
var shell = [], shellError = null;
if (sw.status === 200) {
  var m = sw.text.match(/const SHELL\s*=\s*\[([\s\S]*?)\]/);
  if (!m) shellError = "sw.js 裡找不到 SHELL 陣列 —— 這支探針跟它對不上了,要改";
  else {
    var paths = m[1].match(/"([^"]+)"/g) || [];
    shell = paths.map(function (q) {
      var p = q.slice(1, -1);
      var r = get(abs(p));
      return { path: p, status: r.status, bytes: r.len };
    });
  }
} else {
  shellError = "sw.js 拿不到(HTTP " + sw.status + ")";
}

/* index.html 真正載入的同網域檔案,有沒有全部進 SHELL。
   反過來這一邊才是會爛的那一邊:新增一個 <link> 忘了加進清單,
   線上看不出來,離線就少那一塊。 */
var inShell = {};
shell.forEach(function (s) { inShell[abs(s.path)] = 1; });
var sameOrigin = [].slice.call(d.querySelectorAll('link[rel="stylesheet"], script[src], link[rel="icon"]'))
  .map(function (e) { return abs(e.getAttribute("href") || e.getAttribute("src")); })
  .filter(function (u) { return u.indexOf(w.location.origin) === 0; });
var missingFromShell = sameOrigin.filter(function (u) {
  return !inShell[u] && u.indexOf("data:") !== 0;
}).map(function (u) { return u.replace(w.location.origin, ""); });

/* --- 現在這一頁處在哪個狀態 --- */
var snapRaw = null;
try { snapRaw = w.localStorage.getItem("tokyo5-snap"); } catch (e) {}
var hidden = function (id) { var b = d.getElementById(id); return b ? b.hidden : "沒有這顆按鈕"; };
var state = {
  有離線副本: !!snapRaw,
  狀態列: (d.getElementById("cloud-msg") || {}).textContent,
  頁尾說明: ((d.getElementById("backup-note") || {}).textContent || "").slice(0, 30),
  加行程鈕_藏起來: hidden("add-stop-btn"),
  加花費鈕_藏起來: hidden("add-exp-btn"),
  匯入鈕_藏起來: hidden("import-btn"),
  行程筆數: d.querySelectorAll(".stop").length,
  改行程的筆_幾支: d.querySelectorAll(".stop [data-edit], .stop .edit").length,
  // 副本專屬的那一筆在不在畫面上 —— 在,才證明顯示的真的是副本而不是 LS
  副本專屬那筆在畫面上: d.body.textContent.indexOf("只有離線副本裡才有的行程") > -1,
  /* --- 快照模式下的「改我的願望」 ---
     「改」的判準刻意不是 editable()(那三個沒有通行碼的人要改得動自己的願望),
     而 editable() 在快照模式下也是 false —— 於是它連帶繞過了「你在看一份副本」。
     症狀:橫幅說「不能編輯」、加行程和刪掉都不見了,「改」還在,點下去表單真的開,
     按「存起來」畫面會變而 saveLocal() 什麼都沒寫。
     `自己那筆願望在畫面上` 是對照組:沒有它,「改 0 顆」可能只是因為
     畫面上根本沒有自己的願望 —— 那種綠燈什麼都沒證明。 */
  自己那筆願望在畫面上: d.querySelectorAll("#wish-list .wish.mine").length,
  願望的_改_幾顆: d.querySelectorAll("#wish-list [data-edit-wish]").length,
  // 既有行為(判準是 editable()),放在這裡只是當旁證,不下斷言 ——
  // 它改動前後都是 0,斷言它證明不了這一輪的任何事。
  願望的_刪掉_幾顆: d.querySelectorAll("#wish-list [data-del-wish]").length,
  編輯框_藏起來: hidden("wish-edit-overlay")
};

/* 第二層:按鈕不畫是一回事,**手動戳一顆進 DOM 再點**是另一回事。
   openWishEdit() 有一層自己的判準,那一層也要擋。
   這一段刻意放在上面所有量測之後,免得注入的節點影響任何盤點。 */
var poke = { 做了嗎: false, 為什麼沒做: "畫面上沒有 .wish.mine" };
var mineRow = d.querySelector("#wish-list .wish.mine");
if (mineRow) {
  var fake = d.createElement("button");
  fake.type = "button";
  fake.setAttribute("data-edit-wish", mineRow.getAttribute("data-wish") || "");
  (mineRow.querySelector(".wm") || mineRow).appendChild(fake);
  fake.click();   // 走的是 #wish-list 上那個真的委派監聽器
  poke = { 做了嗎: true, 戳的是: fake.getAttribute("data-edit-wish"),
           戳完編輯框藏起來: hidden("wish-edit-overlay") };
  fake.parentNode.removeChild(fake);
}

/* --- 工具自己不要變成汙染源 --- */
// probe.sh / shoot.sh 跑在 http://localhost 上,而 localhost 算安全來源,
// service worker 裝得起來。裝起來就會跨執行活著,下一輪量到的可能是上一輪的快取。
// index.html 用 `location.protocol === "https:"` 擋掉了,這裡確認那道擋板還在。
var swGuard = {
  這一頁的協定: w.location.protocol,
  有沒有被_serviceWorker_接管: !!(w.navigator.serviceWorker && w.navigator.serviceWorker.controller),
  index裡的https判斷還在: get(abs("index.html")).text.indexOf('location.protocol === "https:"') > -1
};

/* --- 結論 --- */
var bad = [];
if (!head.manifest) bad.push("head 裡沒有 <link rel=manifest>");
if (!head.themeColor) bad.push("沒有 theme-color");
if (!head.appleTouchIcon) bad.push("沒有 apple-touch-icon,iOS 加到主畫面會沒圖");
if (manifestError) bad.push("manifest 讀不到或壞了:" + manifestError);
if (manifest && !icons.length) bad.push("manifest 裡一個圖示都沒有");
icons.forEach(function (i) { if (i.status !== 200) bad.push("圖示拿不到:" + i.src + "(HTTP " + i.status + ")"); });
if (!icons.some(function (i) { return (i.purpose || "").indexOf("maskable") > -1; }))
  bad.push("沒有 maskable 圖示,Android 會自己補一圈白底");
if (shellError) bad.push(shellError);
shell.forEach(function (s) { if (s.status !== 200) bad.push("SHELL 列了但檔案不存在:" + s.path + "(HTTP " + s.status + ")"); });
if (missingFromShell.length) bad.push("這幾個檔頁面會載入但 SHELL 沒列,離線會缺:" + missingFromShell.join(" "));
if (swGuard.有沒有被_serviceWorker_接管) bad.push("探針這一頁被 service worker 接管了 —— 量到的可能是快取,結論不可信");
if (!swGuard.index裡的https判斷還在) bad.push("index.html 的 https 判斷不見了,harness 會被 service worker 汙染");
if (snapRaw) {
  if (state.加行程鈕_藏起來 !== true) bad.push("有離線副本卻還能加行程 —— 改了會無聲消失");
  if (state.匯入鈕_藏起來 !== true) bad.push("有離線副本卻還能匯入,會蓋掉副本");
  if (!state.副本專屬那筆在畫面上) bad.push("副本沒被讀到 —— 畫面上是 LS 的資料,這正是要修的那個 bug");
  if (!/離線 · 這是 \d\d\/\d\d \d\d:\d\d 讀到的資料/.test(state.狀態列 || ""))
    bad.push("狀態列沒說出這份資料是什麼時候讀的:" + state.狀態列);
  // 對照組:沒有這一條,下面兩條在「畫面上沒有自己的願望」時會空著綠
  if (state.自己那筆願望在畫面上 < 1)
    bad.push("對照組不成立:快照畫面上一筆 .wish.mine 都沒有,下面那兩條沒有東西可證明");
  if (state.願望的_改_幾顆 !== 0)
    bad.push("有離線副本(橫幅自己說「不能編輯」)卻還畫得出「改」" + state.願望的_改_幾顆 +
             " 顆 —— 點下去表單會開,而按「存起來」時 saveLocal() 開頭就 return," +
             "畫面會變、什麼都沒存,重新整理就沒了");
  if (poke.做了嗎 && poke.戳完編輯框藏起來 !== true)
    bad.push("手動戳一顆 data-edit-wish 進去再點,快照模式下編輯框照樣開了 —— openWishEdit() 那一層沒擋");
} else {
  if (state.加行程鈕_藏起來 === true) bad.push("沒有副本(這台自己的紀錄)卻不能編輯,那份就沒人動得了");
  /* **反過來的那一半。** 上面那兩條(快照下「改」不見、戳也戳不開)如果是靠
     「把功能整個關掉」換來的,它們一樣會是綠的 —— 而這一輪的目的正好相反:
     讓沒有通行碼的人改得動自己那一筆。所以在**沒有副本**的同一支探針裡
     釘住「它還在、而且開得了」。期望值來自那個決定,不是來自現況。 */
  if (state.自己那筆願望在畫面上 >= 1 && state.願望的_改_幾顆 < 1)
    bad.push("沒有副本卻也畫不出「改」 —— 擋快照模式的時候把功能整個關掉了");
  if (poke.做了嗎 && poke.戳完編輯框藏起來 !== false)
    bad.push("沒有副本,點「改」卻開不了編輯框 —— 同上");
}

return { 結論: bad.length ? bad : "✓ 全部通過", head: head, manifest: manifest, 圖示: icons,
         SHELL: shell, SHELL漏掉的: missingFromShell, 現在的狀態: state,
         戳一顆改進去: poke, 工具汙染: swGuard };
