// 地點搜尋(打關鍵字 → 候選清單 → 選一個)的前端行為,在真實 DOM 上跑一遍。
//
// 為什麼要有這一支:這個功能的每一步都是**人看得見的**,而看得見的東西最容易
// 用「我讀過程式碼」交差。這裡把 Nominatim 換成樁,量的是
// 「服務回 X 的時候,畫面和快取變成什麼」。
//
// 樁只接手 nominatim,其餘原樣放行 —— 跟 geofix.js 同一個做法。
var log = [], out = { 步驟: log, 沒過的: [] };
function ok(name, cond, extra) {
  log.push((cond ? "✓ " : "✗ ") + name + (cond ? "" : "   ← " + JSON.stringify(extra)));
  if (!cond) out.沒過的.push(name);
}
var sleep = function (ms) { return new Promise(function (r) { w.setTimeout(r, ms); }); };
var q = function (s) { return d.querySelector(s); };
async function until(fn, tries) {
  for (var i = 0; i < (tries || 160); i++) { if (fn()) return true; await sleep(50); }
  return false;
}
function pins() { return JSON.parse(w.localStorage.getItem("tokyo5-pin3") || "{}"); }

var realFetch = w.fetch.bind(w);
var asked = [], reply = null;
w.fetch = function (u, init) {
  var url = String(u);
  if (url.indexOf("nominatim") >= 0) {
    asked.push(url);
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve(reply || []); } });
  }
  return realFetch(u, init);
};

var THREE = [
  { lat: "34.6111", lon: "135.5205", display_name: "teamLab Botanical Garden, 長居公園, 東住吉區, 大阪市, 大阪府, 日本" },
  { lat: "35.6620", lon: "139.7434", display_name: "teamLab Borderless Museum, 麻布台ヒルズ, 虎ノ門, 港區, 東京都, 日本" },
  { lat: "34.9837", lon: "135.7654", display_name: "teamLab BioVortex, 八条通, 下京区, 京都市, 京都府, 日本" },
];

