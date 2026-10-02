/* 一般成員用 AI 許願:AI 那句話只在「許一個願望」對話框裡,按取消之後許願清單上不能留著它(2026-10-02,Lulu:
 * 「沒按確定為什麼還會看到那個願望被加到許願清單裡的提示文字」)。
 *   PAGE='/index.html?fake=member' WIDTH=390 ./probe.sh probes/ai-wish-note.js */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var real = w.fetch;
w.fetch = function (u, init) {
  if (/\/api\/ai/.test(String(u))) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: {
    intent: "wish", title: "淺草寺", day: "", time: "", note: "", amount: 0, currency: "", date: "", category: "", legs: [], items: [{ title: "淺草寺" }], message: "看起來是想去的地方" } }) });
  return real(u, init);
};
return (async function () {
  await wait(300);
  var bad = [], out = {};
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var n0 = (w.__rows.wishes || []).length;
  q("#ai-btn").click(); await wait(80); q("#ai-text").value = "想去淺草寺"; q("#ai-form").requestSubmit(); await wait(400);
  out.開著 = { 對話框: !q("#wish-add-overlay").hidden, 框裡那句: q("#wf-ai").hidden ? "" : q("#wf-ai").textContent, 清單上那句: q("#wish-msg").hidden ? "" : q("#wish-msg").textContent };
  ok("AI 那句在對話框裡,清單上沒有", out.開著.對話框 && /看起來是想去的地方/.test(out.開著.框裡那句) && /許下去/.test(out.開著.框裡那句) && !out.開著.清單上那句, out.開著);
  q("#wf-cancel").click(); await wait(150);
  out.取消後 = { 清單上那句: q("#wish-msg").hidden ? "" : q("#wish-msg").textContent, 多了幾筆: (w.__rows.wishes || []).length - n0 };
  ok("按取消:清單上沒有任何「加進去了」的字,也沒有多一筆", !out.取消後.清單上那句 && out.取消後.多了幾筆 === 0, out.取消後);
  q("#add-wish-btn").click(); await wait(100);
  ok("之後自己按「＋許願」:沒有 AI 那句", q("#wf-ai").hidden, q("#wf-ai").textContent);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
