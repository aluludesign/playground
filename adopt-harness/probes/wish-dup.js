/* 許願卡:地點跟標題重複就不再印小字;沒有行程的那一天不要「＋加第一筆行程」(2026-10-02,Lulu)。
 * 行程卡也一樣(2026-10-04,Lulu:「行程小卡怎麼還有重複的地名」)—— 天氣照樣留著。
 *   WIDTH=390 ./probe.sh probes/wish-dup.js */
var q = s => d.querySelector(s), qa = s => Array.from(d.querySelectorAll(s)), wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = e => (e && e.textContent || "").replace(/\s+/g, " ").trim();
return (async function () {
  await wait(300);
  var bad = [], out = {};
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  /* 拿一張既有的願望卡,把地點改成跟標題一樣 / 不一樣,重畫後看小字 */
  var rows = w.__rows || {};
  q("#tab-wish").click(); await wait(150);
  var cards = qa("#wishbox .wish");
  out.卡 = cards.map(c => txt(c.querySelector(".wt")) + " | " + txt(c.querySelector(".wm")));
  cards.forEach(c => {
    var t = txt(c.querySelector(".wt")).replace(/^\d+\s*/, "").replace(/📍/g, "").trim();
    var spans = qa.call(null, "#wishbox .wish[data-wish='" + c.dataset.wish + "'] .wm > span").map(txt);
    var tk = t.replace(/\s+/g, "").toLowerCase();
    ok("「" + t + "」那張的小字沒有再印一次地名(標題裡已經有的)", !spans.some(s => { var k = s.replace(/\s+/g, "").toLowerCase(); return k && tk.indexOf(k) >= 0; }), spans);
  });
  /* 行程卡:先多塞一筆「地點跟標題不一樣」的(那種要照樣印地點),重新整理之後每一天都看 */
  (rows.itinerary || []).push({ id: "sdiff", day: "2026-10-05", time: "19:00", title: "晚餐", place: "一蘭 上野店", note: "" });
  q("#tab-plan").click(); await wait(100);
  q("#menu-btn").click(); await wait(60); q("#cloud-sync").click(); await wait(600);
  if (!q("#menu-pop").hidden) q("#menu-btn").click();
  out.行程 = [];
  /* 每點一天 #days 會重畫,手上的舊按鈕就脫離畫面了(點了沒反應)—— 所以每次用日期重新找 */
  for (var dd of qa("#days [data-day]").map(b => b.dataset.day)) {
    q('#days [data-day="' + dd + '"]').click(); await wait(150);
    qa("#route .stop").forEach(r => {
      var ti = txt(r.querySelector(".ti")).replace(/📍/g, "").trim(), pl = r.querySelector(".pl");
      var plain = pl ? txt((function (c) { c.querySelectorAll(".wx").forEach(x => x.remove()); return c; })(pl.cloneNode(true))) : "";
      out.行程.push(ti + " | " + plain);
      var tk = ti.replace(/\s+/g, "").toLowerCase(), pk = plain.replace(/\s+/g, "").toLowerCase();
      ok("行程「" + ti + "」:地點沒有再印一次標題裡已經有的地名", !pk || tk.indexOf(pk) < 0, plain);
      if (pl && !plain) ok("行程「" + ti + "」:地名藏起來後那一行只剩天氣、天氣不縮排", !!pl.querySelector(".wx") && pl.classList.contains("wx-only") && w.getComputedStyle(pl.querySelector(".wx")).marginLeft === "0px", pl.innerHTML);
    });
  }
  ok("淺草寺參拜(地點 淺草寺)、明治神宮(地點 明治神宮)不印地點;晚餐照樣印「一蘭 上野店」",
    out.行程.indexOf("淺草寺參拜 | ") > -1 && out.行程.indexOf("明治神宮 | ") > -1 && out.行程.indexOf("晚餐 | 一蘭 上野店") > -1, out.行程);
  var empty = qa("#days [data-day]").find(b => / 0 項/.test(b.textContent));
  if (empty) { empty.click(); await wait(150); }
  out.空的那天 = txt(q("#route"));
  ok("沒有行程的那天:有「這天還沒有行程」,沒有「＋加第一筆行程」", !empty || (/這天還沒有行程/.test(out.空的那天) && !/加第一筆行程/.test(out.空的那天) && !q("#empty-add-stop")), out.空的那天);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
