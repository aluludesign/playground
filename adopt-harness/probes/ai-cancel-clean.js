/* AI 回一句「還缺什麼」(看不出要做什麼)→ 按取消 → 畫面上任何地方都不能留著那句話(2026-10-02,Lulu)。
 *   WIDTH=390 ./probe.sh probes/ai-cancel-clean.js                    團主(確認卡)
 *   PAGE='/index.html?fake=member' WIDTH=390 ./probe.sh ...          一般成員(許願表) */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var SAY = "只說了吃美食,請問具體想去哪家店或吃什麼呢?";
var real = w.fetch;
w.fetch = function (u, init) {
  if (/\/api\/ai/.test(String(u))) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: {
    intent: "unknown", title: "", day: "", time: "", note: "", amount: 0, currency: "", date: "", category: "", legs: [], items: [], message: SAY } }) });
  return real(u, init);
};
var visibleWith = t => Array.from(d.querySelectorAll("body *")).filter(e => {
  if (e.children.length && Array.from(e.children).some(c => (c.textContent || "").indexOf(t) >= 0)) return false;
  if ((e.textContent || "").indexOf(t) < 0) return false;
  var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest("[hidden]");
}).map(e => (e.id || e.className || e.tagName));
return (async function () {
  await wait(300);
  var bad = [], out = {};
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  q("#tab-wish").click(); await wait(100);
  q("#ai-btn").click(); await wait(80); q("#ai-text").value = "想吃美食"; q("#ai-form").requestSubmit(); await wait(400);
  out.問的時候 = visibleWith("只說了吃美食");
  var cancel = ["#ai-cancel2", "#ai-cancel", "#wf-cancel"].map(s => q(s)).find(b => b && !b.closest("[hidden]"));
  out.按了 = cancel && cancel.id; if (cancel) cancel.click(); await wait(200);
  out.取消後 = visibleWith("只說了吃美食");
  ok("按取消之後,畫面上哪裡都沒有那句話", out.取消後.length === 0, out);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
