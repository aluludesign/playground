/* 複合的內容(2026-10-04,Lulu:「複合式的車票加座位…第一張對話框是填座位,第二張就是帶入填費用的」)。
 * 一張高鐵票 → AI 回 交通 + 花費 兩份:先開「加一段交通」(座位填好,1 / 2),存了往左滑走,再開「記一筆」(票價填好,2 / 2);
 * 記錢那張「誰分攤」只勾交通那張填了座位的人、「誰付的」空著;照片只傳一次、兩邊都掛。
 * 取消 = 後面不要了;跳過 = 直接下一份;沒有某一份的權限 → 跳過那份、講一聲;行程 + 花費也一樣。
 *   WIDTH=390 ./probe.sh probes/ai-composite.js
 *   PAGE='/index.html?fake=member&can=cost' WIDTH=390 ./probe.sh probes/ai-composite.js   只有記帳權限的副團主 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var src = (w.frameElement && w.frameElement.getAttribute("src")) || "";
var costOnly = /can=cost/.test(src);
var next = null, real = w.fetch;
w.fetch = function (u, init) {
  if (/\/api\/ai/.test(String(u))) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: next }) });
  return real(u, init);
};
var base = { title: "", day: "", time: "", note: "", amount: 0, currency: "", date: "", category: "", legs: [], items: [], parts: [], message: "" };
var LEG = { kind: "火車", no: "125", company: "台灣高鐵", from: "南港", to: "左營", depart: "2026-10-06T11:20", arrive: "2026-10-06T13:05", code: "", dir: "其他", match: "", note: "", seats: [{ member: "chang_chiayu", seat: "5車 2C" }] };
var EXP = { title: "高鐵 南港→左營", day: "", time: "", note: "", amount: 1530, currency: "TWD", date: "2026-10-06", category: "交通" };
var TICKET = Object.assign({}, base, { intent: "transport", legs: [LEG], message: "高鐵票", parts: [{ intent: "transport", legs: [LEG], items: [] }, { intent: "expense", legs: [], items: [EXP] }] });
var calls = (re, m) => (w.__calls || []).filter(c => re.test(c.url) && (!m || c.method === m));
async function givePhoto() {
  var c = d.createElement("canvas"); c.width = 80; c.height = 50;
  var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 80, 50);
  var blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.9));
  var dt = new w.DataTransfer(); dt.items.add(new w.File([blob], "ticket.jpg", { type: "image/jpeg" }));
  var inp = q("#ai-file"); inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true }));
  for (var i = 0; i < 40 && !/已加入/.test(txt("#ai-img-name")); i++) await wait(50);
}
async function ask(result, photo) {
  next = result;
  q("#ai-btn").click(); await wait(100);
  if (photo) await givePhoto();
  q("#ai-text").value = "這張票"; q("#ai-form").requestSubmit(); await wait(450);
}
var nOf = id => { var f = q("#" + id), n = f && f.querySelector(".stack-n"); return n && !n.hidden ? n.textContent : ""; };
var ghosts = id => { var st = q("#" + id).parentElement; return [!!st.querySelector(".g1:not([hidden])"), !!st.querySelector(".g2:not([hidden])")]; };
var who = () => qa("#xe-who input:checked").map(i => i.value);
return (async function () {
  await wait(300);
  var out = {}, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };

  if (costOnly) {
    /* 只有記帳權限:交通那份跳過,直接記一筆,講一聲 */
    await ask(TICKET, false);
    out.只能記帳 = { 交通開了: !q("#flight-overlay").hidden, 記一筆開了: !q("#exp-edit-overlay").hidden, 計數: nOf("exp-edit-form"), 說: txt("#xe-ai"), 金額: q("#xe-amount").value };
    ok("沒有交通權限:跳過交通、直接記一筆(不疊、不寫幾分之幾),講「交通那部分要團主…」",
      !out.只能記帳.交通開了 && out.只能記帳.記一筆開了 && !out.只能記帳.計數 && out.只能記帳.金額 === "1530" && /交通那部分要團主/.test(out.只能記帳.說), out.只能記帳);
    q("#xe-cancel").click();
  } else {
    /* 1. 交通 → 花費 */
    var up0 = w.__photoUploads || 0, fl0 = calls(/resource=flights/, "POST").length, ex0 = calls(/resource=expenses/, "POST").length;
    await ask(TICKET, true);
    out.第一張 = { 交通開了: !q("#flight-overlay").hidden, 計數: nOf("flight-form"), 後面: ghosts("flight-form"), 座位: (q("#fl-seat-chang_chiayu") || {}).value, 班次: q("#fl-no").value, 說: txt("#fl-ai"), 跳過鈕: !q("#fl-skip").hidden };
    ok("第一張是「加一段交通」:1 / 2、後面疊一張、座位 5車 2C 填好、講「下一張是花費」",
      out.第一張.交通開了 && out.第一張.計數 === "1 / 2" && out.第一張.後面[0] && !out.第一張.後面[1] && out.第一張.座位 === "5車 2C" &&
      out.第一張.班次 === "125" && /交通和花費/.test(out.第一張.說) && /下一張是花費/.test(out.第一張.說), out.第一張);
    q("#flight-form").requestSubmit(); await wait(120);
    ok("存了交通 → 這張往左滑走", q("#flight-form").classList.contains("slide-out"), "");
    await wait(700);
    out.第二張 = { 交通關了: q("#flight-overlay").hidden, 記一筆開了: !q("#exp-edit-overlay").hidden, 計數: nOf("exp-edit-form"), 後面: ghosts("exp-edit-form"),
      項目: q("#xe-title").value, 金額: q("#xe-amount").value, 幣別: q("#xe-cur").value, 日期: q("#xe-date").value, 分類: q("#xe-cat").value, 誰付: q("#xe-payer").value, 誰分攤: who(), 說: txt("#xe-ai") };
    ok("第二張是「記一筆」:2 / 2、後面沒了;票價、幣別、日期、分類都填好", out.第二張.交通關了 && out.第二張.記一筆開了 && out.第二張.計數 === "2 / 2" && !out.第二張.後面[0] &&
      out.第二張.項目 === "高鐵 南港→左營" && out.第二張.金額 === "1530" && out.第二張.幣別 === "TWD" && out.第二張.日期 === "2026-10-06" && out.第二張.分類 === "transport", out.第二張);
    ok("誰分攤只勾坐 2C 的佳瑜、誰付的空著,說明講「先勾了交通那張有座位的人」", JSON.stringify(out.第二張.誰分攤) === '["chang_chiayu"]' && out.第二張.誰付 === "" && /有座位的人/.test(out.第二張.說), out.第二張);
    q("#xe-payer").value = "chang_chiayu";
    q("#exp-edit-form").requestSubmit(); await wait(700);
    var fp = calls(/resource=flights/, "POST").slice(fl0), ep = calls(/resource=expenses/, "POST").slice(ex0);
    out.存了 = { 交通: fp.length, 花費: ep.length, 上傳: (w.__photoUploads || 0) - up0, 交通照片: fp[0] && fp[0].body.photo, 花費照片: ep[0] && ep[0].body.photo, 關了: q("#exp-edit-overlay").hidden };
    ok("交通、花費各存一筆;照片只傳一次、兩邊帶同一個編號;最後一張存了就關", out.存了.交通 === 1 && out.存了.花費 === 1 && out.存了.上傳 === 1 &&
      out.存了.交通照片 && out.存了.交通照片 === out.存了.花費照片 && out.存了.關了, out.存了);

    /* 2. 取消 = 後面不要了 */
    var ex1 = calls(/resource=expenses/, "POST").length;
    await ask(TICKET, false);
    q("#fl-cancel").click(); await wait(500);
    ok("第一張按取消 → 全部關掉,記一筆不會跳出來", q("#flight-overlay").hidden && q("#exp-edit-overlay").hidden && calls(/resource=expenses/, "POST").length === ex1, "");

    /* 3. 跳過 = 直接下一份(沒存交通 → 沒有座位 → 全員) */
    await ask(TICKET, false);
    q("#fl-skip").click(); await wait(300);
    out.跳過 = { 記一筆開了: !q("#exp-edit-overlay").hidden, 計數: nOf("exp-edit-form"), 誰分攤: who().length };
    ok("第一張按跳過 → 直接到記一筆 2 / 2;交通沒存所以誰分攤是全員", q("#flight-overlay").hidden && out.跳過.記一筆開了 && out.跳過.計數 === "2 / 2" && out.跳過.誰分攤 === 5, out.跳過);
    q("#xe-cancel").click(); await wait(100);

    /* 4. 行程 + 花費(門票訂位) */
    var STOP = { title: "teamLab Planets", day: "2026-10-05", time: "10:00", note: "", amount: 0, currency: "", date: "", category: "" };
    var EXP2 = { title: "teamLab 門票", day: "", time: "", note: "", amount: 3800, currency: "JPY", date: "2026-10-05", category: "景點" };
    await ask(Object.assign({}, base, { intent: "stop", items: [STOP], parts: [{ intent: "stop", legs: [], items: [STOP] }, { intent: "expense", legs: [], items: [EXP2] }] }), false);
    out.門票 = { 確認卡: !q("#ai-overlay").hidden && !q("#ai-confirm").hidden, 種類: q("#ai-kind").value, 計數: nOf("ai-confirm"), 名稱: q("#ai-title").value, 時間: q("#ai-time").value };
    ok("行程 + 花費:第一張是行程確認卡 1 / 2", out.門票.確認卡 && out.門票.種類 === "stop" && out.門票.計數 === "1 / 2" && out.門票.名稱 === "teamLab Planets" && out.門票.時間 === "10:00", out.門票);
    q("#ai-confirm").requestSubmit(); await wait(800);
    out.門票2 = { 記一筆開了: !q("#exp-edit-overlay").hidden, 計數: nOf("exp-edit-form"), 金額: q("#xe-amount").value, 誰分攤: who().length };
    ok("存了行程 → 記一筆 2 / 2、¥3800、全員(沒有座位)", out.門票2.記一筆開了 && out.門票2.計數 === "2 / 2" && out.門票2.金額 === "3800" && out.門票2.誰分攤 === 5, out.門票2);
    q("#xe-cancel").click(); await wait(100);

    /* 5. 只有一種資料:照舊,不疊 */
    await ask(Object.assign({}, base, { intent: "expense", items: [EXP], parts: [] }), false);
    ok("只有一種(parts 空的):照舊記一筆、不寫幾分之幾", !q("#exp-edit-overlay").hidden && !nOf("exp-edit-form") && !/下一張/.test(txt("#xe-ai")), txt("#xe-ai"));
    q("#xe-cancel").click(); await wait(100);
  }
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
