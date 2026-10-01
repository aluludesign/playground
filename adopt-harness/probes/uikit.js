/* 強力搜換成 Places UI Kit(2026-10-02)。真的 Google 元件在這裡載不到,所以裝一個假的同名元件
 * (gmp-place-search / gmp-place-text-search-request),照官方範例的形狀:設 textQuery 就查、查完發 gmp-load、
 * 點一家發 gmp-select(event.place 有 id、displayName、formattedAddress、location)。
 *   WIDTH=390 ./probe.sh probes/uikit.js            有 Google 元件:清單是 Google 的;挑了記座標+編號,存行程時編號進 Notion
 *   PAGE='/index.html?nouikit=1' ./probe.sh ...      沒有(金鑰沒設):講清單載不出來(舊的強力搜 2026-10-02 拿掉了)
 *   PAGE='/index.html?strong=5/8' / strong=0/8       強力搜的每人次數:提示句寫剩幾次、先跟伺服器記一次;用完不給按
 *   PAGE='/index.html?ai=18/20&strong=5/8&gmperror=1'清單出錯(gmp-error):講清單載入出現錯誤,退回剛剛扣的那一次(只退一次) */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var noUI = /nouikit=1/.test(w.location.search);
var calls = () => (w.__calls || []).map(c => c.method + " " + c.url.replace(/^.*resource=/, ""));
/* 免費那段:回一筆不對的,讓人走到強力搜 */
var real = w.fetch;
w.fetch = function (u, i) {
  if (/nominatim/.test(String(u))) return Promise.resolve({ ok: true, json: () => Promise.resolve([{ lat: "35.6", lon: "139.7", display_name: "不是這間, 東京都, 日本" }]) });
  return real(u, i);
};
if (!noUI) {
  w.google = { maps: { importLibrary: () => Promise.resolve({}) } };
  /* **真的 Google 清單點下去,place 只有編號和座標**(官方:IDs, locations, viewports)—— 名字要 fetchFields 再問。
     noname=1:fetchFields 失敗(金鑰沒開 Places API (New)) */
  var failName = /noname=1/.test(w.location.search);
  var PLACE = { id: "ChIJ_fake_ichiran", location: { lat: () => 35.6905, lng: () => 139.7020 },
    fetchFields: function () { if (failName) return Promise.reject(new Error("API not activated"));
      this.displayName = "一蘭 新宿中央東口店"; this.formattedAddress = "東京都新宿區新宿3丁目34-11"; return Promise.resolve({ place: this }); } };
  w.customElements.define("gmp-place-search", class extends w.HTMLElement { get places() { return this._p || []; } });
  w.customElements.define("gmp-place-all-content", class extends w.HTMLElement {});
  w.customElements.define("gmp-place-text-search-request", class extends w.HTMLElement {
    set textQuery(v) { this._q = v; var ps = this.closest("gmp-place-search"); w.__uikitQuery = v; w.__uikitBias = this.locationBias;
      w.setTimeout(() => { ps._p = [PLACE]; ps.dispatchEvent(new w.Event("gmp-load")); }, 20); }
    get textQuery() { return this._q; }
  });
}
return (async function () {
  var out = { 模式: noUI ? "沒有 UI Kit" : "有 UI Kit" }, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  q("#add-stop-btn").click(); await wait(80);
  q("#sf-title").value = "一蘭";
  var b = q('[data-seek="sf-title"]');
  for (var k = 0; k < 2; k++) { b.click(); await wait(1400); }
  var arm = q('[data-arm="sf-title"]');
  var stQ = /strong=(\d+)\//.exec(w.location.search);
  if (stQ && +stQ[1] > 0) ok("強力搜的提示句旁邊寫今天還能用幾次", /今天還能用 \d+ 次/.test(txt("#sf-title-out")), txt("#sf-title-out"));
  if (!/strong=0\//.test(w.location.search)) ok("兩次沒挑到 → 出現強力搜", !!arm, txt("#sf-title-out"));
  if (arm) arm.click(); await wait(50);
  b.click(); await wait(400);
  if (stQ && +stQ[1] === 0) {
    out.用完 = { 提示: txt("#sf-title-out"), 清單: !!q("#stop-form gmp-place-search") };
    ok("強力搜用完(strong=0/8):不給強力搜那顆、講幾點重算", !arm && /強力搜用完了/.test(txt("#sf-title-out")) && !/免費/.test(txt("#sf-title-out")), out.用完);
    out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || []; return out;
  }
  if (noUI) {
    out.呼叫 = calls().filter(c => /mapskey|places/.test(c));
    ok("沒有 UI Kit(金鑰拿不到):不再走舊的強力搜,講「清單載入出現錯誤」", out.呼叫.some(c => /mapskey/.test(c)) && !out.呼叫.some(c => /^GET places/.test(c)) &&
      !q("#stop-form gmp-place-search") && /清單載入出現錯誤/.test(txt("#sf-title-out")) && !/免費/.test(txt("#sf-title-out")), { 呼叫: out.呼叫, 說: txt("#sf-title-out") });
  } else {
    var ps = q("#stop-form gmp-place-search");
    if (stQ) {
      var used = (w.__calls || []).filter(c => /\/api\/ai\?strong=1/.test(c.url) && c.method === "POST").length;
      ok("清單出來之前先跟伺服器記一次強力搜", used === 1, used);
    }
    if (/gmperror=1/.test(w.location.search)) {
      ps.dispatchEvent(new w.Event("gmp-error")); ps.dispatchEvent(new w.Event("gmp-error")); await wait(200);
      var refunds = (w.__calls || []).filter(c => /refund=1/.test(c.url));
      out.出錯 = { 說: txt("#sf-title-out"), 退了幾次: refunds.length, 收據: refunds[0] && refunds[0].body.ticket };
      q("#menu-btn").click(); await wait(80); out.出錯.選單 = txt("#menu-ai"); q("#menu-btn").click();
      ok("清單出錯 → 講清單載入出現錯誤、退回那一次(錯兩次也只退一次)、選單回到 5／8",
        /清單載入出現錯誤/.test(out.出錯.說) && refunds.length === 1 && out.出錯.收據 === "t4" && /強力搜:還能用 5／8 次/.test(out.出錯.選單), out.出錯);
      out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || []; return out;
    }
    out.清單 = !!ps; out.查的字 = w.__uikitQuery; out.偏重 = w.__uikitBias;
    ok("強力搜 → Google 的清單出現,查的是輸入框的字、偏重這一團的城市", out.清單 && out.查的字 === "一蘭" && out.偏重 && Math.abs(out.偏重.lat - 35.68) < 0.1, out);
    ok("沒有打舊的強力搜(places)", !calls().some(c => /^GET places/.test(c)), calls());
    out.照片 = !!q("#stop-form gmp-place-search gmp-place-media");
    ok("清單內容有照片那一項(gmp-place-all-content 不帶照片)", out.照片, "");
    var ev = new w.Event("gmp-select"); ev.place = PLACE; ps.dispatchEvent(ev); await wait(150);
    var want = failName ? "一蘭" : "一蘭 新宿中央東口店";
    out.挑了 = { 輸入框: q("#sf-title").value, 狀態: txt("#sf-title-out") };
    var pin = JSON.parse(w.localStorage.getItem("tokyo5-pin3") || "{}")[want] || {};
    out.記下 = { la: pin.la, pid: pin.pid, 有日期: !!pin.t, src: pin.src };
    if (failName) ok("問不到名字:用打的字當名字,座標和編號照樣記下、已標定", out.挑了.輸入框 === "一蘭" && /已標定/.test(out.挑了.狀態) &&
      pin.la === 35.6905 && pin.pid === "ChIJ_fake_ichiran", out);
    else ok("挑了一家:名字(問 Google 拿到的)填進去、狀態講已標定+地址;手機記座標、編號、日期", out.挑了.輸入框 === "一蘭 新宿中央東口店" && /已標定/.test(out.挑了.狀態) && /新宿區/.test(out.挑了.狀態) &&
      pin.la === 35.6905 && pin.pid === "ChIJ_fake_ichiran" && !!pin.t && pin.src === "google", out);

    q("#sf-time").value = "12:00";
    q("#stop-form").requestSubmit(); await wait(400);
    var post = (w.__calls || []).filter(c => c.method === "POST" && /resource=itinerary/.test(c.url)).pop();
    out.存進Notion = post && post.body && post.body.placeId;
    ok("存行程:地點編號跟著送進 Notion", out.存進Notion === "ChIJ_fake_ichiran", post && post.body);
  }
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過";
  out.errors = w.__errors || [];
  return out;
})();
