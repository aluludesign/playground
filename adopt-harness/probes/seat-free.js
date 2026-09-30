/* 座位不檢查格式(Lulu,2026-09-30:輸入什麼就是什麼)。以前飛機的座位要像 27A,「A25」會被擋 */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var set = (id, v) => { var e = q("#" + id); e.value = v; e.dispatchEvent(new w.Event("input", { bubbles: true })); };
return (async function () {
  var out = {}, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  q("#tab-fly").click(); await wait(100);
  q("[data-flight-edit]").click(); await wait(100);   /* MM626 */
  set("fl-seat-chang_chiayu", "A25"); set("fl-seat-hsieh_chinhui", "靠窗 b3");
  q("#flight-form").requestSubmit(); await wait(400);
  out.錯誤 = (q("#fl-err").textContent || "").trim();
  out.存下去 = (w.__calls || []).filter(c => /resource=seats/.test(c.url) && c.method !== "GET").map(c => c.body.passenger + "=" + c.body.seat);
  ok("A25、靠窗 b3 都存得進去,照原樣(不轉大寫)", !out.錯誤 && q("#flight-overlay").hidden &&
    out.存下去.indexOf("chang_chiayu=A25") >= 0 && out.存下去.indexOf("hsieh_chinhui=靠窗 b3") >= 0, out);
  out.卡上 = (q("#board-wrap .board") || {}).textContent;
  ok("交通卡上看得到", /A25/.test(out.卡上 || "") && /靠窗 b3/.test(out.卡上 || ""), out.卡上);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過";
  out.errors = w.__errors || [];
  return out;
})();
