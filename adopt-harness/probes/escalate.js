// 搜尋的三段式(免費 → 提示 → 強力搜)。
//
// 為什麼要有這一支:第 3 段**會花錢**,而決定要不要走它的是前端的一個計數器。
// 那個計數器什麼時候加、什麼時候歸零,是這個功能唯一的成本控制 ——
// 算錯一次的後果不是畫面難看,是使用者在不知情的情況下打了一個付費端點。
//
// 樁:Nominatim 和 `?resource=geocode` 兩家都接手,分別記錄,才分得出
// 「第幾段真的走了哪一家」。**「沒發生」要有證據**,所以兩邊都計數。
var log = [], out = { 步驟: log, 沒過的: [] };
function ok(name, cond, extra) {
  log.push((cond ? "✓ " : "✗ ") + name + (cond ? "" : "   ← " + JSON.stringify(extra)));
  if (!cond) out.沒過的.push(name);
}
var sleep = function (ms) { return new Promise(function (r) { w.setTimeout(r, ms); }); };
var q = function (s) { return d.querySelector(s); };
async function until(fn, tries) {
  for (var i = 0; i < (tries || 120); i++) { if (fn()) return true; await sleep(50); }
  return false;
}
var osm = [], goo = [], osmReply = [], gooReply = { found: false };
var realFetch = w.fetch.bind(w);
w.fetch = function (u, init) {
  var url = String(u);
  if (url.indexOf("nominatim") >= 0) {
    osm.push(url);
    var a = osmReply;
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve(a); } });
  }
  if (url.indexOf("resource=geocode") >= 0) {
    goo.push(url);
    var b = gooReply;
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve(b); } });
  }
  return realFetch(u, init);
};
function btn(id) { return d.querySelector('[data-seek="' + id + '"]'); }
function boxText(id) { return d.getElementById(id + "-out").textContent; }
/* **等的是「這一次搜尋結束了」,不是「查詢送出去了」。**
   免費那家排在 1100ms 的佇列上,而按鈕在查詢期間是 disabled ——
   那是最誠實的「結束了沒」訊號,因為它就是程式自己用來擋重入的那個。
   第一版等 `osm.length` 變多就斷言,量到的是「搜尋中…」。 */
async function press(id) {
  var b = btn(id);
  b.click();
  await until(function () { return b.disabled; }, 40);
  return until(function () { return !b.disabled; }, 200);
}

(async function () {
  await sleep(0);   /* 陷阱 14-a */
  try {
    d.getElementById("add-stop-btn").click();
    await until(function () { return !q("#stop-form").hidden; });
    var inp = d.getElementById("sf-title");

    // ---- 第 1 段:免費,而且不給提示 ----
    osm.length = 0; goo.length = 0; osmReply = [];
    inp.value = "泡溫泉";
    await press("sf-title");
    ok("第 1 段問的是免費那家", osm.length === 1 && goo.length === 0, { osm: osm.length, google: goo.length });
    ok("第 1 段的按鈕還是「搜尋」", btn("sf-title").textContent === "搜尋", btn("sf-title").textContent);
    /* **第 1 次不給提示** —— 那時候還沒有「找不到」這件事,提早講等於預設他會失敗。 */
    ok("第 1 段不出現「加入車站」那句", boxText("sf-title").indexOf("車站或地點名") < 0, boxText("sf-title"));

    // ---- 第 2 段:提示出現,仍然免費 ----
    await press("sf-title");
    ok("第 2 段還是免費那家", osm.length === 2 && goo.length === 0, { osm: osm.length, google: goo.length });
    ok("第 2 段出現「試試加入車站或地點名」",
      boxText("sf-title").indexOf("車站或地點名") >= 0, boxText("sf-title"));
    ok("第 2 段的按鈕還是「搜尋」", btn("sf-title").textContent === "搜尋", btn("sf-title").textContent);

    // ---- 第 3 段:按鈕變樣子,但這一下還沒花錢 ----
    await press("sf-title");
    /* **這是最重要的一條。** 第 3 段只是把按鈕換掉,花錢的那一下永遠是
       使用者看著一顆長得不一樣的按鈕、再按一次。 */
    ok("第 3 段**仍然**只問免費那家(換按鈕不等於花錢)",
      osm.length === 3 && goo.length === 0, { osm: osm.length, google: goo.length });
    ok("第 3 段按鈕的字變成「強力搜」", btn("sf-title").textContent === "強力搜", btn("sf-title").textContent);
    ok("而且它看起來不一樣(有 seek-strong)",
      btn("sf-title").classList.contains("seek-strong"), btn("sf-title").className);
    ok("第 3 段講的是「還是沒有找到嗎」",
      boxText("sf-title").indexOf("還是沒有找到") >= 0, boxText("sf-title"));

    // ---- 第 4 下:這一下才走 Google ----
    gooReply = { found: true, la: 35.6267, lo: 139.7745, label: "富士電視台, 台場", precision: "exact" };
    await press("sf-title");
    ok("按下「強力搜」才真的問 Google", goo.length === 1, { google: goo.length });
    ok("而且那一下不再問免費那家", osm.length === 3, { osm: osm.length });
    ok("Google 的結果照樣畫成可以挑的候選",
      d.querySelectorAll('[data-hit="sf-title"]').length === 1,
      d.querySelectorAll('[data-hit="sf-title"]').length);

    // ---- 挑到了 → 段數歸零 ----
    d.querySelector('[data-hit="sf-title"]').click();
    await sleep(60);
    ok("挑到之後按鈕變回「搜尋」(不歸零的話,下一個地方會從花錢那段開場)",
      btn("sf-title").textContent === "搜尋", btn("sf-title").textContent);
    ok("挑到之後那一欄換成挑到的名字", inp.value === "富士電視台", inp.value);

    // ---- 換一個表單:段數不可以跨表單累積 ----
    osm.length = 0; goo.length = 0; osmReply = [];
    d.getElementById("add-wish-btn").click();
    await until(function () { return !q("#wish-form").hidden; });
    ok("換到許願表單,按鈕是「搜尋」不是「強力搜」",
      btn("wf-title").textContent === "搜尋", btn("wf-title").textContent);
    d.getElementById("wf-title").value = "泡溫泉";
    await press("wf-title");
    ok("而且它問的是免費那家", osm.length === 1 && goo.length === 0, { osm: osm.length, google: goo.length });

    // ---- 重開表單要歸零 ----
    for (var k = 0; k < 3; k++) { await press("wf-title"); }
    ok("連按之後確實升到第 3 段", btn("wf-title").textContent === "強力搜", btn("wf-title").textContent);
    d.getElementById("wf-cancel").click();
    await sleep(60);
    d.getElementById("add-wish-btn").click();
    await sleep(60);
    ok("關掉再打開 → 回到第 1 段", btn("wf-title").textContent === "搜尋", btn("wf-title").textContent);

    // ---- 舊的那顆按鈕真的不見了 ----
    ok("`#we-again`(再查一次)不存在了", !d.getElementById("we-again"), "還在");
  } catch (e) {
    out.爆掉了 = String((e && e.stack) || e);
  }
  out.結論 = out.沒過的.length ? out.沒過的.length + " 項沒過" : "全部通過";
  document.getElementById("r").textContent = JSON.stringify(out, null, 2);
})();

return { 說明: "非同步" };
