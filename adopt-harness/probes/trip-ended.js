/* 團的生命週期(2026-10-01,Lulu):
 *   PAGE='/index.html?ended=1'                     團主,團結束:只能記帳、改花費;AI、行程、交通、許願、投票都關
 *   PAGE='/index.html?ended=1&fake=member'         一般成員,團結束:全部唯讀
 *   PAGE='/index.html?started=1'                   團主,進行中:第一天不能改、最後一天只能往後延
 *   PAGE='/index.html'                             團主,還沒開始:AI 讀收據 → 打開「記一筆」填好
 *   PAGE='/index.html?fake=member&can=cost'        只勾記帳的副團主:AI 讀收據也打開記一筆 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var shown = e => !!e && !e.closest("[hidden]") && e.getBoundingClientRect().width > 0;
var qs = w.location.search, member = /fake=member/.test(qs) && !/can=/.test(qs), ended = /ended=1/.test(qs), started = /started=1/.test(qs);
return (async function () {
  var out = { 情境: qs }, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var openSettings = async () => { q("#menu-btn").click(); q("#cloud-set").click(); if (!q("#menu-pop").hidden) q("#menu-btn").click(); await wait(100); };
  if (ended) {
    out.橫幅 = shown(q("#ended-bar")) ? txt("#ended-bar") : "(沒有)";
    out.AI = shown(q("#ai-btn")); out.加行程 = shown(q("#add-stop-btn"));
    q("#tab-wish").click(); await wait(80);
    out.許願 = shown(q("#add-wish-btn")); out.投票按得下去 = qa("#wish-list [data-vote]").some(b => !b.disabled);
    out.改願望 = qa("#wish-list [data-edit-wish], #wish-list [data-del-wish]").length;
    q("#tab-fly").click(); await wait(80); out.加交通 = !!q("[data-flight-add]");
    q("#tab-cost").click(); await wait(80); out.記一筆 = shown(q("#add-exp-btn"));
    ok("結束:AI、行程、許願、投票、改願望、交通都沒有", !out.AI && !out.加行程 && !out.許願 && !out.投票按得下去 && !out.改願望 && !out.加交通, out);
    if (member) ok("一般成員:不能記帳;橫幅講結束了、只能看", !out.記一筆 && /結束了,只能看/.test(out.橫幅) && !/記帳/.test(out.橫幅), out);
    else {
      ok("團主:還能記帳;橫幅講還可以記帳", out.記一筆 && /你還可以記帳/.test(out.橫幅), out);
      await openSettings();
      out.日期 = { 第一天鎖: q("#st-start").disabled, 最後一天鎖: q("#st-end").disabled, 說: txt("#st-date-note") };
      ok("團主:結束後日期鎖住", out.日期.第一天鎖 && out.日期.最後一天鎖 && /不能再改/.test(out.日期.說), out.日期);
      q("#st-cancel").click();
    }
  } else if (started) {
    ok("進行中:沒有結束的橫幅、AI 在", !shown(q("#ended-bar")) && shown(q("#ai-btn")), "");
    await openSettings();
    out.日期 = { 第一天鎖: q("#st-start").disabled, 最後一天鎖: q("#st-end").disabled, 最早: q("#st-end").min, 現在: q("#st-end").value, 說: txt("#st-date-note") };
    ok("進行中:第一天鎖、最後一天只能往後(min = 現在的最後一天)", out.日期.第一天鎖 && !out.日期.最後一天鎖 && out.日期.最早 === out.日期.現在 && /往後延/.test(out.日期.說), out.日期);
    q("#st-cancel").click();
  } else {
    /* AI 讀收據 */
    var real = w.fetch;
    w.fetch = function (u, i) {
      if (/\/api\/ai/.test(String(u)) && i && i.method === "POST") return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: {
        intent: "expense", title: "一蘭拉麵", amount: 2980, currency: "JPY", date: "2026-10-05", category: "餐飲", note: "", legs: [], message: "" } }) });
      return real(u, i);
    };
    q("#ai-btn").click(); await wait(100);
    out.提示字 = q("#ai-text").placeholder;
    q("#ai-text").value = "這張收據"; q("#ai-form").requestSubmit(); await wait(400);
    out.記一筆 = { 開著: !q("#exp-form").hidden, 分頁: (q('.tab[aria-selected="true"]') || {}).id, 項目: q("#ef-title").value, 金額: q("#ef-amount").value, 幣別: q("#ef-cur").value, 日期: q("#ef-date").value, 分類: q("#ef-cat").value, AI關了: q("#ai-overlay").hidden };
    ok("提示字有「收據」的例子", /收據/.test(out.提示字), out.提示字);
    ok("AI 讀收據 → 到花費頁、打開記一筆,項目/金額/幣別/日期/分類都填好", out.記一筆.開著 && out.記一筆.分頁 === "tab-cost" && out.記一筆.項目 === "一蘭拉麵" &&
      out.記一筆.金額 === "2980" && out.記一筆.幣別 === "JPY" && out.記一筆.日期 === "2026-10-05" && out.記一筆.分類 === "food" && out.記一筆.AI關了, out.記一筆);
  }
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過";
  out.errors = w.__errors || [];
  return out;
})();
