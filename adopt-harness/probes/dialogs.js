/* 對話框怎麼關(2026-09-29,Lulu:全部一致)。每一張都問同樣的四件事:
 *   沒改過 → 點外面關得掉;沒改過 → Esc 關得掉
 *   改過   → 點外面、Esc 都關不掉,而且講一句要按哪裡;按取消才關
 * 「改成幾點」那一張要拖一個願望到時間軸上才打得開,只有三欄的寬度(WIDTH=1440)做得到。
 *   WIDTH=390 ./probe.sh probes/dialogs.js ;  WIDTH=1440 ./probe.sh probes/dialogs.js
 * 取代 cancel-only.js(那一支守的是 09-28「只有取消關得掉」的舊規則)。 */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var shown = id => !q("#" + id).hidden;
var backdrop = id => q("#" + id).dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
var esc = () => d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
var type = (id, v) => { var e = q("#" + id); e.value = v; e.dispatchEvent(new w.Event("input", { bubbles: true })); };
var hintOn = id => { var h = q("#" + id + " .ov-hint"); return !!h && !h.hidden && /取消/.test(h.textContent); };
var menu = which => { q("#menu-btn").click(); q("#" + which).click(); if (!q("#menu-pop").hidden) q("#menu-btn").click(); };
var DIALOGS = [
  { name: "團的設定", ov: "settings-overlay", open: () => menu("cloud-set"), field: "st-name", cancel: "st-cancel" },
  { name: "邀請朋友", ov: "invite-overlay", open: () => menu("cloud-invite"), field: null, cancel: "inv-close" },
  { name: "加一段交通", ov: "flight-overlay", open: () => { q("#tab-fly").click(); q("[data-flight-add]").click(); }, field: "fl-no", cancel: "fl-cancel" },
  { name: "改一筆花費", ov: "exp-edit-overlay", open: () => { q("#tab-cost").click(); q("[data-edit-exp]").click(); }, field: "xe-title", cancel: "xe-cancel" },
  { name: "改一項行程", ov: "edit-overlay", open: () => { q("#tab-plan").click(); q("[data-edit-stop]").click(); }, field: "se-title", cancel: "se-cancel" },
  { name: "加一筆行程", ov: "stop-add-overlay", open: () => { q("#tab-plan").click(); q("#add-stop-btn").click(); }, field: "sf-title", cancel: "sf-cancel" },
  { name: "AI 幫你加", ov: "ai-overlay", open: () => q("#ai-btn").click(), field: "ai-text", cancel: "ai-cancel" },
  { name: "許一個願望", ov: "wish-add-overlay", open: () => { q("#tab-wish").click(); q("#add-wish-btn").click(); }, field: "wf-title", cancel: "wf-cancel" },
  { name: "改願望", ov: "wish-edit-overlay", open: () => { q("#tab-wish").click(); q("#wishbox").open = true; q("[data-edit-wish=w2]").click(); }, field: "we-title", cancel: "we-cancel" },
];
async function openTime() {
  var wl = q("#wish-list"), card = wl && wl.querySelector(".wish[data-wish]");
  if (!card || !wl.classList.contains("can-sort")) return false;
  var cb = card.getBoundingClientRect(), rt = q("#route").getBoundingClientRect();
  var pev = (t, x, y) => new w.PointerEvent(t, { clientX: x, clientY: y, pointerId: 7, bubbles: true, cancelable: true, pointerType: "mouse" });
  card.dispatchEvent(pev("pointerdown", cb.left + 30, cb.top + 12)); await wait(550);
  card.dispatchEvent(pev("pointermove", rt.left + 60, rt.top + 30)); await wait(80);
  card.dispatchEvent(pev("pointerup", rt.left + 60, rt.top + 30)); await wait(250);
  return shown("time-overlay");
}
return (async function () {
  var out = { 寬: w.innerWidth }, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var list = DIALOGS.slice();
  if (w.innerWidth >= 1280) { q("#tab-plan").click(); await wait(100); list.push({ name: "改成幾點", ov: "time-overlay", open: openTime, field: "tf-time", cancel: "tf-cancel", async: true }); }
  for (var D of list) {
    var r = {};
    await D.open(); await wait(150);
    r.開 = shown(D.ov);
    if (!r.開) { bad.push(D.name + " 打不開"); out[D.name] = r; continue; }
    backdrop(D.ov); await wait(60); r.沒改_點外面後還開著 = shown(D.ov);
    if (r.沒改_點外面後還開著) q("#" + D.cancel).click();
    await D.open(); await wait(150);
    var sheet = q("#map-sheet") ? !q("#map-sheet").hidden : null;
    esc(); await wait(60); r.沒改_Esc後還開著 = shown(D.ov);
    r.地圖沒被關 = q("#map-sheet") ? (!q("#map-sheet").hidden) === sheet || !r.沒改_Esc後還開著 : true;
    if (r.沒改_Esc後還開著) q("#" + D.cancel).click();
    ok(D.name + ":沒改過,點外面和 Esc 都關得掉", !r.沒改_點外面後還開著 && !r.沒改_Esc後還開著, r);
    if (D.field) {
      await D.open(); await wait(150);
      if (D.ov === "time-overlay") { var t = q("#tf-time"); t.value = t.value === "07:07" ? "08:08" : "07:07"; t.dispatchEvent(new w.Event("input", { bubbles: true })); }
      else type(D.field, "探針改過的字");
      backdrop(D.ov); await wait(60); r.改過_點外面後還開著 = shown(D.ov); r.有提示 = hintOn(D.ov);
      esc(); await wait(60); r.改過_Esc後還開著 = shown(D.ov);
      q("#" + D.cancel).click(); await wait(80); r.按取消後關了 = !shown(D.ov);
      ok(D.name + ":改過,點外面和 Esc 都關不掉、有講要按哪裡;取消才關", r.改過_點外面後還開著 && r.有提示 && r.改過_Esc後還開著 && r.按取消後關了, r);
    }
    out[D.name] = r;
  }
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過(" + list.length + " 張)";
  out.errors = w.__errors || [];
  return out;
})();
