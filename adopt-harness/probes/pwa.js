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
  副本專屬那筆在畫面上: d.body.textContent.indexOf("只有離線副本裡才有的行程") > -1
};

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
} else {
  if (state.加行程鈕_藏起來 === true) bad.push("沒有副本(這台自己的紀錄)卻不能編輯,那份就沒人動得了");
}

return { 結論: bad.length ? bad : "✓ 全部通過", head: head, manifest: manifest, 圖示: icons,
         SHELL: shell, SHELL漏掉的: missingFromShell, 現在的狀態: state, 工具汙染: swGuard };
