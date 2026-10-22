/* AI 等久一點(2026-10-12,Lulu:「常說 AI 太久沒回應,再試一次」):伺服器最多等 50 秒;
 * 讀超過 10 秒,按鈕從「AI 讀取中…」改成「還在讀…照片多會久一點」,回來之後換回「交給 AI」。
 *   WIDTH=390 ./probe.sh probes/ai-slow.js */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var real = w.fetch, release = null;
w.fetch = function (u, init) {
  if (/\/api\/ai/.test(String(u)) && init && init.method === "POST")
    return new Promise(r => { release = () => r({ ok: true, status: 200, json: () => Promise.resolve({ result: {
      intent: "wish", title: "淺草寺", day: "", time: "", note: "", amount: 0, currency: "", date: "", category: "", legs: [], items: [{ title: "淺草寺" }], parts: [], message: "" } }) }); });
  return real(u, init);
};
return (async function () {
  await wait(300);
  var out = {}, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  addAI(); await wait(100);
  q("#ai-text").value = "想去淺草寺"; q("#ai-form").requestSubmit(); await wait(300);
  out.剛按 = q("#ai-go").textContent;
  await wait(9000); out.九秒 = q("#ai-go").textContent;
  await wait(1500); out.十秒半 = q("#ai-go").textContent;
  ok("剛按、9 秒:「AI 讀取中…」;過 10 秒:「還在讀…照片多會久一點」", out.剛按 === "AI 讀取中…" && out.九秒 === "AI 讀取中…" && out.十秒半 === "還在讀…照片多會久一點", out);
  release(); await wait(400);
  out.回來 = { 按鈕: q("#ai-go").textContent, 能按: !q("#ai-go").disabled, 許願開了: !q("#wish-add-overlay").hidden || !q("#ai-confirm").hidden };
  ok("AI 回來:按鈕換回「交給 AI」、可以再按,接著開確認", out.回來.按鈕 === "交給 AI" && out.回來.能按 && out.回來.許願開了, out.回來);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
