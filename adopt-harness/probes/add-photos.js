/* 全站一顆「＋」(2026-10-22,Lulu)之二:手動放圖、AI 只照選的類型讀、AI 出錯自動切手動。
 *   WIDTH=390 PAGE='/index.html?touch=1' ./probe.sh probes/add-photos.js     (也跑 1440)
 * 看:
 *   - 第一次 AI 說明勾「不再顯示」→ 記在這台
 *   - 送給 AI 的帶 kind(選的那一類)、勾了一起記帳帶 also=expense;回來交通＋花費 → 一批兩張卡
 *   - AI 出錯 → 自動切成手動、講一聲;按下一步打開那一類的表單,AI 框裡放的照片一起帶過去
 *   - 四種手動表單都能放圖:存的時候先上傳,行程/許願帶 pics(「附圖」欄)、交通/花費帶 photos(「照片」欄);清單上那一列出現小縮圖
 *   - 改既有的那一筆不出現放圖 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var shown = e => !!e && !e.closest("[hidden]") && e.getClientRects().length > 0;
var calls = (re, m) => (w.__calls || []).filter(c => re.test(c.url) && (!m || c.method === m));
var body = c => (typeof c.body === "string" ? JSON.parse(c.body) : c.body) || {};
async function file(color) {
  var c = d.createElement("canvas"); c.width = 300; c.height = 200;
  var g = c.getContext("2d"); g.fillStyle = color; g.fillRect(0, 0, 300, 200);
  var blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.9));
  return new w.File([blob], "a.jpg", { type: "image/jpeg" });
}
async function put(input, colors) {
  var dt = new w.DataTransfer();
  for (const c of colors) dt.items.add(await file(c));
  input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));
  await wait(80);
}
async function until(fn, n) { for (var i = 0; i < (n || 80); i++) { if (fn()) return true; await wait(50); } return false; }
return (async function () {
  await wait(300);
  try { w.localStorage.removeItem("trippps-ai-intro-off"); } catch (_) {}
  var out = { 寬: w.innerWidth }, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  /* AI 那支換成假的:記下送了什麼,回什麼由 next 決定 */
  var real = w.fetch, sent = [], next = null;
  w.fetch = function (u, i) {
    if (/\/api\/ai/.test(String(u)) && i && i.method === "POST") {
      sent.push(JSON.parse(i.body));
      var r = next || { status: 200, body: { result: { intent: "wish", title: "淺草寺", items: [], legs: [], parts: [], message: "" } } };
      return Promise.resolve({ ok: r.status < 400, status: r.status, json: () => Promise.resolve(r.body) });
    }
    return real(u, i);
  };

  /* 1. 第一次的 AI 說明:勾不再顯示 → 記在這台 */
  q("#tab-plan").click(); await wait(60);
  q("#add-fab").click(); await wait(100);
  out.說明 = shown(q("#ai-intro-overlay"));
  q("#ai-intro-never").checked = true; q("#ai-intro-ok").click(); await wait(50);
  out.記住了 = (function () { try { return w.localStorage.getItem("trippps-ai-intro-off"); } catch (_) { return "讀不到"; } })();
  ok("第一次跳說明;勾「不再顯示」按知道了 → 記在這台、說明關掉、游標回打字框", out.說明 && out.記住了 === "1" && !shown(q("#ai-intro-overlay")) && d.activeElement === q("#ai-text"), out);

  /* 2. 選交通＋一起記帳 → 送 kind、also;回交通＋花費 → 一批兩張 */
  var tr = q('[data-add-kind="transport"] input'); tr.checked = true; tr.dispatchEvent(new Event("change", { bubbles: true })); await wait(30);
  out.一起記帳出現 = shown(q("#add-also-f"));
  q("#add-also").checked = true;
  q("#ai-text").value = "高鐵票";
  next = { status: 200, body: { result: { intent: "transport", legs: [{ kind: "火車", no: "125", company: "台灣高鐵", depart: "2026-10-05T11:20", from: "南港", to: "左營", arrive: "", seats: [], photos: [] }], items: [], message: "",
    parts: [{ intent: "transport", legs: [{ kind: "火車", no: "125", company: "台灣高鐵", depart: "2026-10-05T11:20", from: "南港", to: "左營", arrive: "", seats: [], photos: [] }], items: [] },
            { intent: "expense", legs: [], items: [{ title: "高鐵 南港→左營", amount: 1530, currency: "TWD", date: "2026-10-05", category: "交通", note: "", photos: [] }] }] } } };
  q("#ai-form").requestSubmit();
  await until(() => shown(q("#flight-overlay")));
  out.送出 = { kind: (sent[0] || {}).kind, also: (sent[0] || {}).also };
  out.一批 = qa("#flight-form .batch-tabs label").map(l => l.textContent.trim());
  ok("選交通、勾一起記帳 → 送 kind=transport、also=expense", out.一起記帳出現 && out.送出.kind === "transport" && out.送出.also === "expense", out.送出);
  ok("回來交通＋花費 → 一批兩張(交通、花費)", out.一批.length === 2 && /交通/.test(out.一批[0]) && /花費/.test(out.一批[1]), out.一批);
  q("#fl-cancel").click(); await wait(80);

  /* 3. 許願不能附帶記帳:選許願就沒有那個勾,送的 also 是空的 */
  q("#add-fab").click(); await wait(80);
  var wi = q('[data-add-kind="wish"] input'); wi.checked = true; wi.dispatchEvent(new Event("change", { bubbles: true })); await wait(30);
  out.許願的一起記帳 = shown(q("#add-also-f"));
  q("#ai-text").value = "淺草寺"; next = null;
  q("#ai-form").requestSubmit(); await wait(400);
  out.許願送出 = { kind: (sent[1] || {}).kind, also: (sent[1] || {}).also };
  ok("選許願:沒有「一起記帳」、送 kind=wish、also 空的", !out.許願的一起記帳 && out.許願送出.kind === "wish" && !out.許願送出.also, out.許願送出);
  qa("#ai-cancel2, #wf-cancel").forEach(b => { if (shown(b)) b.click(); }); await wait(80);
  if (shown(q("#ai-overlay"))) q("#ai-cancel").click();

  /* 4. AI 出錯 → 自動切成手動、講一聲;下一步打開記帳表,照片帶過去 */
  q("#tab-cost").click(); await wait(60);
  q("#add-fab").click(); await wait(80);
  await put(q("#ai-file"), ["#c9a07a"]);
  q("#ai-text").value = "收據";
  next = { status: 502, body: { error: "AI 那邊太忙,過一下再試" } };
  q("#ai-form").requestSubmit();
  await until(() => q('[data-add-mode="hand"]').getAttribute("aria-pressed") === "true");
  out.出錯 = { 模式: q('[data-add-mode][aria-pressed="true"]').dataset.addMode, 說: txt("#add-why"), 按鈕: txt("#ai-go") };
  ok("AI 出錯 → 自動切成手動、講原因和「先改成手動加」、按鈕變下一步", out.出錯.模式 === "hand" && /太忙/.test(out.出錯.說) && /手動加/.test(out.出錯.說) && /照片/.test(out.出錯.說) && /手動填/.test(out.出錯.按鈕), out.出錯);
  q("#ai-form").requestSubmit(); await wait(150);
  out.帶過去 = { 記帳表: shown(q("#exp-edit-overlay")), 縮圖: qa("#exp-edit-form .man-pics .ai-im").length, AI框: shown(q("#ai-overlay")) };
  ok("下一步 → 打開「記一筆」,AI 框裡那張照片帶過去", out.帶過去.記帳表 && out.帶過去.縮圖 === 1 && !out.帶過去.AI框, out.帶過去);
  w.fetch = real;

  /* 5. 手動記一筆帶照片:先上傳、存的時候帶 photos */
  q("#xe-title").value = "便利商店"; q("#xe-amount").value = "580";
  var nPhoto = calls(/resource=photo/, "POST").length;
  q("#exp-edit-form").requestSubmit();
  await until(() => calls(/resource=expenses/, "POST").length > 0);
  await wait(200);
  var ex = calls(/resource=expenses/, "POST").pop();
  out.記帳 = { 上傳: calls(/resource=photo/, "POST").length - nPhoto, photos: ex && body(ex).photos, 縮圖: qa("#exp-list .exp").filter(e => /便利商店/.test(e.textContent)).map(e => !!e.querySelector(".ph-thumb")) };
  ok("手動記一筆:先傳 1 張,存的時候帶 photos(上傳編號),清單那一筆有小縮圖", out.記帳.上傳 === 1 && Array.isArray(out.記帳.photos) && out.記帳.photos.length === 1 && out.記帳.縮圖[0] === true, out.記帳);

  /* 6. 改既有的那一筆不放圖 */
  q("[data-edit-exp]").click(); await wait(100);
  ok("改既有的那一筆:沒有放圖那一排", !shown(q("#exp-edit-form .man-pics")), "");
  q("#xe-cancel").click(); await wait(60);

  /* 7. 手動加行程帶 2 張:帶 pics(「附圖」欄),行程那一列標題下面那排有縮圖(+1) */
  q("#tab-plan").click(); await wait(60);
  addBy("stop"); await wait(120);
  out.行程表 = { 開了: shown(q("#stop-add-overlay")), 放圖: shown(q("#stop-form .man-pics")), 拍照: shown(q("#stop-form [data-pics-shoot]")) };
  await put(q("#stop-form [data-pics-file]"), ["#7a9bc9", "#9bc97a"]);
  q("#sf-time").value = "20:00"; q("#sf-title").value = "看夜景";
  nPhoto = calls(/resource=photo/, "POST").length;
  q("#stop-form").requestSubmit();
  await until(() => calls(/resource=itinerary/, "POST").length > 0);
  await wait(200);
  var it = calls(/resource=itinerary/, "POST").pop();
  var row = qa("#route .stop").find(e => /看夜景/.test(e.textContent));
  out.行程 = { 上傳: calls(/resource=photo/, "POST").length - nPhoto, pics: it && body(it).pics, 縮圖: row ? !!row.querySelector(".wiki-ph .ph-thumb") : "找不到那一列" };
  out.行程.角落 = row && row.querySelector(".ph-more") ? row.querySelector(".ph-more").textContent : "";
  out.行程表.觸控 = !!(w.matchMedia && w.matchMedia("(pointer: coarse)").matches);
  ok("手動加行程有放圖那一排(觸控螢幕才有拍照)", out.行程表.開了 && out.行程表.放圖 && out.行程表.拍照 === out.行程表.觸控, out.行程表);
  ok("存的時候傳 2 張、帶 pics(上傳編號 2 個);那一列有縮圖、角落 +1", out.行程.上傳 === 2 && Array.isArray(out.行程.pics) && out.行程.pics.length === 2 && out.行程.縮圖 === true && out.行程.角落 === "+1", out.行程);

  /* 8. 手動許願帶 1 張:帶 pics,願望那一列有縮圖 */
  q("#tab-wish").click(); await wait(80);
  addBy("wish"); await wait(120);
  await put(q("#wish-form [data-pics-file]"), ["#c97a9b"]);
  q("#wf-title").value = "貓咪咖啡";
  q("#wish-form").requestSubmit();
  await until(() => calls(/resource=wishes/, "POST").length > 0);
  await wait(200);
  var wp = calls(/resource=wishes/, "POST").pop();
  var wrow = qa("#wish-list .wish").find(e => /貓咪咖啡/.test(e.textContent));
  out.許願 = { pics: wp && body(wp).pics, 縮圖: wrow ? !!wrow.querySelector(".wiki-ph .ph-thumb") : "找不到那一列" };
  ok("手動許願:帶 pics(1 個),願望那一列有縮圖", Array.isArray(out.許願.pics) && out.許願.pics.length === 1 && out.許願.縮圖 === true, out.許願);

  /* 9. 手動加一段交通帶 1 張:帶 photos;改既有的那一段不放圖 */
  q("#tab-fly").click(); await wait(80);
  addBy("transport"); await wait(150);
  out.交通放圖 = shown(q("#flight-form .man-pics"));
  await put(q("#flight-form [data-pics-file]"), ["#7ac9b8"]);
  var bus = q('#fl-kinds input[value="巴士"]'); bus.checked = true; bus.dispatchEvent(new Event("change", { bubbles: true }));
  q("#fl-no").value = "夜行 1 號"; q("#fl-depart").value = "2026-10-06T22:00";
  q("#flight-form").requestSubmit();
  await until(() => calls(/resource=flights/, "POST").length > 0, 120);
  await wait(300);
  var fp = calls(/resource=flights/, "POST").pop();
  out.交通 = { 放圖: out.交通放圖, photos: fp && body(fp).photos };
  ok("手動加一段交通:有放圖那一排,存的時候帶 photos(1 個)", out.交通.放圖 && Array.isArray(out.交通.photos) && out.交通.photos.length === 1, out.交通);
  var ed = q("[data-flight-edit]"); if (ed) { ed.click(); await wait(120); ok("改既有的那一段:沒有放圖那一排", !shown(q("#flight-form .man-pics")), ""); q("#fl-cancel").click(); }

  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
