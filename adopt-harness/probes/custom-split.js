/* 每個人自訂分多少(2026-10-04,Lulu:「可以個別針對每個要分帳的人再設定他的金額,沒有特別設定的話,就是每個人分得一樣多」)。
 * 記一筆 ¥9,000、五個人分、佳瑜設 ¥1,000 → 其他四人平分剩下的 ¥8,000(各 ¥2,000);分帳頁的「該付」照這個算(匯率 0.21)。
 * 超過總額擋下來;改這一筆時「各自設定」和金額都帶回來;切回「平分」存了就回到全部平分。
 *   WIDTH=390 ./probe.sh probes/custom-split.js
 *   WIDTH=1440 ./probe.sh probes/custom-split.js */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = e => ((typeof e === "string" ? q(e) : e) || {}).textContent ? ((typeof e === "string" ? q(e) : e).textContent.replace(/\s+/g, " ").trim()) : "";
var num = s => Number(String(s).replace(/[^\d.-]/g, "")) || 0;
function owed(name) {
  var card = qa("#people .person").find(c => txt(c.querySelector(".nm")) === name);
  var kv = card && qa.call(null, "#people .person").length && Array.prototype.slice.call(card.querySelectorAll(".kv")).find(k => /該付/.test(k.textContent));
  return kv ? num(kv.querySelector(".num").textContent) : NaN;
}
function setv(id, v) { var i = q("#" + id); i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); }
return (async function () {
  await wait(300);
  var out = {}, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  q("#tab-split").click(); await wait(200);
  var before = { 佳瑜: owed("佳瑜"), 阿輝: owed("阿輝"), 媽: owed("媽") };

  q("#tab-cost").click(); await wait(150);
  q("#add-exp-btn").click(); await wait(150);
  setv("xe-title", "燒肉"); setv("xe-amount", "9000");
  q("#xe-cur").value = "JPY"; q("#xe-cur").dispatchEvent(new Event("change", { bubbles: true }));
  q("#xe-payer").value = "hsieh_chinhui";
  ok("預設平分:格子和說明都藏著", q("#xe-split-same").checked && q("#xe-split-each").hidden && q("#xe-split-note").hidden, "");
  q("#xe-split-diff").click(); await wait(80);
  var rows = () => qa("#xe-split-each [data-split-row]").filter(r => !r.hidden);
  out.格子 = rows().map(r => txt(r.querySelector("label")) + " " + r.querySelector("input").placeholder);
  ok("各自設定:勾了的五個人各一格,淡字是平分的 1800", rows().length === 5 && rows().every(r => r.querySelector("input").placeholder === "1800"), out.格子);
  /* 設計系統的輸入框空著時標籤躺在格子裡、淡字看不到 —— 所以「不填會分多少」寫在標籤上 */
  out.標籤 = rows().map(r => txt(r.querySelector("label")));
  ok("空著的格子:標籤寫「阿輝 · 平分 ¥1,800」", out.標籤[0] === "阿輝 · 平分 ¥1,800", out.標籤);
  setv("xe-sp-chang_chiayu", "1000"); await wait(50);
  out.設了佳瑜 = { 阿輝: q("#xe-sp-hsieh_chinhui").placeholder, 說: txt("#xe-split-note") };
  ok("佳瑜填了 → 她的標籤只剩名字;阿輝的標籤變「阿輝 · 平分 ¥2,000」", txt(q('[data-split-row="chang_chiayu"] label')) === "佳瑜" && txt(q('[data-split-row="hsieh_chinhui"] label')) === "阿輝 · 平分 ¥2,000",
    [txt(q('[data-split-row="chang_chiayu"] label')), txt(q('[data-split-row="hsieh_chinhui"] label'))]);
  ok("佳瑜填 1000 → 其他人的淡字變 2000,說「剩下 ¥8,000 給沒填的 4 人平分,每人 ¥2,000」",
    out.設了佳瑜.阿輝 === "2000" && out.設了佳瑜.說 === "剩下 ¥8,000 給沒填的 4 人平分,每人 ¥2,000。", out.設了佳瑜);
  /* 取消勾一個人:他的格子藏起來 */
  var mom = qa("#xe-who input").find(i => i.value === "chen_suchih");
  mom.click(); await wait(50);
  ok("取消勾「媽」→ 她那一格藏起來、剩 3 人平分 ¥8,000", q('[data-split-row="chen_suchih"]').hidden && /給沒填的 3 人平分/.test(txt("#xe-split-note")), txt("#xe-split-note"));
  mom.click(); await wait(50);
  /* 超過總額 */
  setv("xe-sp-chang_chiayu", "10000"); await wait(50);
  ok("填超過 → 說明直接講「比這筆 ¥9,000 還多」", /¥10,000,比這筆 ¥9,000 還多/.test(txt("#xe-split-note")), txt("#xe-split-note"));
  var n0 = (w.__rows.expenses || []).length;
  q("#exp-edit-form").requestSubmit(); await wait(150);
  ok("超過總額按記下來 → 擋下來、講原因、對話框還開著", !q("#exp-edit-overlay").hidden && /還多/.test(txt("#xe-err")) && (w.__rows.expenses || []).length === n0, txt("#xe-err"));
  setv("xe-sp-chang_chiayu", "1000"); await wait(50);
  q("#exp-edit-form").requestSubmit(); await wait(500);
  var saved = (w.__rows.expenses || []).slice(-1)[0] || {};
  out.存的 = { split: saved.split, participants: saved.participants };
  ok("存了:split 只有佳瑜 1000,五個人分", q("#exp-edit-overlay").hidden && JSON.stringify(saved.split) === JSON.stringify({ chang_chiayu: 1000 }) && (saved.participants || []).length === 5, out.存的);
  var row = qa("#exp-list .exp").find(r => /燒肉/.test(r.textContent));
  out.那一列 = txt(row);
  ok("那一列寫出每個人分多少(佳瑜 ¥1,000、阿輝 ¥2,000),不寫「每人」", /佳瑜 ¥1,000/.test(out.那一列) && /阿輝 ¥2,000/.test(out.那一列) && !/每人/.test(out.那一列), out.那一列);
  var segs = Array.prototype.slice.call(row.querySelectorAll(".mt .nw"));
  ok("每個人一段、不會從名字和金額中間換行(white-space:nowrap)", segs.length === 5 && segs.every(x => w.getComputedStyle(x).whiteSpace === "nowrap"), segs.map(x => x.textContent));

  q("#tab-split").click(); await wait(200);
  var after = { 佳瑜: owed("佳瑜"), 阿輝: owed("阿輝"), 媽: owed("媽") };
  out.該付多了 = { 佳瑜: after.佳瑜 - before.佳瑜, 阿輝: after.阿輝 - before.阿輝, 媽: after.媽 - before.媽 };
  ok("分帳頁「該付」:佳瑜多 NT$210(¥1,000)、阿輝和媽各多 NT$420(¥2,000)",
    Math.abs(out.該付多了.佳瑜 - 210) <= 1 && Math.abs(out.該付多了.阿輝 - 420) <= 1 && Math.abs(out.該付多了.媽 - 420) <= 1, out.該付多了);

  /* 改這一筆:帶回來 */
  q("#tab-cost").click(); await wait(150);
  row = qa("#exp-list .exp").find(r => /燒肉/.test(r.textContent));
  row.querySelector("[data-edit-exp]").click(); await wait(150);
  out.改 = { 各自設定: q("#xe-split-diff").checked, 佳瑜: q("#xe-sp-chang_chiayu").value, 格子露著: !q("#xe-split-each").hidden };
  ok("改這一筆:「各自設定」勾著、佳瑜那格是 1000", out.改.各自設定 && out.改.佳瑜 === "1000" && out.改.格子露著, out.改);
  q("#xe-split-same").click(); await wait(50);
  q("#exp-edit-form").requestSubmit(); await wait(500);
  saved = (w.__rows.expenses || []).find(e => e.title === "燒肉") || {};
  row = qa("#exp-list .exp").find(r => /燒肉/.test(r.textContent));
  out.切回平分 = { split: saved.split, 那一列: txt(row) };
  ok("切回平分存了 → split 清空、那一列回到「全員均分 · 每人」", JSON.stringify(saved.split) === "{}" && /全員均分/.test(out.切回平分.那一列) && /每人/.test(out.切回平分.那一列), out.切回平分);

  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
