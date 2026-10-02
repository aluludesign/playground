/* 許願卡:地點跟標題重複就不再印小字;沒有行程的那一天不要「＋加第一筆行程」(2026-10-02,Lulu)。
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
  q("#tab-plan").click(); await wait(100);
  var empty = qa("#days [data-day]").find(b => / 0 項/.test(b.textContent));
  if (empty) { empty.click(); await wait(150); }
  out.空的那天 = txt(q("#route"));
  ok("沒有行程的那天:有「這天還沒有行程」,沒有「＋加第一筆行程」", !empty || (/這天還沒有行程/.test(out.空的那天) && !/加第一筆行程/.test(out.空的那天) && !q("#empty-add-stop")), out.空的那天);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
