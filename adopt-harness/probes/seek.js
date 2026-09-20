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
    ok("加行程有搜尋鈕", !!q('[data-seek="sf-place"]'), null);
    ok("許願有搜尋鈕", !!q('[data-seek="wf-place"]'), null);
    ok("改行程有搜尋鈕", !!q('[data-seek="se-place"]'), null);
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
        d.getElementById(k + "-place-out").hidden === true, null);
    });

    // 2 ---- 打關鍵字 → 候選清單 ----
    d.getElementById("add-stop-btn").click();
    await until(function () { return !q("#stop-form").hidden; });
    asked.length = 0; reply = THREE;
    d.getElementById("sf-place").value = "teamLab";
    q('[data-seek="sf-place"]').click();
    ok("按了搜尋 → 真的發出查詢", await until(function () { return asked.length > 0; }), asked);
    ok("列出全部三筆候選(不是自己挑一筆)",
      await until(function () { return d.querySelectorAll('[data-hit="sf-place"]').length === 3; }),
      d.querySelectorAll('[data-hit="sf-place"]').length);
    var first = q('[data-hit="sf-place"]');
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
    var second = d.querySelectorAll('[data-hit="sf-place"]')[1];   /* 麻布台那間 */
    second.click();
    await sleep(60);
    ok("選了之後地點欄換成那個名字",
      d.getElementById("sf-place").value === "teamLab Borderless Museum",
      d.getElementById("sf-place").value);
    var saved = pins()["teamLab Borderless Museum"];
    ok("座標同時寫進快取(這一筆從此不會再被查)",
      !!saved && Math.abs(saved.la - 35.6620) < 0.001 && Math.abs(saved.lo - 139.7434) < 0.001, saved);
    ok("而且標記成「人親手選的」", !!saved && saved.by === "pick", saved);
    ok("選的是第二筆 —— 沒有被程式改成第一筆(那正是這個功能要取代的行為)",
      !!saved && saved.la > 35, saved);

    // 4 ---- 查無要誠實說 ----
    asked.length = 0; reply = [];
    d.getElementById("sf-place").value = "泡溫泉";
    q('[data-seek="sf-place"]').click();
    ok("查無 → 說找不到,而且給下一步怎麼辦",
      await until(function () { return /找不到/.test(d.getElementById("sf-place-out").textContent); }),
      d.getElementById("sf-place-out").textContent);
    ok("查無 → 一筆候選都不畫(不要退而求其次給一個)",
      d.querySelectorAll('[data-hit="sf-place"]').length === 0, null);
    ok("查無 → 地點欄維持使用者打的字,沒有被動過",
      d.getElementById("sf-place").value === "泡溫泉", d.getElementById("sf-place").value);

    // 5 ---- 空字串不發查詢 ----
    asked.length = 0;
    d.getElementById("sf-place").value = "";
    q('[data-seek="sf-place"]').click();
    await sleep(120);
    ok("沒打字就按搜尋 → 一次查詢都不發", asked.length === 0, asked);
    ok("而且講了要先打字", /先打幾個字/.test(d.getElementById("sf-place-out").textContent),
      d.getElementById("sf-place-out").textContent);

    // 6 ---- Enter 搜尋,而且不會順手送出表單 ----
    var stopsBefore = d.querySelectorAll("#route .stop").length;
    asked.length = 0; reply = THREE;
    var inp = d.getElementById("sf-place");
    inp.value = "teamLab";
    inp.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    ok("Enter 會搜尋", await until(function () { return asked.length > 0; }), asked);
    await sleep(150);
    ok("Enter **不會**順手把表單送出去",
      d.querySelectorAll("#route .stop").length === stopsBefore && !q("#stop-form").hidden,
      { 之前: stopsBefore, 之後: d.querySelectorAll("#route .stop").length });

  } catch (e) {
    out.爆掉了 = String((e && e.stack) || e);
  }
  out.結論 = out.沒過的.length ? out.沒過的.length + " 項沒過" : "全部通過";
  document.getElementById("r").textContent = JSON.stringify(out, null, 2);
})();

return { 說明: "非同步" };
