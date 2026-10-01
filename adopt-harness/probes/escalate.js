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
/* **連不上跟伺服器拒絕是兩條不同的路。** `gooStatus !== 200` 走的是
   「伺服器講得出原因」那條(`res.錯`);`gooThrow` 讓 fetch 自己倒掉,
   走的是 `!res` 那條 —— 兩條各有自己的 return,不能只測一條就當測過。 */
var gooThrow = false;
var realFetch = w.fetch.bind(w);
w.fetch = function (u, init) {
  var url = String(u);
  if (url.indexOf("nominatim") >= 0) {
    osm.push(url);
    var a = osmReply;
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve(a); } });
  }
  if (url.indexOf("resource=places") >= 0) {
    goo.push(url);
    if (gooThrow) return Promise.reject(new Error("斷線"));
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
    ok("第 1 次問免費那家(城市裡沒有 → 再放寬問一次,所以是 2 次)", osm.length === 2 && /bounded=1/.test(osm[0]) && osm[1].indexOf("bounded") < 0 && goo.length === 0, { osm: osm.length, google: goo.length });
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
    /* **那顆按鈕長在句子裡,不是旁邊。** 以前是「還是沒有找到嗎?試試強力搜?」
       後面接一顆獨立的「好」—— 要人先讀懂問題,再去別的地方找答案在哪。 */
    ok("而且它長在提示句子裡面(不是旁邊一顆「好」)",
      !!d.querySelector('.seek-out .hint .seek-arm[data-arm="sf-title"]'),
      d.querySelector('.seek-out .hint') && d.querySelector('.seek-out .hint').innerHTML);
    ok("而且那三個字就是「強力搜」",
      d.querySelector('[data-arm="sf-title"]').textContent === "強力搜",
      d.querySelector('[data-arm="sf-title"]').textContent);
    ok("按鈕**還沒**變成強力搜(要先點頭)",
      btn("sf-title").textContent === "搜尋", btn("sf-title").textContent);
    ok("而且到這裡為止一次錢都沒花", goo.length === 0, { google: goo.length });

    // ---- 點句子裡那三個字才變,而且那一下不查東西 ----
    d.querySelector('[data-arm="sf-title"]').click();
    await sleep(60);
    ok("點下去之後按鈕變成「強力搜」", btn("sf-title").textContent === "強力搜", btn("sf-title").textContent);
    /* **量的是 class,不是 backgroundColor。** `.btn` 有 `transition:background .15s`,
       所以 computed 讀到的是過場跑到一半的值 —— 而在虛擬時間下它可能一幀都沒跑,
       讀到的就是起始的白色。我為了這件事查了五輪,而**同一個陷阱幾小時前才寫進
       `drawer-steps.md`**(那次是 `transition:width`,量 rect 讀到中間值)。

       **顏色對不對由截圖回答**(第 14 張),斷言只管狀態有沒有切過去。 */
    ok("而且掛上了 seek-strong(橘色那一組的來源)",
      btn("sf-title").classList.contains("seek-strong"), btn("sf-title").className);
    /* **上膛的是輸入框,不只是按鈕。** 眼睛和手指都在輸入框裡,
       只換右下角那顆小東西的話,狀態變了而看的人不在那裡。 */
    ok("而且輸入框也跟著上膛(seek-armed)", inp.classList.contains("seek-armed"), inp.className);
    ok("**點下去那一下不查任何東西**(花錢的是下一下)",
      osm.length === 4 && goo.length === 0, { osm: osm.length, google: goo.length });
    ok("而且它告訴你下一步做什麼", boxText("sf-title").indexOf("按「強力搜」") >= 0, boxText("sf-title"));
    ok("而且不再覆誦「好 ——」(按的那顆就在上一句話裡)",
      boxText("sf-title").indexOf("好 ——") < 0, boxText("sf-title"));

    // ---- 按下強力搜 = Google 的 Places UI Kit 清單(2026-10-02;舊的伺服器那條拿掉了) ----
    /* 這裡沒有 Google 元件(假後端也不給瀏覽器金鑰),所以走的是「載不出來」那條。
       有元件的那條(清單、挑一家、編號存進 Notion)在 probes/uikit.js。 */
    await press("sf-title");
    ok("強力搜不再打舊的伺服器搜尋(resource=places)", goo.length === 0, { google: goo.length });
    ok("而且那一下也不問免費那家", osm.length === 4, { osm: osm.length });
    ok("載不出 Google 清單 → 講「清單載入出現錯誤」,叫他稍後或重開再試(不講免費不免費)",
      boxText("sf-title").indexOf("清單載入出現錯誤") >= 0 && boxText("sf-title").indexOf("免費") < 0, boxText("sf-title"));
    ok("按鈕**留在**「強力搜」(這一下沒花到錢,不該逼他重走一輪)",
      btn("sf-title").textContent === "強力搜", btn("sf-title").textContent);
    ok("退路那句也在(他按到最後一段了)", boxText("sf-title").indexOf("也可以許願") >= 0, boxText("sf-title"));

    // ---- 換表單不可以帶著段數 ----
    osm.length = 0; goo.length = 0;
    d.getElementById("add-wish-btn").click();
    await until(function () { return !q("#wish-form").hidden; });
    ok("換到許願表單,按鈕是「搜尋」", btn("wf-title").textContent === "搜尋", btn("wf-title").textContent);

    // ---- 舊的那顆按鈕真的不見了 ----
    ok("`#we-again`(再查一次)不存在了", !d.getElementById("we-again"), "還在");
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

return { 說明: "非同步" };
