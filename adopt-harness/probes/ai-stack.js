/* AI 一次讀到好幾段交通:卡片疊起來(2026-10-02,Lulu)。
 * 最多畫三張(前面一張 + 後面兩張),右上角寫「第幾 / 共幾」。
 * 2026-10-12 起是「一批」:不再存一張滑走一張 —— 點上面編號換筆(疊的張數照「後面還有幾筆」畫),最後「全部存起來」一次存、關掉。
 *   WIDTH=390 ./probe.sh probes/ai-stack.js */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var vis = id => !q("#" + id).hidden;
var next = null, real = w.fetch;
w.fetch = function (u, init) {
  if (/\/api\/ai/.test(String(u))) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: next }) });
  return real(u, init);
};
var leg = { kind: "", no: "", company: "", depart: "", from: "", arrive: "", to: "", code: "", dir: "", match: "", note: "", seats: [] };
return (async function () {
  var out = {}, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var legs = [["竹芝碼頭", "大島"], ["大島", "神津島"], ["神津島", "新島"], ["新島", "式根島"], ["式根島", "竹芝碼頭"]]
    .map((x, i) => Object.assign({}, leg, { kind: "船", company: "東海汽船", depart: "2026-10-0" + (4 + (i > 2 ? 1 : 0)) + "T" + String(8 + i).padStart(2, "0") + ":00", from: x[0], to: x[1] }));
  next = { intent: "transport", title: "", day: "", time: "", note: "", message: "", legs: legs };
  q("#ai-btn").click(); await wait(80); q("#ai-text").value = "船票"; q("#ai-form").requestSubmit(); await wait(300);
  var st = () => ({ 數: q("#fl-stack-n").textContent, 後一: vis("fl-g1"), 後二: vis("fl-g2"), 從: q("#fl-from").value, 開著: vis("flight-overlay") });
  out.第1 = st();
  ok("5 段:第 1 張,寫「1 / 5」,後面畫兩張(最多三張的樣子)", out.第1.數 === "1 / 5" && out.第1.後一 && out.第1.後二 && out.第1.從 === "竹芝碼頭", out.第1);
  /* 後面那兩張要比前面小、比較下面(景深) */
  var rf = q("#flight-form").getBoundingClientRect(), r1 = q("#fl-g1").getBoundingClientRect(), r2 = q("#fl-g2").getBoundingClientRect();
  out.大小 = { 前: Math.round(rf.width), 後一: Math.round(r1.width), 後二: Math.round(r2.width), 前底: Math.round(rf.bottom), 後一底: Math.round(r1.bottom), 後二底: Math.round(r2.bottom) };
  ok("好幾段:卡片一律螢幕 60% 高", Math.abs(rf.height - w.innerHeight * 0.6) <= 2, { 高: Math.round(rf.height), 六成: Math.round(w.innerHeight * 0.6) });
  ok("景深:越後面越窄、底邊越往下露出來", rf.width > r1.width && r1.width > r2.width && r1.bottom > rf.bottom && r2.bottom > r1.bottom, out.大小);
  var tab = async i => { d.querySelectorAll("#flight-form .batch-tabs input")[i].click(); await wait(120); };
  await tab(1);
  out.第2 = st();
  ok("點 2:換第 2 段,「2 / 5」,這張在中間(不滑走)", out.第2.數 === "2 / 5" && out.第2.從 === "大島" && !q("#flight-form").classList.contains("slide-out") && out.第2.後二, out.第2);
  await tab(3);
  out.第4 = st();
  ok("點 4(4 / 5):後面只剩一張", out.第4.數 === "4 / 5" && out.第4.後一 && !out.第4.後二, out.第4);
  await tab(4);
  out.第5 = st();
  ok("點 5(5 / 5):後面沒有卡了", out.第5.數 === "5 / 5" && !out.第5.後一 && !out.第5.後二, out.第5);
  await tab(2);
  q("#fl-skip").click(); await wait(120);
  ok("第 3 段「不要這筆」→ 剩 4 筆", q("#fl-stack-n").textContent.trim().endsWith("/ 4"), st());
  q("#flight-form").requestSubmit(); await wait(1500);
  ok("全部存起來 → 關掉", !vis("flight-overlay"), st());
  var ships = (w.__rows.flights || []).filter(f => f.kind === "船").length;
  ok("存了 4 段(不要的那一段沒存)", ships === 4, ships);
  q("[data-flight-add]") && (q("#tab-fly").click(), await wait(60), q("#fly-add").click(), await wait(100));
  ok("自己按「加一段交通」:不疊卡片、不寫幾分之幾", !vis("fl-g1") && !vis("fl-stack-n"), st());
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
