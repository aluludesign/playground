/* AI 一次好幾張照片(2026-10-12 定案,「額度分配討論」交接):最多 3 張、只算 1 次 AI;
 * 好幾張時縮到長邊 1200px;每一筆只掛它自己那幾張(Lulu 選的),縮圖寫「+N」、點開左右換。
 *   WIDTH=390 ./probe.sh probes/ai-multi-photo.js
 *   WIDTH=1440 ./probe.sh probes/ai-multi-photo.js */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var next = null, sentBody = null, aiCalls = 0, real = w.fetch;
w.fetch = function (u, init) {
  if (/\/api\/ai/.test(String(u)) && init && init.method === "POST") {
    aiCalls++; try { sentBody = JSON.parse(init.body); } catch (e) {}
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: next }) });
  }
  return real(u, init);
};
var base = { title: "", day: "", time: "", note: "", amount: 0, currency: "", date: "", category: "", legs: [], items: [], parts: [], message: "" };
var calls = (re, m) => (w.__calls || []).filter(c => re.test(c.url) && (!m || c.method === m));
async function file(name, wpx, hpx, color) {
  var c = d.createElement("canvas"); c.width = wpx; c.height = hpx;
  var g = c.getContext("2d"); g.fillStyle = color; g.fillRect(0, 0, wpx, hpx);
  for (var i = 0; i < 400; i++) { g.fillStyle = "rgba(" + (i * 7 % 255) + "," + (i * 13 % 255) + ",90,.5)"; g.fillRect((i * 37) % wpx, (i * 53) % hpx, 40, 12); }
  var blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.95));
  return new w.File([blob], name, { type: "image/jpeg" });
}
async function give(files) {
  var dt = new w.DataTransfer(); files.forEach(f => dt.items.add(f));
  var inp = q("#ai-file"); inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true })); await wait(120);
}
var thumbs = () => qa("#ai-imgs .ai-im").length;
var dims = b64 => new Promise(r => { var im = new w.Image(); im.onload = () => r([im.naturalWidth, im.naturalHeight]); im.onerror = () => r([0, 0]); im.src = "data:image/jpeg;base64," + b64; });
return (async function () {
  await wait(300);
  var out = {}, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var A = await file("a.jpg", 2400, 1800, "#fff"), B = await file("b.jpg", 1800, 2400, "#eee"), C = await file("c.jpg", 2000, 1500, "#ddd"), D = await file("d.jpg", 800, 600, "#ccc");

  q("#ai-btn").click(); await wait(120);
  ok("選圖那一格可以一次選好幾張(multiple)、按鈕先講「最多 3 張」", q("#ai-file").multiple && /最多 3 張/.test(txt("#ai-pick")), txt("#ai-pick"));
  await give([A, B]);
  out.兩張 = { 縮圖: thumbs(), 說: txt("#ai-img-name") };
  ok("選兩張 → 兩個小縮圖、講「已加入 2 張(最多 3 張)」", out.兩張.縮圖 === 2 && out.兩張.說 === "已加入 2 張(最多 3 張)", out.兩張);
  /* 再選兩張(加起來 4 張)→ 系統相簿限制不了張數,回到 App 挑:勾滿 3 張其他的變灰,取消勾一張才能改勾別的(2026-10-12,Lulu) */
  await give([C, D]);
  var tiles = () => qa("#pk-grid [data-pk]");
  out.挑 = { 開著: !q("#pick-overlay").hidden, 張數: tiles().length, 勾: tiles().map(b => b.checked), 灰: tiles().map(b => b.disabled), 說: txt("#pk-say"), 縮圖還是: thumbs() };
  ok("加起來 4 張 → 跳出挑選:4 張、前 3 張勾著、第 4 張變灰、講「已勾 3 / 3」", out.挑.開著 && out.挑.張數 === 4 && out.挑.勾.join() === "true,true,true,false" &&
    out.挑.灰.join() === "false,false,false,true" && /已勾 3 \/ 3/.test(out.挑.說) && out.挑.縮圖還是 === 2, out.挑);
  tiles()[1].click(); await wait(50);
  ok("取消勾第 2 張 → 第 4 張可以勾了", !tiles()[3].disabled && /已勾 2 \/ 3/.test(txt("#pk-say")), txt("#pk-say"));
  tiles()[3].click(); await wait(50);
  ok("勾第 4 張 → 又滿 3 張,第 2 張變灰", tiles()[1].disabled && tiles()[3].checked, tiles().map(b => b.disabled));
  q("#pick-form").requestSubmit(); await wait(80);
  out.挑完 = { 關了: q("#pick-overlay").hidden, 縮圖: thumbs(), 說: txt("#ai-img-name"), 選圖鈕停用: q("#ai-pick").disabled };
  ok("用這幾張 → 3 個縮圖(A、C、D)、選圖鈕停用", out.挑完.關了 && out.挑完.縮圖 === 3 && out.挑完.說 === "已加入 3 張(最多 3 張)" && out.挑完.選圖鈕停用, out.挑完);
  await give([B]);
  ok("滿 3 張再選 → 跳挑選;按取消 → 照舊 3 張", !q("#pick-overlay").hidden && tiles().length === 4, tiles().length);
  q("#pk-cancel").click(); await wait(60);
  ok("取消後還是原本那 3 張", q("#pick-overlay").hidden && thumbs() === 3, thumbs());
  q('#ai-imgs [data-ai-rm="1"]').click(); await wait(60);
  out.拿掉 = { 縮圖: thumbs(), 說: txt("#ai-img-name"), 選圖鈕停用: q("#ai-pick").disabled };
  ok("按 ✕ 拿掉一張 → 剩 2 張、選圖鈕又能按", out.拿掉.縮圖 === 2 && out.拿掉.說 === "已加入 2 張(最多 3 張)" && !out.拿掉.選圖鈕停用, out.拿掉);
  await give([B]);
  ok("再補一張 → 3 張(沒超過就不跳挑選)", thumbs() === 3 && q("#pick-overlay").hidden, thumbs());

  /* 送出:3 張、各自縮到 1200,AI 只問一次;回兩筆:第一筆來自圖 1、2(同一張收據拍兩段),第二筆來自圖 3 */
  var up0 = w.__photoUploads || 0, ex0 = calls(/resource=expenses/, "POST").length;
  next = Object.assign({}, base, { intent: "expense", items: [
    Object.assign({}, base, { title: "HANDS", amount: 3256, currency: "JPY", date: "2026-10-05", category: "購物", photos: [1, 2] }),
    Object.assign({}, base, { title: "一蘭", amount: 2980, currency: "JPY", date: "2026-10-05", category: "餐飲", photos: [3] })] });
  q("#ai-text").value = "這三張"; q("#ai-form").requestSubmit();
  for (var i = 0; i < 60 && q("#exp-edit-overlay").hidden; i++) await wait(100);
  out.送出 = { AI次數: aiCalls, 張數: sentBody && sentBody.images && sentBody.images.length, 舊欄位: sentBody && sentBody.image !== undefined };
  out.第一張尺寸 = sentBody && sentBody.images ? await dims(sentBody.images[0]) : null;
  out.總長度 = sentBody && sentBody.images ? sentBody.images.reduce((n, x) => n + x.length, 0) : 0;
  ok("送出:3 張一起、只問 AI 一次、不再送單張的 image 欄", out.送出.AI次數 === 1 && out.送出.張數 === 3 && !out.送出.舊欄位, out.送出);
  ok("好幾張時縮到長邊 1200px,加起來壓在 4MB 以下", out.第一張尺寸 && Math.max(out.第一張尺寸[0], out.第一張尺寸[1]) === 1200 && out.總長度 < 4000000, { 尺寸: out.第一張尺寸, 總長度: out.總長度 });
  ok("讀到帳 → 三張各傳一次", (w.__photoUploads || 0) - up0 === 3, (w.__photoUploads || 0) - up0);
  q("#exp-edit-form").requestSubmit(); await wait(1200);   /* 一批:一次存兩筆 */
  var ep = calls(/resource=expenses/, "POST").slice(ex0).map(c => c.body.photos || []);
  out.各掛幾張 = ep.map(x => x.length);
  ok("每一筆只掛自己的:HANDS 帶圖 1、2 的編號,一蘭帶圖 3 的", ep.length === 2 && ep[0].length === 2 && ep[1].length === 1 && ep[0].indexOf(ep[1][0]) < 0, ep);

  var rowOf = t => qa("#exp-list .exp").find(r => r.querySelector(".ti") && r.querySelector(".ti").textContent.trim() === t);
  var hRow = rowOf("HANDS"), iRow = rowOf("一蘭");
  out.縮圖角落 = { HANDS: hRow && (hRow.querySelector(".ph-more") || {}).textContent, 一蘭: iRow && !!iRow.querySelector(".ph-more") };
  ok("HANDS 的縮圖角落寫「+1」,一蘭的沒有", out.縮圖角落.HANDS === "+1" && out.縮圖角落.一蘭 === false, out.縮圖角落);
  if (hRow) {
    hRow.querySelector(".ph-thumb").click(); await wait(120);
    var s1 = q("#ph-img").getAttribute("src");
    out.放大 = { 開著: !q("#photo-overlay").hidden, 計數: txt("#ph-n"), 有左右: !q("#ph-prev").hidden && !q("#ph-next").hidden };
    ok("點開:1 / 2、有左右兩顆", out.放大.開著 && out.放大.計數 === "1 / 2" && out.放大.有左右, out.放大);
    q("#ph-next").click(); await wait(60);
    ok("按 › → 2 / 2、換成第二張", txt("#ph-n") === "2 / 2" && q("#ph-img").getAttribute("src") !== s1, txt("#ph-n"));
    d.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); await wait(60);
    ok("按 → 鍵 → 繞回 1 / 2", txt("#ph-n") === "1 / 2" && q("#ph-img").getAttribute("src") === s1, txt("#ph-n"));
    q("#ph-close").click(); await wait(60);
  }
  if (iRow) {
    iRow.querySelector(".ph-thumb").click(); await wait(100);
    ok("只有一張的:沒有左右、沒有計數", q("#ph-prev").hidden && q("#ph-n").hidden, "");
    q("#ph-close").click(); await wait(60);
  }

  /* AI 沒講來自哪幾張(舊的回法):掛全部 */
  q("#ai-btn").click(); await wait(120);
  ok("重新打開 AI:上一次的照片清掉了", thumbs() === 0 && txt("#ai-img-name") === "", thumbs());
  await give([A, C]);
  var ex1 = calls(/resource=expenses/, "POST").length;
  next = Object.assign({}, base, { intent: "expense", items: [Object.assign({}, base, { title: "沒標圖的", amount: 500, currency: "JPY", date: "2026-10-05", category: "其他" })] });
  q("#ai-text").value = "x"; q("#ai-form").requestSubmit();
  for (var k = 0; k < 60 && q("#exp-edit-overlay").hidden; k++) await wait(100);
  q("#exp-edit-form").requestSubmit(); await wait(700);
  var last = calls(/resource=expenses/, "POST").slice(ex1)[0];
  ok("AI 沒講來自哪幾張 → 兩張都掛", last && (last.body.photos || []).length === 2, last && last.body.photos);

  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
