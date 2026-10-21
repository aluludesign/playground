/* AI 對話框先選類型(2026-10-21,Lulu):許願/行程/交通/記帳單選,放在「想做什麼」框裡、拍照選圖上面;
 * 沒選就不能按「交給 AI」、旁邊講為什麼;只放有權限的;只能許願的人整排不出現、直接當許願;選的類型跟著送給 AI。
 *   WIDTH=390 ./probe.sh probes/ai-kind-chips.js                               團主:四顆
 *   PAGE='/index.html?fake=member' WIDTH=390 ./probe.sh probes/ai-kind-chips.js  一般成員:沒有 chips、直接許願
 *   PAGE='/index.html?fake=member&can=cost' ...                                 只勾記帳的副團主:許願、記帳 */
var q = s => d.querySelector(s), qa = s => Array.from(d.querySelectorAll(s)), wait = ms => new Promise(r => w.setTimeout(r, ms));
var vis = e => !!e && !e.closest("[hidden]") && e.getBoundingClientRect().height > 0;
var sent = null, real = w.fetch;
w.fetch = function (u, init) {
  if (/\/api\/ai/.test(String(u)) && init && init.method === "POST") { try { sent = JSON.parse(init.body); } catch (_) {}
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: { intent: "wish", title: "淺草寺", day: "", time: "", note: "", amount: 0, currency: "", date: "", category: "", legs: [], items: [{ title: "淺草寺" }], parts: [], message: "" } }) }); }
  return real(u, init);
};
return (async function () {
  await wait(300);
  var nav = (w.performance.getEntriesByType("navigation")[0] || {}).name || "", bad = [], out = {};
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var member = /fake=member/.test(nav), costOnly = /can=cost/.test(nav);
  q("#ai-btn").click(); await wait(120);
  out.chips = qa("[data-ai-kind-chip]").filter(vis).map(c => c.textContent.trim());
  out.按鈕能按 = !q("#ai-go").disabled; out.說明 = vis(q("#ai-kind-hint"));
  if (member && !costOnly) {
    ok("一般成員:沒有 chips、「交給 AI」照常可按、沒有「先選」那句", !vis(q("#ai-kinds")) && out.按鈕能按 && !out.說明, out);
    q("#ai-text").value = "想去淺草寺"; q("#ai-form").requestSubmit(); await wait(400);
    ok("送出去的類型是許願", sent && sent.kind === "wish", sent && sent.kind);
  } else {
    var want = costOnly ? "許願,記帳" : "許願,行程,交通,記帳";
    ok("只放有權限的類型:" + want + ";在「想做什麼」框裡、拍照選圖上面", out.chips.join() === want && q("#ai-box").contains(q("#ai-kinds")) &&
      q("#ai-kinds").getBoundingClientRect().bottom <= q("#ai-img-row").getBoundingClientRect().top + 1, out.chips);
    ok("沒選:「交給 AI」不能按,旁邊講「先選要加什麼」", !out.按鈕能按 && out.說明 && /先選要加什麼/.test(q("#ai-kind-hint").textContent), out);
    var pick = costOnly ? "expense" : "transport";
    var r = q('[data-ai-kind-chip="' + pick + '"] input'); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); await wait(40);
    out.選了 = { 能按: !q("#ai-go").disabled, 說明: vis(q("#ai-kind-hint")), 提示字: q("#ai-text").placeholder };
    ok("選了一類:可以按、說明收起來、提示字換成那一類的例子", out.選了.能按 && !out.選了.說明 && (costOnly ? /收據/ : /機票|高鐵/).test(out.選了.提示字), out.選了);
    q("#ai-text").value = "這張"; q("#ai-form").requestSubmit(); await wait(400);
    ok("送出去帶著選的類型", sent && sent.kind === pick, sent && sent.kind);
    ok("確認卡「加到哪裡」只剩許願、行程", qa("#ai-kind option").map(o => o.value).join() === "wish,stop", qa("#ai-kind option").map(o => o.value));
    ok("提示不再暗示可以混著丟", /不同類要分開送/.test(q("#ai-tip").textContent), q("#ai-tip").textContent);
  }
  q("#ai-btn").click(); await wait(120);
  ok("重新打開:又是沒選", qa('input[name="ai-kind-pick"]:checked').length === 0, "");
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
