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
      osm.length === 2 && goo.length === 0, { osm: osm.length, google: goo.length });
    ok("而且它告訴你下一步做什麼", boxText("sf-title").indexOf("按「強力搜」") >= 0, boxText("sf-title"));
    ok("而且不再覆誦「好 ——」(按的那顆就在上一句話裡)",
      boxText("sf-title").indexOf("好 ——") < 0, boxText("sf-title"));

    // ---- 按下強力搜才走 Google ----
    gooReply = { list: [{ la: 35.6267, lo: 139.7745, label: "富士電視台", addr: "東京都港區台場" },
                 { la: 35.66, lo: 139.79, label: "富士電視台 球體展望室", addr: "東京都港區台場 2-4-8" }] };
    await press("sf-title");
    ok("按「強力搜」才問 Google", goo.length === 1, { google: goo.length });
    ok("而且那一下不再問免費那家", osm.length === 2, { osm: osm.length });
    /* **Places 回多筆,而那正是換掉 Geocoding 的理由。**
       Geocoding 只回一筆,所以「三間 teamLab 讓你挑」這件事它做不到。 */
    ok("Google 的結果照樣畫成可以挑的候選,而且是**多筆**",
      d.querySelectorAll('[data-hit="sf-title"]').length === 2,
      d.querySelectorAll('[data-hit="sf-title"]').length);

    /* ---- **只給用一次:找到了也退回去,不必等他挑** ----
       以前是「挑到候選才歸零」。於是查到一串、一筆都不想挑的人,
       **下一按仍然是花錢的那一按,而他並沒有再同意一次。** */
    ok("找到了就退回「搜尋」(不必等他挑)", btn("sf-title").textContent === "搜尋", btn("sf-title").textContent);
    ok("輸入框也卸下來了", !inp.classList.contains("seek-armed"), inp.className);
    ok("而且這時候才講退路(找到也講 —— 他可能一筆都不想挑)",
      boxText("sf-title").indexOf("也可以許願") >= 0, boxText("sf-title"));

    // ---- 挑到 → 全部歸零 ----
    d.querySelector('[data-hit="sf-title"]').click();
    await sleep(60);
    ok("挑到之後按鈕變回「搜尋」", btn("sf-title").textContent === "搜尋", btn("sf-title").textContent);
    ok("挑到之後那一欄換成挑到的名字", inp.value === "富士電視台", inp.value);

    // ---- 強力搜也找不到:退回免費,並說「找不到也沒關係」 ----
    osm.length = 0; goo.length = 0; osmReply = []; gooReply = { list: [] };
    inp.value = "查不到的那種";
    await press("sf-title"); await press("sf-title");
    d.querySelector('[data-arm="sf-title"]').click();
    await sleep(60);
    await press("sf-title");
    ok("強力搜真的送出去了", goo.length === 1, { google: goo.length });
    ok("找不到 → 按鈕退回「搜尋」(再按一次是同一個字問同一家,白花錢)",
      btn("sf-title").textContent === "搜尋", btn("sf-title").textContent);
    /* 那句退路搬到 `seekTail()` 了,所以這裡比對的字換了 ——
       **但要守的東西一樣**:講的是「不找了也沒關係」,不是「再試試」。 */
    ok("講的是「也可以許願」,不是「再試試」",
      boxText("sf-title").indexOf("也可以許願") >= 0, boxText("sf-title"));
    ok("而且退路那句沒有被「找不到」那句蓋掉(兩句都在)",
      boxText("sf-title").indexOf("換個說法") >= 0 && boxText("sf-title").indexOf("也可以許願") >= 0,
      boxText("sf-title"));
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
    gooStatus = 503; gooReply = { error: "地點查詢服務說:Places API has not been used in project…" };
    await press("wf-title");
    ok("伺服器講得出原因時,畫面轉述它的原話",
      boxText("wf-title").indexOf("Places API") >= 0, boxText("wf-title"));
    ok("**不會換成自己編的原因**(例如「次數用完了」)",
      boxText("wf-title").indexOf("次數用完") < 0, boxText("wf-title"));
    /* **出錯這條路上,那兩個旗標各自該怎樣。**
       這一段以前只問「訊息有沒有照轉」,沒有問按鈕停在哪、退路那句在不在 ——
       而「只給用一次」是在**找到**和**零筆**兩條路上實作的,出錯這條當時漏掉了。 */
    ok("出錯 → 按鈕**留在**「強力搜」(這一下一毛錢都沒花到,不該逼他重走一輪)",
      btn("wf-title").textContent === "強力搜", btn("wf-title").textContent);
    ok("而且輸入框也還上著膛", d.getElementById("wf-title").classList.contains("seek-armed"),
      d.getElementById("wf-title").className);
    ok("但退路那句要出現 —— 他按過了,而且手上什麼都沒有",
      boxText("wf-title").indexOf("也可以許願") >= 0, boxText("wf-title"));
    ok("而且伺服器的原話沒有被退路那句擠掉(兩句都在)",
      boxText("wf-title").indexOf("Places API") >= 0 && boxText("wf-title").indexOf("也可以許願") >= 0,
      boxText("wf-title"));
    /* 連不上那條(`!res`)跟上面那條是不同的分支,各自有自己的 return —— 分開問一次。 */
    gooStatus = 0; gooReply = null; gooThrow = true;
    await press("wf-title");
    ok("連不上 → 退路那句一樣要出現(不是只有伺服器講得出話的時候才講)",
      boxText("wf-title").indexOf("也可以許願") >= 0, boxText("wf-title"));
    gooThrow = false;
    gooStatus = 200;

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
