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
var osm = [], goo = [], osmReply = [], gooReply = { found: false }, gooStatus = 200;
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
    /* `gooStatus` 不是 200 的時候模擬伺服器回錯誤 —— `api()` 會 throw,
       而「throw 之後使用者看到什麼」正是這一輪咬到 Lulu 的那條路。 */
    return Promise.resolve({
      ok: gooStatus === 200, status: gooStatus,
      json: function () { return Promise.resolve(b); },
    });
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

    // ---- 第 1 次:免費,而且搜完就給「加地點名」 ----
    /* **提示在第 1 次搜完就出現,不是第 2 次。** Lulu 的流程是
       「打泡溫泉 → 搜 → 沒找到?試試加入地點名 → 照做 → 再搜 → 要不要強力搜?」
       —— 提示是那個流程的第一步,晚一次給就等於少一次機會。 */
    osm.length = 0; goo.length = 0; osmReply = [];
    inp.value = "泡溫泉";
    await press("sf-title");
    ok("第 1 次問免費那家", osm.length === 1 && goo.length === 0, { osm: osm.length, google: goo.length });
    ok("第 1 次搜完就給「加地點名」", boxText("sf-title").indexOf("加入地點名") >= 0, boxText("sf-title"));
    ok("第 1 次**不問**要不要強力搜", boxText("sf-title").indexOf("強力搜") < 0, boxText("sf-title"));
    ok("按鈕還是「搜尋」", btn("sf-title").textContent === "搜尋", btn("sf-title").textContent);

    // ---- 照提示加了字:段數**不可以**歸零 ----
    /* **這一條是 Lulu 回報「看不懂觸發點」的根因。** 第一版一改字就重來,
       而提示叫的正是「加地點名」—— 照做的人段數永遠回到 0,走不到那顆「好」。
       **提示叫人做的事,不可以讓他退回起點。** */
    inp.value = "泡溫泉 新宿";
    await press("sf-title");
    ok("加了字之後再搜,仍然是第 2 次(沒有因為改字歸零)",
      boxText("sf-title").indexOf("還是沒有找到嗎") >= 0, boxText("sf-title"));
    ok("而且這時候才問要不要強力搜",
      !!d.querySelector('[data-arm="sf-title"]'), boxText("sf-title"));
    ok("按鈕**還沒**變成強力搜(要先點頭)",
      btn("sf-title").textContent === "搜尋", btn("sf-title").textContent);
    ok("而且到這裡為止一次錢都沒花", goo.length === 0, { google: goo.length });

    // ---- 點「好」才變,而且那一下不查東西 ----
    d.querySelector('[data-arm="sf-title"]').click();
    await sleep(60);
    ok("點「好」之後按鈕變成「強力搜」", btn("sf-title").textContent === "強力搜", btn("sf-title").textContent);
    /* **量的是 class,不是 backgroundColor。** `.btn` 有 `transition:background .15s`,
       所以 computed 讀到的是過場跑到一半的值 —— 而在虛擬時間下它可能一幀都沒跑,
       讀到的就是起始的白色。我為了這件事查了五輪,而**同一個陷阱幾小時前才寫進
       `drawer-steps.md`**(那次是 `transition:width`,量 rect 讀到中間值)。

       **顏色對不對由截圖回答**(第 14 張),斷言只管狀態有沒有切過去。 */
    ok("而且掛上了 seek-strong(橘色那一組的來源)",
      btn("sf-title").classList.contains("seek-strong"), btn("sf-title").className);
    ok("**點「好」那一下不查任何東西**(花錢的是下一下)",
      osm.length === 2 && goo.length === 0, { osm: osm.length, google: goo.length });
    ok("而且它告訴你下一步做什麼", boxText("sf-title").indexOf("按「強力搜」") >= 0, boxText("sf-title"));

    // ---- 按下強力搜才走 Google ----
    gooReply = { found: true, la: 35.6267, lo: 139.7745, label: "富士電視台, 台場", precision: "exact" };
    await press("sf-title");
    ok("按「強力搜」才問 Google", goo.length === 1, { google: goo.length });
    ok("而且那一下不再問免費那家", osm.length === 2, { osm: osm.length });
    ok("Google 的結果照樣畫成可以挑的候選",
      d.querySelectorAll('[data-hit="sf-title"]').length === 1,
      d.querySelectorAll('[data-hit="sf-title"]').length);

    // ---- 挑到 → 全部歸零 ----
    d.querySelector('[data-hit="sf-title"]').click();
    await sleep(60);
    ok("挑到之後按鈕變回「搜尋」", btn("sf-title").textContent === "搜尋", btn("sf-title").textContent);
    ok("挑到之後那一欄換成挑到的名字", inp.value === "富士電視台", inp.value);

    // ---- 強力搜也找不到:退回免費,並說「找不到也沒關係」 ----
    osm.length = 0; goo.length = 0; osmReply = []; gooReply = { found: false };
    inp.value = "查不到的那種";
    await press("sf-title"); await press("sf-title");
    d.querySelector('[data-arm="sf-title"]').click();
    await sleep(60);
    await press("sf-title");
    ok("強力搜真的送出去了", goo.length === 1, { google: goo.length });
    ok("找不到 → 按鈕退回「搜尋」(再按一次是同一個字問同一家,白花錢)",
      btn("sf-title").textContent === "搜尋", btn("sf-title").textContent);
    ok("講的是「還是可以許願」,不是「再試試」",
      boxText("sf-title").indexOf("還是可以許願") >= 0, boxText("sf-title"));
    osm.length = 0; goo.length = 0;
    await press("sf-title");
    ok("退回之後再按,問的是免費那家(不會又花一次錢)",
      osm.length === 1 && goo.length === 0, { osm: osm.length, google: goo.length });

    // ---- 換表單不可以帶著段數 ----
    osm.length = 0; goo.length = 0;
    d.getElementById("add-wish-btn").click();
    await until(function () { return !q("#wish-form").hidden; });
    ok("換到許願表單,按鈕是「搜尋」", btn("wf-title").textContent === "搜尋", btn("wf-title").textContent);

    // ---- 伺服器回錯誤時,要轉述它的原話 ----
    /* **這條就是咬到 Lulu 的那條。** preview 沒有 `GEOCODE_KEY`,伺服器明白回了
       「伺服器還沒設定 GEOCODE_KEY」,而第一版的 `catch (_)` 把它吃掉,
       換成我編的「可能是今天的查詢次數用完了」。 */
    d.getElementById("wf-title").value = "某個查不到的";
    await press("wf-title"); await press("wf-title");
    d.querySelector('[data-arm="wf-title"]').click();
    await sleep(60);
    gooStatus = 503; gooReply = { error: "伺服器還沒設定 GEOCODE_KEY,強力搜目前不能用" };
    await press("wf-title");
    ok("伺服器講得出原因時,畫面轉述它的原話",
      boxText("wf-title").indexOf("GEOCODE_KEY") >= 0, boxText("wf-title"));
    ok("**不會換成自己編的原因**(例如「次數用完了」)",
      boxText("wf-title").indexOf("次數用完") < 0, boxText("wf-title"));
    gooStatus = 200;

    // ---- 舊的那顆按鈕真的不見了 ----
    ok("`#we-again`(再查一次)不存在了", !d.getElementById("we-again"), "還在");
  } catch (e) {
    out.爆掉了 = String((e && e.stack) || e);
  }
  out.結論 = out.沒過的.length ? out.沒過的.length + " 項沒過" : "全部通過";
  document.getElementById("r").textContent = JSON.stringify(out, null, 2);
})();

return { 說明: "非同步" };
