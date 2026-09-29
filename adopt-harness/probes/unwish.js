/* 從願望排進行程的,退得回願望區(Lulu,2026-09-30)。「改一項行程」裡那顆「退回願望區」:
 *   - 從願望來的(fixture 的 s3 築地,佳瑜許的、兩票)才有;手動加的(s1 淺草寺)沒有
 *   - 按了:行程少一筆、願望多一筆,許願人和票都還在;送出去的是「清掉日期」
 *   - 成員(沒有管行程)看不到筆,也就碰不到這顆 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var shown = e => !!e && !e.closest("[hidden]") && e.getBoundingClientRect().width > 0;
return (async function () {
  var out = {}, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  q('#days [data-day="2026-10-05"]').click(); await wait(150);
  q('[data-edit-stop="s1"]').click(); await wait(100);
  out.手動加的有按鈕 = shown(q("#se-unwish"));
  q("#se-cancel").click(); await wait(60);
  q('[data-edit-stop="s3"]').click(); await wait(100);
  out.從願望來的有按鈕 = shown(q("#se-unwish"));
  ok("只有從願望來的有「退回願望區」", !out.手動加的有按鈕 && out.從願望來的有按鈕, out);
  q("#se-unwish").click(); await wait(400);
  var sent = (w.__calls || []).filter(c => c.method === "PATCH" && /resource=itinerary/.test(c.url)).map(c => c.body).pop() || {};
  out.送出去 = { day: sent.day, time: sent.time, title: sent.title };
  out.行程還有 = qa('#route [data-stop="s3"]').length;
  var wsh = (w.__rows.wishes || []).find(x => x.id === "s3");
  out.願望 = wsh && { by: wsh.by, votes: wsh.votes };
  out.願望清單有 = !!q('#wish-list [data-wish="s3"], #wishbox [data-wish="s3"]');
  ok("送出去的是清掉日期、標題照舊", sent.day === null && sent.time === "" && sent.title === "築地市場吃海鮮", out.送出去);
  ok("行程少了它、願望清單多了它,許願人和兩票都在", out.行程還有 === 0 && out.願望清單有 && wsh && wsh.by === "chang_chiayu" && wsh.votes.length === 2, out);
  ok("對話框關了", q("#edit-overlay").hidden, "");
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過";
  out.errors = w.__errors || [];
  return out;
})();
