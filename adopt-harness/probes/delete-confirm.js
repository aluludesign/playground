/* 刪東西之前要再確認一次(2026-10-03,Lulu:「刪除東西的時候要再次跳警告 alert 確認」)。
 * 行程 ✕、願望左滑「刪除」、花費「刪除」、交通「刪掉這一段」都要先跳 App 自己的確認對話框;
 * 取消、點外面、按 Esc 都不刪,按「刪除」才真的刪(畫面和假後端都要少一筆)。
 *   WIDTH=390 ./probe.sh probes/delete-confirm.js
 *   WIDTH=1440 ./probe.sh probes/delete-confirm.js */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var ov = () => q("#confirm-overlay");
var rows = k => (w.__rows[k] || []).length;
return (async function () {
  await wait(300);
  var out = {}, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var nativeAsked = 0;
  w.confirm = () => { nativeAsked++; return true; };   /* 不該再用瀏覽器的 confirm */
  /* 同一顆刪除鈕按三次:取消 → 點外面 → 刪除。每次都重新找,因為清單會重畫 */
  async function three(name, find, key, extra) {
    var r = { }, n0 = rows(key);
    var b = find(); if (!b) { ok(name + ":找得到刪除鈕", false, "沒有"); return r; }
    b.click(); await wait(120);
    r.標題 = txt("#cf-title"); r.內容 = txt("#cf-body"); r.按鈕 = txt("#cf-ok") + "/" + txt("#cf-cancel");
    var st = w.getComputedStyle(ov());
    r.在最上面 = +st.zIndex;
    ok(name + ":按刪除 → 先跳確認,還沒刪", !ov().hidden && rows(key) === n0, r);
    q("#cf-cancel").click(); await wait(150);
    ok(name + ":按取消 → 關掉、沒刪", ov().hidden && rows(key) === n0, rows(key) - n0);
    if (extra) await extra();
    b = find(); b.click(); await wait(120);
    ov().dispatchEvent(new MouseEvent("click", { bubbles: true }));   /* 點對話框外面(那一層本身) */
    await wait(150);
    ok(name + ":點外面 → 關掉、沒刪", ov().hidden && rows(key) === n0, rows(key) - n0);
    if (extra) await extra();
    b = find(); b.click(); await wait(120);
    q("#cf-ok").click(); await wait(400);
    r.刪了幾筆 = n0 - rows(key);
    ok(name + ":按刪除 → 真的刪掉一筆", ov().hidden && r.刪了幾筆 === 1, r.刪了幾筆);
    return r;
  }

  /* 行程:第一個有 ✕ 的 */
  q("#tab-plan").click(); await wait(150);
  out.行程 = await three("行程", () => q("#route [data-del-stop]"), "itinerary");
  ok("行程:標題、講出名字和日期", out.行程.標題 === "刪除這個行程?" && /^「.+」會從 \d\d\/\d\d 的行程刪掉/.test(out.行程.內容), out.行程);

  /* 願望:左滑露出來的那顆(直接按,露不露出來是另一支探針的事) */
  q("#tab-wish").click(); await wait(200);
  out.願望 = await three("願望", () => q("#wish-list [data-del-wish]"), "wishes");
  ok("願望:標題、講出名字", out.願望.標題 === "刪除這個願望?" && /^「.+」.*會從許願清單刪掉/.test(out.願望.內容), out.願望);

  /* 花費 */
  q("#tab-cost").click(); await wait(200);
  out.花費 = await three("花費", () => qa("#exp-list [data-del-exp]").find(b => b.textContent.trim() === "刪除"), "expenses");
  ok("花費:標題、講出名字和金額", out.花費.標題 === "刪除這筆花費?" && /^「.+」NT\$[\d,]+ 會從帳上刪掉/.test(out.花費.內容), out.花費);

  /* 交通:在「改這一段」的對話框裡按「刪掉這一段」,確認疊在它上面;取消後交通那張還開著 */
  q("#tab-fly").click(); await wait(200);
  var openLeg = async () => { if (q("#flight-overlay").hidden) { q("[data-flight-edit]").click(); await wait(150); } };
  await openLeg();
  out.交通 = await three("交通", () => q("#fl-del"), "flights", async () => {
    ok("交通:確認關掉後,交通那張還開著", !q("#flight-overlay").hidden, "");
  });
  ok("交通:標題、確認疊在交通那張上面", out.交通.標題 === "刪除這一段交通?" && out.交通.在最上面 > +w.getComputedStyle(q("#flight-overlay")).zIndex, out.交通);

  /* Esc 只關最上面那張(確認),交通那張留著 */
  await openLeg();
  if (q("#fl-del") && !q("#fl-del").hidden) {
    q("#fl-del").click(); await wait(120);
    d.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await wait(150);
    ok("Esc → 只關確認,交通那張還開著", ov().hidden && !q("#flight-overlay").hidden, { 確認: ov().hidden, 交通: q("#flight-overlay").hidden });
    q("#fl-cancel").click(); await wait(100);
  }

  /* 打開時焦點在整張卡上:Enter 不會誤刪,也不會在按鈕外畫一圈焦點框 */
  q("#tab-plan").click(); await wait(150);
  var sb = q("#route [data-del-stop]");
  if (sb) {
    sb.click(); await wait(120);
    var ae = d.activeElement, ring = qa("#confirm-overlay button, #confirm-form").filter(e => { var c = w.getComputedStyle(e); return c.outlineStyle !== "none" && parseFloat(c.outlineWidth) > 0; }).map(e => e.id);
    ok("打開時焦點在對話框上、不在刪除鈕(Enter 不會誤刪)", ae === q("#confirm-form"), ae && ae.id);
    ok("沒有任何一顆畫出焦點框", !ring.length, ring);
    ae.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await wait(100);
    ok("按 Enter 不會刪", !ov().hidden, "");
    q("#cf-cancel").click(); await wait(100);
  }

  ok("沒有用到瀏覽器自己的 confirm()", nativeAsked === 0, nativeAsked);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