(async function () {
  /* **第一件事是讓出一次,不是量東西。** `probe.sh` 的外層是
     `out = (function(){ …探針… })();` 然後才 `#r = JSON.stringify(out)` ——
     探針如果**同步**跑完(例如要量的東西不存在,第一個 getElementById 就 null 爆掉),
     它寫的 `#r` 會發生在外層那一行之前,**然後被佔位值蓋掉**。
     症狀是「探針回傳 `{說明:"非同步"}`」,看起來像沒跑,其實是跑了而且結果被覆蓋。
     我在負向對照上撞到兩次才看出來。讓出一拍,我的寫入就一定在外層之後。 */
  await sleep(0);
  try {
    // 0 ---- 人親手選的座標,開場對帳不可以碰 ----
    /* 表的 key 是子字串,`箱根` 會同時命中「箱根湯本站」和「箱根神社」。
       **使用者看著名字和地址挑的東西,比任何表都更知道他要什麼** —— 所以帶著
       `by:"pick"` 的要放過。fixture 灌了兩筆,差別只在有沒有那個標記。

       **第一版不是這樣測的**:我開了一個巢狀 iframe 重新載入頁面想觸發對帳,
       兩條都回 `undefined` —— 外層頁面還活著,它記憶體裡那份 `pins` 會在下一次
       `savePins()` 把我注入的東西蓋掉。**要量「開場發生什麼」,就要真的從開場開始**,
       那是 fixture 的工作,不是 DOM 操作的工作。 */
    ok("人親手選的座標,對帳一個字都不動",
      pins()["箱根湯本站"] && Math.abs(pins()["箱根湯本站"].la - 35.2323) < 0.0001 &&
      pins()["箱根湯本站"].by === "pick", pins()["箱根湯本站"]);
    ok("對照組(同樣被 `箱根` 命中,但沒有人選過)照樣被表接管",
      pins()["箱根神社"] && pins()["箱根神社"].via === "箱根神社" &&
      Math.abs(pins()["箱根神社"].la - 35.232) < 0.0001, pins()["箱根神社"]);

    // 1 ---- 三個地點欄都有搜尋,而且預設不佔畫面 ----
    ok("加行程有搜尋鈕(現在掛在合併後的那一欄上)", !!q('[data-seek="sf-title"]'), null);
    ok("許願有搜尋鈕", !!q('[data-seek="wf-title"]'), null);
    ok("改行程有搜尋鈕", !!q('[data-seek="se-title"]'), null);
    /* **鉤子不在就早退。** 第一次拿這支去跑「這一輪之前」的程式時,它回傳的是佔位值 ——
       因為 `until()` 在要等的東西永遠不會出現時要空轉 8 秒,好幾條加起來超過
       `--virtual-time-budget`,`#r` 還沒被覆寫頁面就結束了。**探針在它該變紅的那棵樹上
       跑不完,等於沒有負向對照。** 早退讓它在三條紅燈之後立刻交卷。 */
    if (!q("[data-seek]")) {
      out.早退 = "這棵樹沒有地點搜尋(三個鉤子都不在),後面 22 條沒有東西可量";
      throw new Error(out.早退);
    }

    ["sf", "wf", "se"].forEach(function (k) {
      ok(k + " 的候選清單預設是 hidden(所以截圖上不存在)",
        d.getElementById(k + "-title-out").hidden === true, null);
    });

    // 2 ---- 打關鍵字 → 候選清單 ----
    d.getElementById("add-stop-btn").click();
    await until(function () { return !q("#stop-form").hidden; });
    asked.length = 0; reply = THREE;
    d.getElementById("sf-title").value = "teamLab";
    q('[data-seek="sf-title"]').click();
    ok("按了搜尋 → 真的發出查詢", await until(function () { return asked.length > 0; }), asked);
    ok("列出全部三筆候選(不是自己挑一筆)",
      await until(function () { return d.querySelectorAll('[data-hit="sf-title"]').length === 3; }),
      d.querySelectorAll('[data-hit="sf-title"]').length);
    var first = q('[data-hit="sf-title"]');
    ok("每一筆都同時給名字和地址(光看名字分不出兩間同名的)",
      !!first.querySelector("b") && !!first.querySelector("span") &&
      /teamLab/.test(first.querySelector("b").textContent) &&
      /大阪/.test(first.querySelector("span").textContent),
      first.textContent);
    /* **硬界線不帶,是這一支最該守住的一條。** pinFor() 帶 bounded=1 是因為程式自己挑;
       這裡是人挑,框起來只會把他要的藏起來。 */
    ok("查詢不帶 bounded=1(人在挑,不需要硬界線)", asked.join(" ").indexOf("bounded") < 0, asked);
    ok("但 viewbox 留著當加權", /viewbox=/.test(asked.join(" ")), asked);
    ok("而且帶了國家代碼", /countrycodes=jp/.test(asked.join(" ")), asked);

    // 3 ---- 選一個 ----
    var second = d.querySelectorAll('[data-hit="sf-title"]')[1];   /* 麻布台那間 */
    second.click();
    await sleep(60);
    ok("選了之後那一欄換成挑到的名字",
      d.getElementById("sf-title").value === "teamLab Borderless Museum",
      d.getElementById("sf-title").value);
    var saved = pins()["teamLab Borderless Museum"];
    ok("座標同時寫進快取(這一筆從此不會再被查)",
      !!saved && Math.abs(saved.la - 35.6620) < 0.001 && Math.abs(saved.lo - 139.7434) < 0.001, saved);
    ok("而且標記成「人親手選的」", !!saved && saved.by === "pick", saved);
    ok("選的是第二筆 —— 沒有被程式改成第一筆(那正是這個功能要取代的行為)",
      !!saved && saved.la > 35, saved);

    // 4 ---- 查無要誠實說 ----
    asked.length = 0; reply = [];
    d.getElementById("sf-title").value = "泡溫泉";
    q('[data-seek="sf-title"]').click();
    ok("查無 → 說找不到,而且給下一步怎麼辦",
      await until(function () { return /找不到/.test(d.getElementById("sf-title-out").textContent); }),
      d.getElementById("sf-title-out").textContent);
    ok("查無 → 一筆候選都不畫(不要退而求其次給一個)",
      d.querySelectorAll('[data-hit="sf-title"]').length === 0, null);
    ok("查無 → 那一欄維持使用者打的字,沒有被動過",
      d.getElementById("sf-title").value === "泡溫泉", d.getElementById("sf-title").value);

    // 5 ---- 空字串不發查詢 ----
    asked.length = 0;
    d.getElementById("sf-title").value = "";
    q('[data-seek="sf-title"]').click();
    await sleep(120);
    ok("沒打字就按搜尋 → 一次查詢都不發", asked.length === 0, asked);
    ok("而且講了要先打字", /先打幾個字/.test(d.getElementById("sf-title-out").textContent),
      d.getElementById("sf-title-out").textContent);

    // 6 ---- Enter 搜尋,而且不會順手送出表單 ----
    var stopsBefore = d.querySelectorAll("#route .stop").length;
    asked.length = 0; reply = THREE;
    var inp = d.getElementById("sf-title");
    inp.value = "teamLab";
    inp.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    ok("Enter 會搜尋", await until(function () { return asked.length > 0; }), asked);
    await sleep(150);
    ok("Enter **不會**順手把表單送出去",
      d.querySelectorAll("#route .stop").length === stopsBefore && !q("#stop-form").hidden,
      { 之前: stopsBefore, 之後: d.querySelectorAll("#route .stop").length });

    // 8 ---- 兩欄合併:挑過的才有 place,沒挑的就是沒有 ----
    /* **這是整個合併的支點。** 「只有挑過的才上地圖」不是靠新規則做到的,
       是靠**只有挑過的時候才寫 `place`** —— 而「沒有 place 就不查、不上地圖」
       是本來就在的規則。所以這三條測的是那個落點,不是地圖那條路。 */
    function stops() {
      try { return (JSON.parse(w.localStorage.getItem("tokyo5-v1") || "{}").stops) || []; }
      catch (e) { return []; }
    }
    ok("舊的地點欄真的不存在了(不是只藏起來)",
      !d.getElementById("sf-place") && !d.getElementById("wf-place") && !d.getElementById("se-place"), null);

    var n0 = stops().length;
    asked.length = 0; reply = THREE;
    if (q("#stop-form").hidden) d.getElementById("add-stop-btn").click();
    await until(function () { return !q("#stop-form").hidden; });
    d.getElementById("sf-time").value = "10:00";
    d.getElementById("sf-title").value = "teamLab";
    q('[data-seek="sf-title"]').click();
    await until(function () { return d.querySelectorAll('[data-hit="sf-title"]').length === 3; });
    d.querySelectorAll('[data-hit="sf-title"]')[1].click();
    await sleep(60);
    ok("挑完之後狀態列說「已標定」,而且印的是地址(他剛從三間裡挑了一間)",
      /已標定/.test(d.getElementById("sf-title-out").textContent) &&
      /麻布台/.test(d.getElementById("sf-title-out").textContent),
      d.getElementById("sf-title-out").textContent);
    q("#stop-form button[type=submit]").click();
    ok("挑過的送出之後,place 等於挑到的那個名字",
      await until(function () {
        var t = stops()[stops().length - 1];
        return stops().length === n0 + 1 && t && t.place === "teamLab Borderless Museum";
      }), stops()[stops().length - 1]);
    ok("而且 title 和 place 是同一個字(合併之後它們本來就是同一件事)",
      stops()[stops().length - 1].title === stops()[stops().length - 1].place,
      stops()[stops().length - 1]);

    // 沒挑的:place 必須是空的
    var n1 = stops().length;
    asked.length = 0;
    d.getElementById("add-stop-btn").click();
    await until(function () { return !q("#stop-form").hidden; });
    d.getElementById("sf-time").value = "11:00";
    d.getElementById("sf-title").value = "泡溫泉";
    q("#stop-form button[type=submit]").click();
    ok("沒挑就送出 → place 是空的(程式不再自己拿那幾個字去猜)",
      await until(function () {
        var t = stops()[stops().length - 1];
        return stops().length === n1 + 1 && t && t.title === "泡溫泉" && t.place === "";
      }), stops()[stops().length - 1]);
    ok("沒挑就送出 → 一次查詢都不發",
      asked.length === 0, asked);
    ok("而且講的是「按搜尋挑一個」,不是「補上地點」(畫面上已經沒有地點欄了)",
      await until(function () { return /還沒挑地點/.test(q("#stop-msg").textContent); }) &&
      /搜尋/.test(q("#stop-msg").textContent) && !/補上地點/.test(q("#stop-msg").textContent),
      q("#stop-msg").textContent);

    // 9 ---- 編輯:既有的 place 看得見,而且不會被悄悄丟掉 ----
    /* **合併最容易出事的地方。** 地點欄從畫面上消失了,如果送出時照著空欄位寫回去,
       那一筆本來標好的位置就在使用者沒看到、沒同意的情況下不見了。 */
    var target = [].slice.call(d.querySelectorAll("#route [data-edit-stop]"))[0];
    if (target) {
      target.click();
      await until(function () { return !q("#edit-overlay").hidden; });
      var before = stops().find(function (x) { return x.id === target.getAttribute("data-edit-stop"); });
      ok("打開編輯:本來就有位置的那一筆,狀態列講得出來",
        !before.place || /已標定/.test(d.getElementById("se-title-out").textContent),
        { place: before.place, 槽: d.getElementById("se-title-out").textContent });
      d.getElementById("se-note").value = "只改備註";
      q("#edit-form button[type=submit]").click();
      await sleep(120);
      var after = stops().find(function (x) { return x.id === before.id; });
      ok("只改備註、標題沒動 → 原來的位置留著(沒有被悄悄丟掉)",
        after && after.place === before.place, { 之前: before.place, 之後: after && after.place });
    } else {
      ok("找得到可編輯的行程", false, "#route 裡沒有 [data-edit-stop]");
    }

    // 10 ---- 改我的願望:**三種情況一字不差地照抄行程那張表** ----
    /* 這是這一輪的新功能,而它踩在合併那一輪最容易出事的那塊地上。
       `merge-place-field.md` 那三種情況不是可以隨手簡化的分支,所以三種各量一次。
       fixture 的 tokyo5-me 是 hsieh_chinhui,他許的是 w2「橫濱 港灣未來」。 */
    function wishes() {
      return JSON.parse(w.localStorage.getItem("tokyo5-v1") || "{}").wishes || [];
    }
    function wishRow(re) {
      return [].slice.call(d.querySelectorAll("#wish-list [data-wish]"))
        .filter(function (r) { return re.test(r.textContent); })[0];
    }
    d.getElementById("wishbox").open = true;
    await sleep(60);

    // 10a ---- 入口只長在自己那幾筆上 ----
    var edits = d.querySelectorAll("#wish-list [data-edit-wish]");
    ok("「改」只出現在自己許的那幾筆上(三筆願望裡只有一筆是我的)",
      edits.length === 1, [].map.call(d.querySelectorAll("#wish-list [data-wish]"), function (r) {
        return r.textContent.slice(0, 10) + ":" + (r.querySelector("[data-edit-wish]") ? "有" : "無");
      }));
    ok("而且它就長在自己那一筆上(不是隨便一筆)",
      !!wishRow(/港灣未來/) && !!wishRow(/港灣未來/).querySelector("[data-edit-wish]"), null);
    ok("「改」跟 `.mine` 的紫框是同一個判準(同一列同時有這兩個)",
      !!wishRow(/港灣未來/) && wishRow(/港灣未來/).classList.contains("mine"),
      wishRow(/港灣未來/) && wishRow(/港灣未來/).className);

    // 10b ---- 情況二:沒挑、標題沒動 → 原來那個留著 ----
    var w2before = wishes().find(function (x) { return x.id === "w2"; });
    d.querySelector("#wish-list [data-edit-wish]").click();
    ok("「改」打得開", await until(function () { return !q("#wish-edit-overlay").hidden; }),
      q("#wish-edit-overlay").outerHTML.slice(0, 120));
    ok("標題帶進去了", q("#we-title").value === "橫濱 港灣未來", q("#we-title").value);
    ok("**既有的位置講出來了**(合併之後畫面上沒有地點欄,它只活在這一行)",
      /已標定/.test(q("#we-title-out").textContent), q("#we-title-out").textContent);
    ok("而且印的是名字不是地址 —— 這一筆是舊資料,不是挑過的,**不要假裝它是**",
      /港灣未來/.test(q("#we-title-out").textContent), q("#we-title-out").textContent);
    ok("**沒有「哪一天」「時間」這兩欄** —— 願望一有日期就不再是願望了",
      !q("#wish-edit-overlay #we-day") && !q("#wish-edit-overlay #we-time"), null);
    ok("也沒有「你是誰」 —— 歸屬是這整條唯一擋得住的東西,不開給人改",
      !q("#wish-edit-overlay select"), q("#wish-edit-form").innerHTML.slice(0, 60));
    q("#we-note").value = "只改想說的";
    q("#wish-edit-form button[type=submit]").click();
    await until(function () {
      var x = wishes().find(function (y) { return y.id === "w2"; });
      return x && x.note === "只改想說的";
    });
    var w2after = wishes().find(function (x) { return x.id === "w2"; });
    ok("情況二:沒挑、標題沒動 → 原來的位置留著(沒有被悄悄丟掉)",
      w2after.place === w2before.place && w2after.place === "港灣未來",
      { 之前: w2before.place, 之後: w2after.place });
    ok("而且 by 沒有被動到(它是「改」這顆按鈕自己的地基)",
      w2after.by === "hsieh_chinhui", w2after);
    ok("votes 也沒有被動到", JSON.stringify(w2after.votes) === JSON.stringify(w2before.votes),
      { 之前: w2before.votes, 之後: w2after.votes });

    // 10c ---- 情況三:標題改了又沒挑 → 清空 ----
    /* 舊的 place 講的是舊的地方,留著會把新標題標到錯的位置上 ——
       那正是這整串(泡溫泉→鳥取、港灣未來→福井)要根除的東西。 */
    d.querySelector("#wish-list [data-edit-wish]").click();
    await until(function () { return !q("#wish-edit-overlay").hidden; });
    q("#we-title").value = "橫濱 中華街";
    q("#wish-edit-form button[type=submit]").click();
    await until(function () {
      var x = wishes().find(function (y) { return y.id === "w2"; });
      return x && x.title === "橫濱 中華街";
    });
    var w2c = wishes().find(function (x) { return x.id === "w2"; });
    ok("情況三:標題改了又沒挑 → place 清空(舊的位置講的是舊的地方)",
      w2c.place === "", { title: w2c.title, place: w2c.place });

    // 10d ---- 情況一:挑過 → 用挑的,座標跟著候選一起來 ----
    d.querySelector("#wish-list [data-edit-wish]").click();
    await until(function () { return !q("#wish-edit-overlay").hidden; });
    reply = THREE;
    q("#we-title").value = "teamLab";
    q('[data-seek="we-title"]').click();
    ok("編輯框裡的搜尋鈕真的會查",
      await until(function () { return d.querySelectorAll('[data-hit="we-title"]').length === 3; }),
      d.querySelectorAll('[data-hit="we-title"]').length);
    d.querySelectorAll('[data-hit="we-title"]')[1].click();
    await sleep(50);
    ok("挑完之後那一欄換成挑到的名字",
      q("#we-title").value === "teamLab Borderless Museum", q("#we-title").value);
    ok("挑完之後狀態列印的是地址(他剛從三間同名的裡面挑了一間)",
      /麻布台/.test(q("#we-title-out").textContent), q("#we-title-out").textContent);
    q("#wish-edit-form button[type=submit]").click();
    await until(function () {
      var x = wishes().find(function (y) { return y.id === "w2"; });
      return x && x.place === "teamLab Borderless Museum";
    });
    var w2d = wishes().find(function (x) { return x.id === "w2"; });
    ok("情況一:挑過 → place 等於挑到的那個名字", w2d.place === "teamLab Borderless Museum", w2d);
    var saved2 = pins()["teamLab Borderless Museum"];
    ok("座標跟著候選一起存下來,而且標記成「人親手選的」",
      !!saved2 && saved2.by === "pick" && Math.abs(saved2.la - 35.662) < 0.001, saved2);

    // 10e ---- 取消關得掉 ----
    /* 這一節本來還有三條在測「再查一次」(有 place 才畫、沒 place 不畫、硬戳也不發查詢)。
       `#we-again` 在 search-escalate 那一輪整顆退場了 —— 它的前提消失,不是被簡化掉 ——
       所以那三條跟著刪,新的行為由 `probes/escalate.js` 接手。

       **留下來的是「取消關得掉」**:它跟那顆按鈕無關,只是排在它後面。
       刪掉之前它已經好幾輪沒跑到 —— `q("#we-again")` 是 null,`.hidden` 一讀就拋例外,
       而結論式子當時不看 `爆掉了`,印出來仍然是「全部通過」。
       **拿掉一個功能的時候,要跟著搜的是「誰在測它」,不只是「誰在用它」。** */
    d.querySelector("#wish-list [data-edit-wish]").click();
    await until(function () { return !q("#wish-edit-overlay").hidden; });
    q("#we-cancel").click();
    ok("取消關得掉", q("#wish-edit-overlay").hidden === true, null);
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
