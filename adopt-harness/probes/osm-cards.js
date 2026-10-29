/* 一般搜的候選 = 橫向卡片(2026-10-29,Lulu:長得跟強力搜的 Google 清單一樣)。
 * Nominatim、Wikidata、Commons 都假造(不打真的網路);Wikidata 故意慢 1.2 秒,看清單有沒有等它。
 *   WIDTH=390 ./probe.sh probes/osm-cards.js
 *   WIDTH=1440 ./probe.sh probes/osm-cards.js
 * 看:橫向一排、一次一張多一點、「›」往下一張;上照片下資料、最下「地圖 ↗」;類別轉中文、營業時間有才有;
 *     維基照片不擋清單、拿到再換、下面標作者和授權;圖磚載不到換類別圖示;點卡片=選、點地圖不算選。 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = e => (e && e.textContent || "").replace(/\s+/g, " ").trim();
var real = w.fetch, asked = [];
var HITS = [
  { lat: "35.71477", lon: "139.79665", class: "amenity", type: "place_of_worship", display_name: "淺草寺, 浅草二丁目, 台東區, 東京都, 日本",
    extratags: { wikidata: "Q615183", religion: "buddhist", opening_hours: "Mo-Su 06:00-17:00" } },
  { lat: "35.71200", lon: "139.79500", class: "amenity", type: "restaurant", display_name: "淺草拉麵, 浅草一丁目, 台東區, 東京都, 日本",
    extratags: { cuisine: "ramen" } },
  { lat: "35.71390", lon: "139.77750", class: "railway", type: "station", display_name: "上野站, 上野七丁目, 台東區, 東京都, 日本", extratags: {} },
  { lat: "x", lon: "y", class: "shop", type: "convenience", display_name: "某便利商店, 台東區, 東京都, 日本", extratags: {} },
];
for (var n = 0; n < 9; n++) HITS.push({ lat: String(35.70 + n / 1000), lon: "139.79", class: "tourism", type: "attraction", display_name: "景點" + n + ", 台東區, 東京都, 日本", extratags: {} });
var ENT = { entities: { Q615183: { claims: { P18: [{ mainsnak: { datavalue: { value: "Sensoji 2023.jpg" } } }] } } } };
var CRED = { query: { pages: { "1": { title: "File:Sensoji 2023.jpg", imageinfo: [{ extmetadata: { Artist: { value: '<a href="x">Jane Doe</a>' }, LicenseShortName: { value: "CC BY-SA 4.0" } } }] } } } };
w.fetch = function (u, init) {
  var s = String(u);
  if (s.indexOf("nominatim") >= 0) { asked.push(s); return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(HITS))) }); }
  if (s.indexOf("wikidata.org") >= 0) { asked.push(s); return wait(1200).then(() => ({ ok: true, json: () => Promise.resolve(ENT) })); }
  if (s.indexOf("commons.wikimedia.org/w/api.php") >= 0) { asked.push(s); return Promise.resolve({ ok: true, json: () => Promise.resolve(CRED) }); }
  return real(u, init);
};
return (async function () {
  await wait(300);
  var out = { 寬: w.innerWidth }, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  q("#tab-wish").click(); await wait(80);
  q("#wishbox") && (q("#wishbox").open = true);
  q("#add-wish-btn").click(); await wait(120);
  q("#wf-title").value = "淺草"; q('[data-seek="wf-title"]').click();
  for (var i = 0; i < 40 && !q("#ss-q-out .hcard"); i++) await wait(50);
  /* 清單一出現:維基還沒回來,第一張是地圖小圖 */
  var first = q('#ss-q-out [data-i="0"] .ph img');
  out.剛出現 = first && first.className;
  ok("清單不等維基:剛出現時第一張是地圖小圖", out.剛出現 === "tile", out.剛出現);
  var list = q("#ss-q-out .hits"), cards = qa("#ss-q-out .hcard"), lr = list.getBoundingClientRect();
  var c0 = cards[0].getBoundingClientRect(), c1 = cards[1].getBoundingClientRect();
  out.排列 = { 張數: cards.length, 卡寬: Math.round(c0.width), 同一排: Math.round(c0.top) === Math.round(c1.top), 第二張露出: Math.round(Math.min(c1.right, lr.right) - c1.left), 清單寬: Math.round(lr.width), 橫捲: list.scrollWidth > list.clientWidth };
  ok("橫向一排、先 8 張、卡寬 240、看得到第二張的一部分(沒有整張)", out.排列.張數 === 8 && out.排列.卡寬 === 240 && out.排列.同一排 && out.排列.橫捲 &&
    out.排列.第二張露出 > 20 && (w.innerWidth > 700 || out.排列.第二張露出 < 240), out.排列);
  /* 卡片內容 */
  var k = i => q('#ss-q-out .hcard:nth-child(' + (i + 1) + ')');
  out.內容 = [0, 1, 2, 3].map(i => ({ 名: txt(k(i).querySelector("b")), 類: txt(k(i).querySelector(".cat")), 址: txt(k(i).querySelector(".at")), 時: txt(k(i).querySelector(".hrs")),
    圖: (k(i).querySelector(".ph img") || {}).className || (k(i).querySelector(".ph-icon") ? "icon" : ""), 地圖: (k(i).querySelector(".hmap") || {}).href || "" }));
  ok("類別轉中文:寺廟、拉麵店、車站、便利商店", out.內容.map(x => x.類).join(",") === "寺廟,拉麵店,車站,便利商店", out.內容.map(x => x.類));
  ok("營業時間有才顯示(淺草寺 週一-週日 06:00-17:00),其他沒有這一行", out.內容[0].時 === "營業時間 週一-週日 06:00-17:00" && !out.內容[1].時 && !k(1).querySelector(".hrs"), out.內容.map(x => x.時));
  ok("名字、地址都在;沒有評分、價位", out.內容[1].名 === "淺草拉麵" && /台東區/.test(out.內容[1].址) && !/[★☆]|評分|價位|\$/.test(txt(k(1))), out.內容[1]);
  ok("座標壞掉的那筆直接是類別圖示", out.內容[3].圖 === "icon", out.內容[3]);
  ok("「地圖 ↗」開 Google 地圖(帶名字和座標),在卡片按鈕外面", /google\.com\/maps\/search\/%E6%B7%BA%E8%8D%89%E6%8B%89%E9%BA%B5\/@35\.71200,139\.79500/.test(out.內容[1].地圖) &&
    txt(k(1).querySelector(".hmap")) === "地圖 ↗" && !k(1).querySelector(".hmap").closest("[data-hit]"), out.內容[1].地圖);
  /* 版面:照片在上、資料在中、地圖鈕在最下 */
  var ph = k(1).querySelector(".ph").getBoundingClientRect(), tx = k(1).querySelector(".txt").getBoundingClientRect(), mp = k(1).querySelector(".hmap").getBoundingClientRect();
  out.上下 = { 照片: [Math.round(ph.top), Math.round(ph.height)], 字: Math.round(tx.top), 地圖鈕: Math.round(mp.top) };
  ok("上半部照片(高 128)、下面資料、最下面地圖鈕", ph.height === 128 && ph.bottom <= tx.top + 1 && tx.bottom <= mp.top + 1, out.上下);
  /* 維基照片回來了 → 換成照片、標作者和授權 */
  await wait(1600);
  var sh = q('#ss-q-out [data-i="0"] .ph img');
  out.維基 = { 圖: sh && sh.className, src: sh && sh.getAttribute("src"), 標: txt(q('#ss-q-out [data-i="0"] .cred')), 其他張有標: qa('#ss-q-out .cred:not([hidden])').length };
  ok("維基照片拿到後換上,下面標「Wikimedia Commons · 作者 · 授權」;沒照片的不標", out.維基.圖 === "shot" && /Special:FilePath\/Sensoji_2023\.jpg\?width=480/.test(out.維基.src) &&
    out.維基.標 === "Wikimedia Commons · Jane Doe · CC BY-SA 4.0" && out.維基.其他張有標 === 1, out.維基);
  /* 圖磚載不到 → 類別圖示 */
  var t2 = q('#ss-q-out [data-i="2"] .ph img.tile');
  if (t2) { t2.src = "data:image/png;base64,AAAA"; await wait(300); }
  out.圖磚壞 = txt(q('#ss-q-out [data-i="2"] .ph'));
  ok("圖磚載不到 → 換成類別圖示(車站 🚉)", /🚉/.test(out.圖磚壞) && !!q('#ss-q-out [data-i="2"] .ph-icon'), out.圖磚壞);
  /* 「›」往下一張,捲到底再接 8 張,最後一張收起「›」 */
  var nx = q("#ss-q-out .hnext"), x0 = list.scrollLeft;
  out.下一張 = { 看得到: !!nx && !nx.hidden && nx.getClientRects().length > 0 };
  /* 無頭瀏覽器不跑 smooth 捲動的動畫:記下它要捲多少、改成立刻捲 */
  list.scrollBy = function (o) { out.下一張.要求 = o.behavior; Element.prototype.scrollBy.call(this, { left: o.left }); };
  nx.click(); await wait(200);
  delete list.scrollBy;
  out.下一張.捲了 = Math.round(list.scrollLeft - x0);
  ok("右邊「›」看得到,按一下往右捲一張(約 248)", out.下一張.看得到 && out.下一張.捲了 >= 200 && out.下一張.捲了 <= 260, out.下一張);
  list.scrollLeft = list.scrollWidth; list.dispatchEvent(new Event("scroll")); await wait(200);
  list.scrollLeft = list.scrollWidth; list.dispatchEvent(new Event("scroll")); await wait(200);
  out.到底 = { 張數: qa("#ss-q-out .hcard").length, 收起: nx.hidden };
  ok("捲到底接下一批(全部 13 張),最後一張時「›」收起來", out.到底.張數 === 13 && out.到底.收起, out.到底);
  /* 點「地圖 ↗」不算選;點卡片才選 */
  var before = q("#wf-title").value;
  var stop = ev => { if (ev.target.closest && ev.target.closest(".hmap")) ev.preventDefault(); };
  d.addEventListener("click", stop, true);
  k(1).querySelector(".hmap").click(); await wait(80);
  d.removeEventListener("click", stop, true);
  out.點地圖 = { 欄: q("#wf-title").value, 清單還在: !!q("#ss-q-out .hcard") };
  ok("點「地圖 ↗」:地點欄不變、清單還在", out.點地圖.欄 === before && out.點地圖.清單還在, out.點地圖);
  /* 2026-10-29 起:點卡片只是選起來,「選這個」才帶回去(全螢幕地圖搜尋,細節在 map-search.js) */
  k(1).querySelector("[data-hit]").click(); await wait(60);
  ok("點卡片:選起來、還沒帶回去", q("#wf-title").value === before && k(1).classList.contains("on"), q("#wf-title").value);
  k(1).querySelector(".htake").click(); await wait(100);
  out.點卡片 = { 欄: q("#wf-title").value, 狀態: txt(q("#wf-title-out")) };
  ok("「選這個」= 選這個地點(地點欄填名字、已標定)", out.點卡片.欄 === "淺草拉麵" && /已標定/.test(out.點卡片.狀態), out.點卡片);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
