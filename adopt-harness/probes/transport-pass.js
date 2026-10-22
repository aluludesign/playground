/* 通票(2026-10-12,Lulu 拿青春18きっぷ問「這種車票沒辦法加到交通嗎」):幾天內隨便搭、沒有班次和起訖站的票。
 * 她選的:交通多一種「通票」、只出現在交通頁(行程上不加節點)、勾誰有這張(可以不勾)。
 * 量:表單跟著換(只有日期、沒有方向和起訖站)、存下去的東西、交通頁那張卡、行程上沒有它、
 *     改的時候日期還在、換回火車日期留著;AI 讀到通票＋價錢 → 一批兩張,誰分攤先勾有票的人,換筆回來日期還在。
 *   WIDTH=390 ./probe.sh probes/transport-pass.js
 *   WIDTH=1440 ./probe.sh probes/transport-pass.js */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var set = (id, v) => { var e = q("#" + id); e.value = v; e.dispatchEvent(new w.Event("input", { bubbles: true })); };
var pick = k => { var i = q('#fl-kinds input[value="' + k + '"]'); i.checked = true; i.dispatchEvent(new w.Event("change", { bubbles: true })); };
var calls = (re, m) => (w.__calls || []).filter(c => re.test(c.url) && (!m || c.method === m));
var next = null, real = w.fetch;
w.fetch = function (u, init) {
  if (/\/api\/ai/.test(String(u)) && init && init.method === "POST") return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: next }) });
  return real(u, init);
};
var base = { title: "", day: "", time: "", note: "", amount: 0, currency: "", date: "", category: "", legs: [], items: [], parts: [], message: "" };
return (async function () {
  await wait(300);
  var out = {}, bad = [];
  var ok = (name, cond, got) => { if (!cond) bad.push(name + " ← " + JSON.stringify(got)); };

  /* 1. 手動加一張通票 */
  q("#tab-fly").click(); await wait(120);
  addBy("transport"); await wait(80);
  ok("種類裡有「通票」", !!q('#fl-kinds input[value="通票"]'), qa("#fl-kinds input").map(i => i.value));
  set("fl-depart", "2026-10-03T09:00");
  pick("通票"); await wait(40);
  out.表單 = { 票名: txt("#fl-no-l"), 公司: txt("#fl-airline-l"), 第一天: txt("#fl-depart-l"), 最後一天: txt("#fl-arrive-l"), 型別: q("#fl-depart").type + "/" + q("#fl-arrive").type,
    日期留著: q("#fl-depart").value, 方向欄: !q("#fl-f-dir").hidden, 起站: !q("#fl-from").closest(".fld").hidden, 訖站: !q("#fl-to").closest(".fld").hidden,
    座位欄: !q("#fl-f-seats").hidden, 誰有: !q("#fl-f-drivers").hidden ? txt("#fl-drivers-l") : "", 第一天寬: q("#fl-depart").getBoundingClientRect().width, 表單寬: q("#fl-airline").getBoundingClientRect().width };
  ok("選通票:票名、哪一家、第一天、最後一天(只有日期);沒有方向、起訖站、座位;有「誰有這張(可以不勾)」;原本填的日期留著",
    out.表單.票名 === "票名" && out.表單.公司 === "哪一家" && out.表單.第一天 === "第一天" && out.表單.最後一天 === "最後一天" && out.表單.型別 === "date/date" &&
    out.表單.日期留著 === "2026-10-03" && !out.表單.方向欄 && !out.表單.起站 && !out.表單.訖站 && !out.表單.座位欄 && out.表單.誰有 === "誰有這張(可以不勾)", out.表單);
  ok("第一天那格佔一整行(起訖站藏起來之後不留半邊空的)", Math.abs(out.表單.第一天寬 - out.表單.表單寬) < 2, [out.表單.第一天寬, out.表單.表單寬]);
  set("fl-no", "青春18きっぷ"); set("fl-airline", "JR"); set("fl-depart", "2026-10-04"); set("fl-arrive", "2026-10-06");
  set("fl-note", "JR 全線普通・快速");
  var fl0 = calls(/resource=flights/, "POST").length;
  q("#flight-form").requestSubmit(); await wait(500);
  var p = calls(/resource=flights/, "POST").slice(fl0)[0];
  out.存了 = p && { kind: p.body.kind, no: p.body.no, depart: p.body.depart, arrive: p.body.arrive, from: p.body.from, to: p.body.to, dir: p.body.dir, drivers: p.body.drivers };
  ok("沒勾誰有也能存:種類通票、只有日期、沒有起訖站、方向其他", out.存了 && out.存了.kind === "通票" && out.存了.depart === "2026-10-04" && out.存了.arrive === "2026-10-06" &&
    out.存了.from === "" && out.存了.to === "" && out.存了.dir === "其他" && out.存了.drivers.length === 0 && q("#flight-overlay").hidden, out.存了);
  var card = q('.tleg[data-kind="通票"]');
  out.卡 = card && card.textContent.replace(/\s+/g, " ").trim();
  out.卡在哪天 = card && card.closest(".tl-group").querySelector(".tl-day").textContent;
  ok("交通頁:通票卡寫票名、哪一家、第一天 → 最後一天、共 3 天、可以搭什麼;排在第一天那組", /通票/.test(out.卡) && /青春18きっぷ · JR/.test(out.卡) &&
    /第一天\s*10\/04\s*SUN/.test(out.卡) && /最後一天\s*10\/06\s*TUE/.test(out.卡) && /共 3 天/.test(out.卡) && /JR 全線普通・快速/.test(out.卡) && /10\/04/.test(out.卡在哪天), [out.卡, out.卡在哪天]);
  /* 行程上不加節點(她選的:只在交通頁) */
  q("#tab-plan").click(); await wait(80);
  q('#days [data-day="2026-10-04"]').click(); await wait(150);
  ok("行程頁(10/04):沒有通票", !/青春18|通票/.test(txt("#route")), txt("#route"));

  /* 2. 改:日期還在、勾一個人 */
  q("#tab-fly").click(); await wait(80);
  q('.tleg[data-kind="通票"] [data-flight-edit]').click(); await wait(80);
  out.改 = { 種類: (q("#fl-kinds input:checked") || {}).value, 型別: q("#fl-depart").type, 第一天: q("#fl-depart").value, 最後一天: q("#fl-arrive").value };
  ok("打開來改:還是通票,日期格是日期、值都在", out.改.種類 === "通票" && out.改.型別 === "date" && out.改.第一天 === "2026-10-04" && out.改.最後一天 === "2026-10-06", out.改);
  q('#fl-drivers input[value="chang_chiayu"]').click();
  var pa0 = calls(/resource=flights/, "PATCH").length;
  q("#flight-form").requestSubmit(); await wait(500);
  var pa = calls(/resource=flights/, "PATCH").slice(pa0)[0];
  ok("勾了佳瑜 → 存 drivers [佳瑜]", pa && JSON.stringify(pa.body.drivers) === '["chang_chiayu"]', pa && pa.body);
  out.卡2 = txt('.tleg[data-kind="通票"] .tl-who');
  ok("卡上寫「有票 佳瑜」", /有票/.test(out.卡2) && /佳瑜/.test(out.卡2), out.卡2);

  /* 3. 換回火車:日期留著、補上時間,起訖站回來 */
  addBy("transport"); await wait(80);
  pick("通票"); set("fl-depart", "2026-10-05"); pick("火車"); await wait(40);
  out.換回 = { 型別: q("#fl-depart").type, 值: q("#fl-depart").value, 起站: !q("#fl-from").closest(".fld").hidden, 方向: !q("#fl-f-dir").hidden, 第一天字: txt("#fl-depart-l") };
  ok("通票 → 火車:日期留著(補 10:00)、起訖站和方向回來、標題回到「發車(當地時間)」", out.換回.型別 === "datetime-local" && out.換回.值 === "2026-10-05T10:00" &&
    out.換回.起站 && out.換回.方向 && out.換回.第一天字 === "發車(當地時間)", out.換回);
  q("#fl-cancel").click(); await wait(60);

  /* 4. AI:青春18きっぷ＋價錢 → 一批兩張(通票、花費);誰分攤先勾有票的人;換筆回來日期還在 */
  var leg = { kind: "通票", no: "青春18きっぷ", company: "JR", depart: "2026-03-20", arrive: "2026-03-22", from: "", to: "", code: "", dir: "", match: "", note: "JR 全線普通・快速", seats: [], others: 0, photos: [] };
  next = Object.assign({}, base, { intent: "transport", legs: [leg], parts: [{ intent: "transport", legs: [leg], items: [] },
    { intent: "expense", legs: [], items: [Object.assign({}, base, { title: "青春18きっぷ", amount: 10000, currency: "JPY", date: "2026-03-18", category: "交通" })] }] });
  addAI(); await wait(100); q("#ai-text").value = "這張"; q("#ai-form").requestSubmit();
  for (var i = 0; i < 40 && q("#flight-overlay").hidden; i++) await wait(100);
  out.AI第一張 = { 種類: (q("#fl-kinds input:checked") || {}).value, 型別: q("#fl-depart").type, 第一天: q("#fl-depart").value, 最後一天: q("#fl-arrive").value, 票名: q("#fl-no").value,
    編號: qa("#flight-form .batch-tabs:not([hidden]) .rm-chip").map(c => c.textContent.trim()) };
  ok("AI:第一張是通票,日期填好(只有日期),編號「1 交通」「2 花費」", out.AI第一張.種類 === "通票" && out.AI第一張.型別 === "date" && out.AI第一張.第一天 === "2026-03-20" &&
    out.AI第一張.最後一天 === "2026-03-22" && out.AI第一張.票名 === "青春18きっぷ" && out.AI第一張.編號.join() === "1 交通,2 花費", out.AI第一張);
  q('#fl-drivers input[value="chang_yalun"]').click();
  qa("#flight-form .batch-tabs input")[1].click(); await wait(700);
  out.AI第二張 = { 記一筆: !q("#exp-edit-overlay").hidden, 金額: q("#xe-amount").value, 誰分攤: qa("#xe-who input:checked").map(i => i.value) };
  ok("換到花費:金額 10000,誰分攤先勾有票的雅倫", out.AI第二張.記一筆 && out.AI第二張.金額 === "10000" && JSON.stringify(out.AI第二張.誰分攤) === '["chang_yalun"]', out.AI第二張);
  qa("#exp-edit-form .batch-tabs input")[0].click(); await wait(700);
  out.AI回來 = { 種類: (q("#fl-kinds input:checked") || {}).value, 型別: q("#fl-depart").type, 第一天: q("#fl-depart").value, 最後一天: q("#fl-arrive").value,
    勾著: !!(q('#fl-drivers input[value="chang_yalun"]') || {}).checked };
  ok("換回通票那張:日期還在、雅倫還勾著(草稿倒回來時日期格先換好型別)", out.AI回來.種類 === "通票" && out.AI回來.型別 === "date" && out.AI回來.第一天 === "2026-03-20" &&
    out.AI回來.最後一天 === "2026-03-22" && out.AI回來.勾著, out.AI回來);
  q("#xe-payer") && (q("#xe-payer").value = "chang_yalun");
  var f1 = calls(/resource=flights/, "POST").length, e1 = calls(/resource=expenses/, "POST").length;
  q("#flight-overlay [data-batch-save]").click();
  for (var j = 0; j < 60 && calls(/resource=expenses/, "POST").length === e1; j++) await wait(100);
  await wait(300);
  var fp = calls(/resource=flights/, "POST").slice(f1)[0], ep = calls(/resource=expenses/, "POST").slice(e1)[0];
  out.AI存了 = { 交通: fp && { kind: fp.body.kind, depart: fp.body.depart, arrive: fp.body.arrive, drivers: fp.body.drivers }, 花費: ep && { title: ep.body.title, amount: ep.body.amount, participants: ep.body.participants } };
  ok("全部存起來:通票(只有日期、有票雅倫)＋花費 10000(分攤雅倫)", fp && fp.body.kind === "通票" && fp.body.depart === "2026-03-20" && fp.body.arrive === "2026-03-22" &&
    JSON.stringify(fp.body.drivers) === '["chang_yalun"]' && ep && ep.body.amount === 10000 && JSON.stringify(ep.body.participants) === '["chang_yalun"]', out.AI存了);

  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
