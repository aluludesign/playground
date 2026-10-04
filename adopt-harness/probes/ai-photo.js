/* AI 讀過的照片存起來(2026-10-04,Lulu:「用 AI 傳照片分析的資料要把圖存起來,可以看到小縮圖,點了再放大」)。
 * 只有花費和交通(她選的:收據、車票)。一張照片讀出兩筆帳 → 只傳一次、兩筆都掛同一張;
 * 縮圖在花費列/交通卡上,點了放大、點照片放到原寬、關閉/Esc 收起來;手動記一筆、沒放照片的 AI 都不傳。
 *   WIDTH=390 ./probe.sh probes/ai-photo.js
 *   PAGE='/index.html?photofail=1' WIDTH=390 ./probe.sh probes/ai-photo.js   上傳失敗:帳照樣記、講一聲 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var fail = /photofail=1/.test((w.frameElement && w.frameElement.getAttribute("src")) || "");
var next = null, real = w.fetch;
w.fetch = function (u, init) {
  if (/\/api\/ai/.test(String(u))) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: next }) });
  return real(u, init);
};
var base = { title: "", day: "", time: "", note: "", amount: 0, currency: "", date: "", category: "", legs: [], message: "" };
var calls = (re, m) => (w.__calls || []).filter(c => re.test(c.url) && (!m || c.method === m));
async function givePhoto() {
  var c = d.createElement("canvas"); c.width = 60; c.height = 120;
  var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 60, 120); g.fillStyle = "#333"; g.fillRect(10, 20, 40, 6);
  var blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.9));
  var file = new w.File([blob], "receipt.jpg", { type: "image/jpeg" });
  var dt = new w.DataTransfer(); dt.items.add(file);
  var inp = q("#ai-file"); inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true }));
  for (var i = 0; i < 40 && !/已加入/.test(txt("#ai-img-name")); i++) await wait(50);
}
async function ask(result, withPhoto) {
  next = Object.assign({}, base, result);
  q("#ai-btn").click(); await wait(100);
  if (withPhoto) await givePhoto();
  q("#ai-text").value = "這張"; q("#ai-form").requestSubmit(); await wait(400);
}
return (async function () {
  await wait(300);
  var out = {}, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var up0 = w.__photoUploads || 0;

  /* 1. 一張收據讀出兩筆帳 */
  var items = [{ title: "收據第一筆", amount: 2980, currency: "JPY", date: "2026-10-05", category: "餐飲" }, { title: "收據第二筆", amount: 5400, currency: "JPY", date: "2026-10-05", category: "購物" }];
  await ask({ intent: "expense", items: items.map(x => Object.assign({}, base, x)), title: "收據第一筆", amount: 2980 }, true);
  out.上傳次數_讀完 = (w.__photoUploads || 0) - up0;
  ok("AI 讀到帳(有照片)→ 背景先傳一次照片", out.上傳次數_讀完 === 1, out.上傳次數_讀完);
  q("#exp-edit-form").requestSubmit(); await wait(600);
  q("#exp-edit-form").requestSubmit(); await wait(250);
  out.說 = txt("#sync");
  await wait(450);
  var posts = calls(/resource=expenses/, "POST").slice(-2).map(c => c.body.photo || "");
  out.兩筆帶的 = posts;
  out.上傳次數_存完 = (w.__photoUploads || 0) - up0;
  if (!fail) {
    ok("上傳成功:存好那句不提照片", out.說 === "記下來了:收據第二筆", out.說);
    ok("兩筆都帶同一個上傳編號,照片只傳了一次", posts.length === 2 && posts[0] && posts[0] === posts[1] && out.上傳次數_存完 === 1, out);
    var rows = qa("#exp-list .exp").filter(r => /收據第一筆|收據第二筆/.test(r.textContent));
    out.縮圖 = rows.map(r => !!r.querySelector(".ph-thumb img"));
    ok("花費列上兩筆都有小縮圖", rows.length === 2 && out.縮圖.every(Boolean), out.縮圖);
    var th = rows[0] && rows[0].querySelector(".ph-thumb");
    if (th) {
      var tb = th.getBoundingClientRect();
      out.縮圖大小 = [Math.round(tb.width), Math.round(tb.height)];
      ok("縮圖是小的(32×32)", out.縮圖大小[0] === 32 && out.縮圖大小[1] === 32, out.縮圖大小);
      th.click(); await wait(150);
      var img = q("#ph-img"), ib = img.getBoundingClientRect();
      out.放大 = { 開著: !q("#photo-overlay").hidden, 同一張: img.getAttribute("src") === th.dataset.photo, 寬: Math.round(ib.width), 高: Math.round(ib.height), 編輯框沒開: q("#exp-edit-overlay").hidden };
      ok("點縮圖 → 放大(比縮圖大很多)、不會順便打開改帳", out.放大.開著 && out.放大.同一張 && out.放大.高 > 200 && out.放大.編輯框沒開, out.放大);
      img.click(); await wait(80);
      ok("點照片 → 放到原寬(長收據可以往下捲)", q("#photo-overlay").classList.contains("zoom") && Math.round(img.getBoundingClientRect().width) >= Math.round(q("#photo-overlay .ph-box").getBoundingClientRect().width) - 1, "");
      q("#ph-close").click(); await wait(80);
      ok("按關閉 → 收起來", q("#photo-overlay").hidden, "");
      th.click(); await wait(100);
      d.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await wait(100);
      ok("按 Esc → 收起來", q("#photo-overlay").hidden, "");
      th.click(); await wait(100);
      q("#photo-overlay").dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(100);
      ok("點照片外面 → 收起來", q("#photo-overlay").hidden, "");
    }
  } else {
    ok("上傳失敗:兩筆照樣記下來、不帶照片,講「照片沒存到」", posts.length === 2 && !posts[0] && !posts[1] && /記下來了:收據第二筆\(照片沒存到\)/.test(out.說) &&
      qa("#exp-list .exp").filter(r => /收據第一筆|收據第二筆/.test(r.textContent)).length === 2, out);
  }

  if (!fail) {
    /* 2. 手動記一筆:不傳、不帶 */
    var upA = w.__photoUploads || 0;
    q("#add-exp-btn").click(); await wait(120);
    q("#xe-title").value = "手動的那筆"; q("#xe-amount").value = "300";
    q("#exp-edit-form").requestSubmit(); await wait(500);
    var man = calls(/resource=expenses/, "POST").slice(-1)[0];
    ok("手動記一筆:不傳照片、不帶 photo", (w.__photoUploads || 0) === upA && man && !man.body.photo && man.body.title === "手動的那筆", man && man.body);

    /* 3. AI 只打字(沒照片)讀到帳:不傳 */
    await ask({ intent: "expense", items: [Object.assign({}, base, { title: "便利商店", amount: 600, currency: "JPY", date: "2026-10-05", category: "餐飲" })], title: "便利商店", amount: 600 }, false);
    q("#exp-edit-form").requestSubmit(); await wait(500);
    var txtOnly = calls(/resource=expenses/, "POST").slice(-1)[0];
    ok("AI 沒放照片:不傳、不帶 photo", (w.__photoUploads || 0) === upA && txtOnly && !txtOnly.body.photo && txtOnly.body.title === "便利商店", txtOnly && txtOnly.body);

    /* 4. 車票 → 交通 */
    var upB = w.__photoUploads || 0;
    await ask({ intent: "transport", legs: [{ kind: "火車", no: "のぞみ 1", company: "JR 東海", from: "東京", to: "新大阪", depart: "2026-10-06T08:00", arrive: "2026-10-06T10:30", code: "", dir: "其他", match: "", note: "", seats: [] }] }, true);
    ok("AI 讀到交通(有照片)→ 傳一次", (w.__photoUploads || 0) - upB === 1, (w.__photoUploads || 0) - upB);
    q("#flight-form").requestSubmit(); await wait(700);
    var fpost = calls(/resource=flights/, "POST").slice(-1)[0];
    ok("存那一段交通:帶 photo", fpost && /^f0000000/.test(fpost.body.photo || ""), fpost && fpost.body);
    q("#tab-fly").click(); await wait(200);
    var card = qa(".tleg").find(c => /のぞみ/.test(c.textContent));
    ok("交通卡上有小縮圖,點了放大", !!(card && card.querySelector(".ph-thumb img")), card && card.innerHTML.slice(0, 200));
    if (card && card.querySelector(".ph-thumb")) { card.querySelector(".ph-thumb").click(); await wait(100); ok("交通的縮圖點了也放大", !q("#photo-overlay").hidden, ""); q("#ph-close").click(); }

    /* 5. 改交通(不是 AI 開的)不帶照片 */
    var pen = card && card.querySelector("[data-flight-edit]");
    if (pen) {
      pen.click(); await wait(150); q("#flight-form").requestSubmit(); await wait(600);
      var fpatch = calls(/resource=flights/, "PATCH").slice(-1)[0];
      ok("自己改這一段:不帶 photo(不會把照片換掉)", fpatch && !fpatch.body.photo, fpatch && fpatch.body);
    }
  }
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
