/* 全站一顆「＋」(2026-10-22,Lulu):行程、許願、交通、花費四頁右下角,AI 和手動合併。
 *   團主:            WIDTH=390 ./probe.sh probes/add-fab.js            (也跑 1440)
 *   一般成員:        PAGE='/index.html?fake=member' WIDTH=390 ./probe.sh probes/add-fab.js
 *   只勾記帳的副團主:PAGE='/index.html?fake=member&can=cost' WIDTH=390 ./probe.sh probes/add-fab.js
 * 看:哪幾頁有＋、樣子照搬以前的 ✨ AI、預設選這一頁那一類、只列有權限的、一起記帳只在行程/交通、
 *     手動那邊寫「不用 AI 次數」、第一次的 AI 說明(不再顯示)、最後一列的 ✎ ✕ 捲得出來不被＋蓋住。 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var shown = e => !!e && !e.closest("[hidden]") && e.getClientRects().length > 0;
var qs = w.location.search, member = /fake=member/.test(qs), can = (/[?&]can=([a-z,]*)/.exec(qs) || [])[1] || "";
var kindsNow = () => shown(q("#add-kinds-f")) ? qa("[data-add-kind]").filter(c => !c.hidden).map(c => c.textContent.trim()) : ["(不用選)"];
var picked = () => { var c = q('input[name="add-kind"]:checked'); return c ? c.value : ""; };
/* 把最後一列的按鈕捲到最底,看它有沒有被＋蓋住、按不按得到 */
function lastRow(sel) {
  var bs = qa(sel).filter(b => b.getClientRects().length);
  if (!bs.length) return { 沒有: sel };
  var b = bs[bs.length - 1];
  for (var e = b.parentElement; e; e = e.parentElement) if (e.scrollHeight > e.clientHeight + 1) e.scrollTop = e.scrollHeight;
  d.scrollingElement.scrollTop = d.scrollingElement.scrollHeight;
  var r = b.getBoundingClientRect(), f = q("#add-fab").getBoundingClientRect();
  var cover = !(r.right <= f.left || r.left >= f.right || r.bottom <= f.top || r.top >= f.bottom);
  var hit = d.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { 蓋到: cover, 按得到: !!hit && (hit === b || b.contains(hit)), 鈕: [Math.round(r.left), Math.round(r.top), Math.round(r.bottom)], 加號: [Math.round(f.left), Math.round(f.top)] };
}
return (async function () {
  await wait(300);
  try { w.localStorage.removeItem("trippps-ai-intro-off"); } catch (_) {}
  var out = { 情境: qs, 寬: w.innerWidth }, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  /* 哪幾頁有＋ */
  out.哪幾頁 = {};
  ["plan", "wish", "fly", "cost", "split"].forEach(t => { out.哪幾頁[t] = fabOn(t); });
  var want = member ? { plan: /plan/.test(can), wish: true, fly: /seat/.test(can), cost: /cost/.test(can), split: false }
                    : { plan: true, wish: true, fly: true, cost: true, split: false };
  ok("＋只出現在這個人能加東西的那幾頁(分帳頁沒有)", JSON.stringify(out.哪幾頁) === JSON.stringify(want), { 實際: out.哪幾頁, 應該: want });
  ok("各頁原本的新增鈕和頂列的 ✨ AI 都拿掉了", !q("#add-stop-btn") && !q("#add-wish-btn") && !q("#fly-add") && !q("#add-exp-btn") && !q("#ai-btn"), "");
  /* 樣子照搬以前的 ✨ AI:漸層、邊框、虹光掃掠那幾層;上面只有「＋」 */
  fabOn("wish");
  var fab = q("#add-fab"), cs = getComputedStyle(fab);
  out.樣子 = { 底: cs.backgroundImage.slice(0, 40), 框: cs.borderTopWidth + " " + cs.borderTopStyle, 圓角: cs.borderTopLeftRadius, 層: [".steel-iridescent-overlay", ".white-sweep-flare", ".steel-content-layer"].map(s => !!fab.querySelector(s)),
    字: fab.textContent.trim(), 名: fab.getAttribute("aria-label"), 大小: [fab.offsetWidth, fab.offsetHeight], 位置: getComputedStyle(fab).position };
  ok("＋的樣子照 ✨ AI(漸層、有框、三層都在)、上面只有「＋」、念得出「新增」", /linear-gradient/.test(out.樣子.底) && /solid/.test(out.樣子.框) && out.樣子.層.every(Boolean) &&
    out.樣子.字 === "＋" && out.樣子.名 === "新增" && out.樣子.位置 === "fixed", out.樣子);
  var fr = fab.getBoundingClientRect(), tabs = q(".tabs").getBoundingClientRect();
  out.右下角 = { 右邊空: Math.round(w.innerWidth - fr.right), 下緣: Math.round(fr.bottom), 分頁列頂: Math.round(tabs.top) };
  ok("在右下角;手機在底部分頁列上方", out.右下角.右邊空 >= 8 && out.右下角.右邊空 <= 40 && (w.innerWidth > 760 || fr.bottom <= tabs.top), out.右下角);
  /* 按下去:先選要加什麼,預設這一頁那一類 */
  out.對話框 = {};
  for (const t of ["plan", "wish", "fly", "cost"]) {
    if (!fabOn(t)) continue;
    q("#add-fab").click(); await wait(120);
    var intro = shown(q("#ai-intro-overlay"));
    if (intro) { out.第一次說明 = txt("#ai-intro-overlay"); q("#ai-intro-ok").click(); await wait(50); }
    out.對話框[t] = { 類型: kindsNow().join(","), 選好: picked(), 一起記帳: shown(q("#add-also-f")), 模式: q('[data-add-mode][aria-pressed="true"]').dataset.addMode,
      手動那顆: txt('[data-add-mode="hand"]'), 第一次說明: intro };
    q("#ai-cancel").click(); await wait(50);
  }
  var tabKind = { plan: "stop", wish: "wish", fly: "transport", cost: "expense" };
  Object.keys(out.對話框).forEach(t => {
    var o = out.對話框[t];
    ok(t + ":預設選好這一頁那一類、用 AI、手動那顆寫「不用 AI 次數」", o.選好 === tabKind[t] && o.模式 === "ai" && /不用 AI 次數/.test(o.手動那顆), o);
    var mayCost = !member || /cost/.test(can);
    ok(t + ":「一起記帳」只在行程、交通,而且要能記帳", o.一起記帳 === ((t === "plan" || t === "fly") && mayCost), o);
  });
  if (!member) ok("團主:四種都能選", (out.對話框.plan || {}).類型 === "許願,行程,交通,記帳", out.對話框.plan);
  if (member && !can) ok("一般成員:只能許願 → 不用選(整排不出現)", (out.對話框.wish || {}).類型 === "(不用選)", out.對話框.wish);
  if (member && can === "cost") ok("只勾記帳的副團主:許願、記帳", (out.對話框.cost || {}).類型 === "許願,記帳", out.對話框.cost);
  /* 第一次用 AI 才跳說明;沒勾「不再顯示」→ 這次開著的頁面不再講;內容講額度、好幾筆、用完還能手動 */
  var first = Object.keys(out.對話框)[0], introN = Object.keys(out.對話框).filter(t => out.對話框[t].第一次說明).length;
  ok("第一次按＋才跳 AI 說明,之後這次不再跳", out.對話框[first].第一次說明 && introN === 1, { 跳了幾次: introN });
  ok("說明講:有次數限制、一次可以好幾筆、用完還能手動加、有「不再顯示」", /次數限制/.test(out.第一次說明) && /好幾筆/.test(out.第一次說明) && /手動加/.test(out.第一次說明) && /不再顯示/.test(out.第一次說明), out.第一次說明);
  /* 切到手動:AI 那一塊收起來、一起記帳收起來、按鈕變「下一步:手動填」;切回來還在 */
  var t0 = member && !can ? "wish" : "plan";
  fabOn(t0); q("#add-fab").click(); await wait(80);
  q('[data-add-mode="hand"]').click(); await wait(40);
  out.手動 = { AI那塊: shown(q("#ai-part")), 額度那行: shown(q("#ai-quota")), 一起記帳: shown(q("#add-also-f")), 按鈕: txt("#ai-go"), 說: txt("#add-hand-say") };
  ok("切成手動:AI 那塊收起來、按鈕「下一步:手動填」、講不用 AI 次數", !out.手動.AI那塊 && !out.手動.一起記帳 && /手動填/.test(out.手動.按鈕) && /不用 AI 次數/.test(out.手動.說), out.手動);
  q('[data-add-mode="ai"]').click(); await wait(40);
  ok("切回 AI:打字框回來、按鈕「交給 AI」", shown(q("#ai-text")) && txt("#ai-go") === "交給 AI", txt("#ai-go"));
  q("#ai-cancel").click(); await wait(50);
  /* 最後一列的 ✎ ✕ 捲得出來,不被＋蓋住 */
  out.最後一列 = {};
  var rows = { plan: "#route .rowops button", wish: "#wish-list [data-vote]", fly: "#board-wrap [data-flight-edit]", cost: "#exp-list [data-edit-exp], #exp-list [data-del-exp]" };
  for (const t of Object.keys(rows)) {
    if (!fabOn(t)) continue;
    await wait(150);
    out.最後一列[t] = lastRow(rows[t]);
    var r = out.最後一列[t];
    if (!r.沒有) ok(t + ":最後一列的按鈕捲到底不被＋蓋住、按得到", !r.蓋到 && r.按得到, r);
  }
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
