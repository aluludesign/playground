/* AI 對話框用過一次、關掉、再打開:「AI 幫你加」那張卡要跟第一次一模一樣(2026-10-02,Lulu:「第二次點進去對話框變形了」)。
 * 每個角色都量:團主、一般成員、副團主。順便量許願表、記一筆(也會被疊卡片包一層)。
 *   WIDTH=390 ./probe.sh probes/ai-reopen.js
 *   PAGE='/index.html?fake=member' ...      PAGE='/index.html?fake=member&can=plan' ... */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var real = w.fetch;
w.fetch = function (u, init) {
  if (/\/api\/ai/.test(String(u))) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: {
    intent: "wish", title: "淺草寺", day: "", time: "", note: "", amount: 0, currency: "", date: "", category: "", legs: [], items: [{ title: "淺草寺" }], message: "" } }) });
  return real(u, init);
};
var box = s => { var r = q(s).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(","); };
return (async function () {
  await wait(300);
  var bad = [], out = {};
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  q("#ai-btn").click(); await wait(120);
  out.第一次 = box("#ai-form");
  q("#ai-text").value = "想去淺草寺"; q("#ai-form").requestSubmit(); await wait(400);
  /* 不管走到哪一張(確認卡或許願表),都按取消 */
  var c = ["#ai-cancel2", "#wf-cancel", "#ai-cancel"].map(s => q(s)).find(b => b && !b.closest("[hidden]"));
  out.取消 = c && c.id; if (c) c.click(); await wait(150);
  q("#ai-btn").click(); await wait(120);
  out.第二次 = box("#ai-form");
  ok("第二次打開 AI:卡片的位置和大小跟第一次一樣", out.第一次 === out.第二次, out);
  q("#ai-cancel").click(); await wait(100);
  /* 再來一次:這次真的存一筆(走完疊卡片那條路)再打開 */
  q("#ai-btn").click(); await wait(100); q("#ai-text").value = "想去淺草寺"; q("#ai-form").requestSubmit(); await wait(400);
  var save = ["#ai-confirm", "#wish-form"].map(s => q(s)).find(f => f && !f.hidden && !f.closest("[hidden]"));
  if (save) { save.requestSubmit(); await wait(600); }
  q("#ai-btn").click(); await wait(120);
  out.存完再開 = box("#ai-form");
  ok("存了一筆之後再打開 AI:一樣沒變形", out.第一次 === out.存完再開, out);
  q("#ai-cancel").click(); await wait(100);
  /* 手動開的許願表也不能變形 */
  q("#add-wish-btn").click(); await wait(120);
  out.許願表 = box("#wish-form");
  q("#wf-cancel").click(); await wait(80);
  q("#add-wish-btn").click(); await wait(120);
  ok("手動「＋許願」兩次:許願表一樣大", out.許願表 === box("#wish-form"), { 第一次: out.許願表, 第二次: box("#wish-form") });
  q("#wf-cancel").click();
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
