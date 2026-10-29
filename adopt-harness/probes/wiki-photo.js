/* 維基照片(2026-10-18,Lulu):搜尋候選有維基照片就放照片、沒有照舊是小地圖;
 * 照片用真的 Commons 檔名(Sensoji 2023.jpg):小縮圖載不到會整塊藏起來,假檔名量不到大小。
 * 挑了有照片的地點 → 存進 Notion「照片」欄(Commons 照片頁網址)→ 許願卡、行程卡在備註下一排出現照片。
 * Nominatim、Wikidata 都假造(不打真的網路)。
 *   WIDTH=390 ./probe.sh probes/wiki-photo.js
 *   WIDTH=1440 ./probe.sh probes/wiki-photo.js */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var real = w.fetch, asked = [];
var HITS = [
  { lat: "35.71477", lon: "139.79665", display_name: "淺草寺, 浅草二丁目, 台東區, 東京都, 日本", extratags: { wikidata: "Q615183" } },
  { lat: "35.71200", lon: "139.79500", display_name: "淺草寺前拉麵, 浅草一丁目, 台東區, 東京都, 日本", extratags: {} },
];
var ENT = { entities: { Q615183: { claims: { P18: [{ mainsnak: { datavalue: { value: "Sensoji 2023.jpg" } } }] } } } };
w.fetch = function (u, init) {
  var s = String(u);
  if (s.indexOf("nominatim") >= 0) { asked.push(s); return Promise.resolve({ ok: true, json: () => Promise.resolve(HITS) }); }
  if (s.indexOf("wikidata.org") >= 0) { asked.push(s); return Promise.resolve({ ok: true, json: () => Promise.resolve(ENT) }); }
  return real(u, init);
};
var PAGE = "https://commons.wikimedia.org/wiki/File:Sensoji_2023.jpg";
var calls = (re, m) => (w.__calls || []).filter(c => re.test(c.url) && (!m || c.method === m));
return (async function () {
  await wait(300);
  var out = {}, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  q("#tab-wish").click(); await wait(80);
  q("#wishbox") && (q("#wishbox").open = true);
  q("#add-wish-btn").click(); await wait(120);
  q("#wf-title").value = "淺草寺"; q('[data-seek="wf-title"]').click();
  for (var i = 0; i < 40 && !q("#wf-title-out .hit"); i++) await wait(100);
  await wait(300);
  out.問了 = { 帶extratags: asked.some(x => /nominatim/.test(x) && /extratags=1/.test(x)), 問了wikidata: asked.some(x => /wbgetentities/.test(x) && /Q615183/.test(x)) };
  var th = qa("#wf-title-out .hit .ph img").map(im => im.getAttribute("src"));
  out.小圖 = th;
  ok("Nominatim 帶 extratags=1、有 wikidata 的那筆去 Wikidata 問了照片", out.問了.帶extratags && out.問了.問了wikidata, out.問了);
  ok("有維基照片的那筆換成照片,沒有的照舊是小地圖", /commons\.wikimedia\.org\/wiki\/Special:FilePath\/Sensoji_2023\.jpg/.test(th[0] || "") && /tile\.openstreetmap\.org/.test(th[1] || ""), th);
  q('#wf-title-out [data-hit][data-i="0"]').click(); await wait(100);
  var w0 = calls(/resource=wishes/, "POST").length;
  q("#wish-form").requestSubmit(); await wait(500);
  var p = calls(/resource=wishes/, "POST").slice(w0)[0];
  out.存了 = p && { title: p.body.title, place: p.body.place, photo: p.body.photo };
  ok("挑了淺草寺 → 存進去的照片是 Commons 照片頁網址", out.存了 && out.存了.photo === PAGE, out.存了);
  /* 許願卡:備註的下一排是跟收據照片一樣大的小縮圖(10-19,Lulu:「照片太大張了」),點了放大、放大那頁標出處 */
  var card = qa("#wish-list .wish").find(x => /淺草寺/.test(x.textContent));
  var th = card && card.querySelector(".wiki-ph .ph-thumb.wiki");
  var rc = th && th.getBoundingClientRect(), receipt = d.createElement("button");
  out.卡 = th && { 寬: Math.round(rc.width), 高: Math.round(rc.height), 小圖: th.querySelector("img").getAttribute("src"),
    在最後: card.querySelector(".wm") && !!(card.querySelector(".wm").compareDocumentPosition(th) & Node.DOCUMENT_POSITION_FOLLOWING) };
  ok("許願卡最後一列是 32×32 的小縮圖(跟收據照片一樣),在備註那一排下面", out.卡 && out.卡.寬 === 32 && out.卡.高 === 32 && /width=96/.test(out.卡.小圖) && out.卡.在最後, out.卡);
  if (th) { th.click(); await wait(150); }
  out.放大 = { 開了: !q("#photo-overlay").hidden, 圖: q("#ph-img").getAttribute("src"), 出處: !q("#ph-credit").hidden && q("#ph-credit").getAttribute("href"), 字: q("#ph-credit").textContent };
  ok("點了放大:大圖、下面「照片:維基共享資源」連到 Commons 那一頁", out.放大.開了 && /Sensoji_2023\.jpg\?width=1200/.test(out.放大.圖) && out.放大.出處 === PAGE && out.放大.字 === "照片:維基共享資源", out.放大);
  q("#ph-close").click(); await wait(60);
  /* 挑沒照片的那一筆 → 不帶照片 */
  q("#add-wish-btn").click(); await wait(120);
  q("#wf-title").value = "淺草寺前"; q('[data-seek="wf-title"]').click();
  for (var k = 0; k < 40 && !q("#wf-title-out .hit"); k++) await wait(100);
  await wait(300);
  q('#wf-title-out [data-hit][data-i="1"]').click(); await wait(100);
  var w1 = calls(/resource=wishes/, "POST").length;
  q("#wish-form").requestSubmit(); await wait(500);
  var p2 = calls(/resource=wishes/, "POST").slice(w1)[0];
  ok("挑了沒有維基照片的 → 照片是空的、卡上沒有照片", p2 && p2.body.photo === "" &&
    !(qa("#wish-list .wish").find(x => /淺草寺前拉麵/.test(x.textContent)) || d.body).querySelector(".wiki-ph"), p2 && p2.body);
  /* 行程:挑了淺草寺 → 存進去帶照片,行程卡最後一列有照片 */
  q("#tab-plan").click(); await wait(80);
  q("#add-stop-btn").click(); await wait(120);
  q("#sf-title").value = "淺草寺"; q('[data-seek="sf-title"]').click();
  for (var m = 0; m < 40 && !q("#sf-title-out .hit"); m++) await wait(100);
  await wait(300);
  q('#sf-title-out [data-hit][data-i="0"]').click(); await wait(100);
  if (q("#sf-time")) q("#sf-time").value = "10:00";
  var s0 = calls(/resource=itinerary/, "POST").length;
  q("#stop-form").requestSubmit(); await wait(600);
  var sp = calls(/resource=itinerary/, "POST").slice(s0)[0];
  var sc = qa("#route .stop").find(x => x.querySelector(".ti") && x.querySelector(".ti").textContent.replace("📍", "").trim() === "淺草寺");   /* fixture 本來就有「淺草寺參拜」,要找新的那一筆 */
  out.行程 = { 存的照片: sp && sp.body.photo, 卡上: !!(sc && sc.querySelector(".b .wiki-ph .ph-thumb img")), 天: sp && sp.body.day, 清單: qa("#route .stop .ti").map(x => x.textContent.trim()), 圖數: qa("#route .wiki-ph").length };
  ok("行程:存進去帶照片、行程卡備註下一排有照片", out.行程.存的照片 === PAGE && out.行程.卡上, out.行程);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
