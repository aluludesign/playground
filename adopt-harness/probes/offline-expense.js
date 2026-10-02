/* 沒網路也能記帳(2026-09-29,Lulu:在地鐵裡沒網路也想記帳)。
 *   ./probe.sh probes/offline-expense.js                 開著的時候斷線:記的那筆排著,網路回來自己送,不重複
 *   SNAP=1 SNAPCAN=1 ./probe.sh probes/offline-expense.js 打開時就沒網路(看副本):照樣記得了,取消也不用網路
 *   SNAP=1 ./probe.sh probes/offline-expense.js          舊版存的副本(沒帶權限):照舊唯讀,記一筆不出現
 */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var shown = e => !!e && !e.hidden && e.getBoundingClientRect().width > 0;
var OUT = Object.keys(w.localStorage).filter(k => /^trippps-outbox:/.test(k))[0];
var outbox = () => { try { return JSON.parse(w.localStorage.getItem(Object.keys(w.localStorage).filter(k => /^trippps-outbox:/.test(k))[0]) || "[]"); } catch (e) { return "壞掉"; } };
var snap = !!w.localStorage.getItem(Object.keys(w.localStorage).filter(k => /^trippps-snap:/.test(k))[0] || "x");
return (async function () {
  var out = { }, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  q("#tab-cost").click(); await wait(150);
  var offlineBoot = /離線/.test(txt("#cloud-msg"));
  out.開機 = offlineBoot ? "離線(副本)" : "連線中";
  out.狀態列 = txt("#cloud-msg");
  out.記一筆 = shown(q("#add-exp-btn"));
  if (offlineBoot && !/只能記帳/.test(out.狀態列)) {
    ok("舊版副本(沒帶權限)→ 照舊唯讀:記一筆不出現、狀態列說不能編輯", !out.記一筆 && /不能編輯/.test(out.狀態列), out);
    return fin();
  }
  ok("記一筆看得到", out.記一筆, out);
  if (offlineBoot) ok("離線看副本時,狀態列說「只能記帳」", /只能記帳/.test(out.狀態列), out.狀態列);

  /* 斷線:連線中那條路把 /api/ 全部弄斷(副本那條路本來就斷) */
  var real = w.fetch, down = true;
  w.fetch = function (u, i) { return down && /\/api\//.test(String(u)) ? Promise.reject(new TypeError("Failed to fetch")) : real(u, i); };
  var before = (w.__rows.expenses || []).length;

  q("#add-exp-btn").click(); await wait(100);
  q("#xe-title").value = "地鐵便利商店";
  q("#xe-amount").value = "480";
  if (!q("#xe-who input:checked")) q("#xe-who input").checked = true;
  q("#exp-edit-form").requestSubmit(); await wait(300);

  out.斷線後 = { 清單有: /地鐵便利商店/.test(txt("#exp-list")), 還沒送出: /還沒送出/.test(txt("#exp-list")),
               狀態列: txt("#cloud-msg"), 排隊: outbox().length, 提示: txt("#sync") };
  ok("沒網路記的那筆**留在畫面上**(以前會被拿掉、說沒存進 Notion)", out.斷線後.清單有, out.斷線後);
  ok("標著「還沒送出」", out.斷線後.還沒送出, out.斷線後);
  ok("狀態列說 1 筆還沒送出", /1 筆花費還沒送出/.test(out.斷線後.狀態列), out.斷線後.狀態列);
  ok("存在這台手機(outbox 1 筆)", out.斷線後.排隊 === 1, out.斷線後.排隊);
  ok("伺服器那邊還沒有", (w.__rows.expenses || []).length === before, (w.__rows.expenses || []).length);
  /* 還沒送出的不能改(會改到一筆 Notion 還沒有的東西),只能取消 */
  var row = [].filter.call(d.querySelectorAll("#exp-list .exp"), e => /地鐵便利商店/.test(e.textContent))[0];
  out.那一列的按鈕 = row ? [].map.call(row.querySelectorAll("button"), b => b.textContent.trim()) : null;
  ok("還沒送出的那一列只有「取消這筆」,沒有「改」", out.那一列的按鈕 && out.那一列的按鈕.join() === "取消這筆", out.那一列的按鈕);
  ok("分帳照樣算進去(錢是真的花了)", /地鐵便利商店/.test(txt("#exp-list")), "");

  if (offlineBoot) {
    /* 副本那條路:取消不用網路 */
    row.querySelector("[data-del-exp]").click(); await wait(200);
    out.取消後 = { 清單有: /地鐵便利商店/.test(txt("#exp-list")), 排隊: outbox().length, 狀態列: txt("#cloud-msg") };
    ok("取消這筆 → 從畫面和排隊裡拿掉", !out.取消後.清單有 && out.取消後.排隊 === 0 && !/還沒送出/.test(out.取消後.狀態列), out.取消後);
    return fin();
  }

  /* 網路回來了 */
  down = false;
  w.dispatchEvent(new Event("online")); await wait(400);
  var sent = (w.__rows.expenses || []).filter(e => e.title === "地鐵便利商店");
  out.連回來 = { 伺服器幾筆: sent.length, 帶編號: sent[0] && sent[0].cid, 畫面幾筆: [].filter.call(d.querySelectorAll("#exp-list .exp"), e => /地鐵便利商店/.test(e.textContent)).length,
               還沒送出: /還沒送出/.test(txt("#exp-list")), 排隊: outbox().length, 狀態列: txt("#cloud-msg"), 提示: txt("#sync") };
  ok("網路回來 → 自己送出,伺服器多一筆", out.連回來.伺服器幾筆 === 1, out.連回來);
  ok("送的時候帶著送出編號(重送才認得出同一筆)", !!out.連回來.帶編號, out.連回來);
  ok("畫面上只剩一筆,不再標還沒送出", out.連回來.畫面幾筆 === 1 && !out.連回來.還沒送出, out.連回來);
  ok("排隊清空,狀態列不再說還沒送出", out.連回來.排隊 === 0 && !/還沒送出/.test(out.連回來.狀態列), out.連回來);
  ok("講一聲送出了", /送出了 1 筆/.test(out.連回來.提示), out.連回來.提示);
  return fin();
  function fin() { out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || []; return out; }
})();
