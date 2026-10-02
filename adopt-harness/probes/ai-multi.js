/* AI 一次讀到好幾筆 —— 行程、許願、記帳都跟交通一樣疊卡片(2026-10-02,Lulu)。
 * 後面疊著(最多三張的樣子)、右上角「第幾 / 共幾」、卡片一律螢幕 60% 高、存了才往左滑走、跳過不存、最後一張存了才關。
 *   WIDTH=390 ./probe.sh probes/ai-multi.js                     團主:許願、行程、記帳
 *   PAGE='/index.html?fake=member' WIDTH=390 ./probe.sh ...    一般成員:許願表 */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var member = /fake=member/.test((w.performance.getEntriesByType("navigation")[0] || {}).name || "");
var next = null, real = w.fetch;
w.fetch = function (u, init) {
  if (/\/api\/ai/.test(String(u))) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: next }) });
  return real(u, init);
};
var base = { title: "", day: "", time: "", note: "", amount: 0, currency: "", date: "", category: "", legs: [], message: "" };
async function ask(intent, items) {
  next = Object.assign({}, base, items[0], { intent: intent, items: items.map(x => Object.assign({}, base, x)) });
  q("#ai-btn").click(); await wait(80); q("#ai-text").value = "好幾筆"; q("#ai-form").requestSubmit(); await wait(400);
}
function look(formId) {
  var f = q("#" + formId), st = f.parentElement, n = f.querySelector(".stack-n");
  return { 數: n && !n.hidden ? n.textContent : "", 後一: !!st.querySelector(".g1:not([hidden])"), 後二: !!st.querySelector(".g2:not([hidden])"),
    高: Math.round(f.getBoundingClientRect().height), 六成: Math.round(w.innerHeight * 0.6) };
}
return (async function () {
  var out = {}, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var wishes0 = (w.__rows.wishes || []).length;
  if (member) {
    await ask("wish", [{ title: "淺草寺" }, { title: "晴空塔" }, { title: "上野公園" }]);
    out.許願1 = look("wish-form");
    ok("一般成員許願 3 筆:許願表、1 / 3、後面兩張、60% 高", !q("#wish-add-overlay").hidden && out.許願1.數 === "1 / 3" && out.許願1.後一 && out.許願1.後二 && Math.abs(out.許願1.高 - out.許願1.六成) <= 2 && q("#wf-title").value === "淺草寺", out.許願1);
    q("#wish-form").requestSubmit(); await wait(80);
    ok("存了 → 往左滑走", q("#wish-form").classList.contains("slide-out"), "");
    await wait(450);
    ok("滑完:2 / 3、晴空塔", look("wish-form").數 === "2 / 3" && q("#wf-title").value === "晴空塔", look("wish-form"));
    q("#wf-skip").click(); await wait(100);
    ok("跳過:3 / 3、上野公園、後面沒卡了", look("wish-form").數 === "3 / 3" && q("#wf-title").value === "上野公園" && !look("wish-form").後一, look("wish-form"));
    q("#wish-form").requestSubmit(); await wait(500);
    ok("最後一筆存了 → 關掉;存了 2 筆", q("#wish-add-overlay").hidden && (w.__rows.wishes || []).length - wishes0 === 2, (w.__rows.wishes || []).length - wishes0);
  } else {
    /* 許願:團主走 AI 的確認卡 */
    await ask("wish", [{ title: "淺草寺" }, { title: "晴空塔" }]);
    out.許願 = look("ai-confirm");
    ok("許願 2 筆:確認卡、1 / 2、後面一張、60% 高", !q("#ai-confirm").hidden && out.許願.數 === "1 / 2" && out.許願.後一 && !out.許願.後二 && Math.abs(out.許願.高 - out.許願.六成) <= 2, out.許願);
    q("#ai-confirm").requestSubmit(); await wait(80);
    ok("許願:存了 → 往左滑走", q("#ai-confirm").classList.contains("slide-out"), "");
    await wait(450);
    ok("許願:2 / 2、晴空塔", look("ai-confirm").數 === "2 / 2" && q("#ai-title").value === "晴空塔", look("ai-confirm"));
    q("#ai-confirm").requestSubmit(); await wait(500);
    ok("許願:最後一筆存了 → 關掉、存了 2 筆", q("#ai-overlay").hidden && (w.__rows.wishes || []).length - wishes0 === 2, (w.__rows.wishes || []).length - wishes0);
    /* 行程 */
    var stops0 = (w.__rows.itinerary || w.__rows.stops || []).length;
    await ask("stop", [{ title: "築地", day: "2026-10-04", time: "08:00" }, { title: "銀座", day: "2026-10-04", time: "11:00" }, { title: "東京鐵塔", day: "2026-10-04", time: "18:00" }, { title: "六本木", day: "2026-10-04", time: "20:00" }]);
    out.行程 = look("ai-confirm");
    ok("行程 4 筆:1 / 4、後面兩張(最多三張的樣子)", out.行程.數 === "1 / 4" && out.行程.後一 && out.行程.後二, out.行程);
    q("#ai-skip").click(); await wait(100);
    ok("行程:跳過 → 2 / 4、銀座、沒有滑", look("ai-confirm").數 === "2 / 4" && q("#ai-title").value === "銀座" && !q("#ai-confirm").classList.contains("slide-out"), look("ai-confirm"));
    q("#ai-cancel2").click(); await wait(100);
    ok("行程:取消 → 關掉,後面的都不要", q("#ai-overlay").hidden, "");
    /* 記帳:開「記一筆」對話框 */
    var exp0 = (w.__rows.expenses || []).length;
    await ask("expense", [{ title: "一蘭", amount: 2980, currency: "JPY", date: "2026-10-05", category: "餐飲" }, { title: "藥妝", amount: 5400, currency: "JPY", date: "2026-10-05", category: "購物" }]);
    out.記帳 = look("exp-edit-form");
    ok("記帳 2 筆:「記一筆」對話框、1 / 2、填好第一筆、60% 高", !q("#exp-edit-overlay").hidden && q("#xe-h2").textContent === "記一筆" && out.記帳.數 === "1 / 2" &&
      q("#xe-title").value === "一蘭" && q("#xe-amount").value === "2980" && Math.abs(out.記帳.高 - out.記帳.六成) <= 2, out.記帳);
    q("#exp-edit-form").requestSubmit(); await wait(80);
    ok("記帳:存了 → 往左滑走", q("#exp-edit-form").classList.contains("slide-out"), "");
    await wait(450);
    ok("記帳:2 / 2、藥妝", look("exp-edit-form").數 === "2 / 2" && q("#xe-title").value === "藥妝", look("exp-edit-form"));
    q("#exp-edit-form").requestSubmit(); await wait(500);
    ok("記帳:最後一筆存了 → 關掉、記了 2 筆", q("#exp-edit-overlay").hidden && (w.__rows.expenses || []).length - exp0 === 2, (w.__rows.expenses || []).length - exp0);
    /* 只有一筆:不疊、不寫幾分之幾、不是 60% 固定高 */
    await ask("expense", [{ title: "便利商店", amount: 600, currency: "JPY", date: "2026-10-05", category: "餐飲" }]);
    out.一筆 = look("exp-edit-form");
    ok("只有一筆:不疊卡片、不寫幾分之幾", !out.一筆.數 && !out.一筆.後一, out.一筆);
    q("#xe-cancel").click(); await wait(80);
    /* 自己點「改這一筆」:不疊、標題是改這一筆 */
    var eb = q("[data-edit-exp]"); if (eb) { eb.click(); await wait(100); }
    ok("改既有的一筆:標題「改這一筆」、不疊", q("#xe-h2").textContent === "改這一筆" && !look("exp-edit-form").數, look("exp-edit-form"));
  }
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
