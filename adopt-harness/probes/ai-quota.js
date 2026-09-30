/* AI 對話框裡的「今天還剩約幾次」(2026-09-29,Lulu:給會用 AI 的所有人看,放在這個對話框)。
 *   WIDTH=390 ./probe.sh probes/ai-quota.js
 * /api/ai 的 GET 由這支自己回(fixture 的假後端不管 AI)。 */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var shown = e => !!e && !e.hidden && e.getBoundingClientRect().height > 0;
var usage = null, gets = 0, real = w.fetch;
w.fetch = function (u, i) {
  if (/\/api\/ai/.test(String(u)) && !(i && i.method === "POST")) {
    gets++;
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ usage: usage }) });
  }
  return real(u, i);
};
return (async function () {
  var out = {}, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  async function look(u) {
    usage = u;
    q("#ai-btn").click(); await wait(200);
    var box = q("#ai-quota");
    var r = { 看得到: shown(box), 字: txt("#ai-quota"), 黃底: !!(box && box.querySelector(".note")) };
    q("#ai-cancel").click(); await wait(50);
    return r;
  }
  var RESET = "2026-09-19T07:00:00.000Z";   /* 台灣 15:00 */
  out.平常 = await look({ left: 420, total: 1020, used: 600, resetAt: RESET });
  ok("平常:一行灰字,講所有團共用、還剩約幾次、台灣時間幾點重算",
    out.平常.看得到 && !out.平常.黃底 && /所有團共用/.test(out.平常.字) && /約 420 次/.test(out.平常.字) && /台灣時間 15:00 重算/.test(out.平常.字), out.平常);
  out.快用完 = await look({ left: 60, total: 1020, used: 960, resetAt: RESET });
  ok("剩一成以下 → 黃底提醒「只剩約 N 次」", out.快用完.黃底 && /只剩約 60 次/.test(out.快用完.字), out.快用完);
  out.用完 = await look({ left: 0, total: 1020, used: 1020, resetAt: RESET });
  ok("用完 → 黃底,說大概用完了、幾點重算、可以先手動加", out.用完.黃底 && /大概用完了/.test(out.用完.字) && /15:00/.test(out.用完.字) && /手動加/.test(out.用完.字), out.用完);
  ok("用完了「交給 AI」照樣按得下去(數字是約的,Google 那邊說了才算)", !q("#ai-go").disabled, "");
  out.讀不到 = await look(null);
  ok("讀不到 → 整行不出現(不講一個錯的數字)", !out.讀不到.看得到, out.讀不到);
  ok("每打開一次問一次", gets === 4, gets);
  return fin();
  function fin() { out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || []; return out; }
})();
