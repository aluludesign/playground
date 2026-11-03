/* 換畫面時平移過去(2026-11-03,Lulu)。Nominatim 假造。
 *   WIDTH=390 ./probe.sh probes/map-glide.js
 *   WIDTH=1440 ./probe.sh probes/map-glide.js
 * 看:＋／−、搜完框住、點卡片 → 不直接跳:中心和縮放一起漸變(中途是小數縮放、圖磚那層有 transform),
 *     圖釘在不縮放的 .pins 那層、位置跟著走;舊圖磚留在底下撐著;走完回到不變形、圖釘回去、位置對;
 *     `_v` 一開始就是終點;自動框住、點卡片不算使用者動過(按鈕還是「搜尋」),＋／− 算;
 *     中途再按一次從現在的樣子接著走(不跳回去);中途手指按下去停在現在的樣子、拖動即時跟手不加動畫;
 *     太遠 → 淡入、不飛;prefers-reduced-motion → 直接跳過去。 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = e => (e && e.textContent || "").replace(/\s+/g, " ").trim();
var real = w.fetch, asked = [], reply = null;
var HITS = [0, 1, 2, 3].map(n => ({ lat: String(35.70 + n * 0.004), lon: String(139.78 + n * 0.006), class: "amenity", type: "restaurant",
  display_name: "拉麵" + (n + 1) + "號, 台東區, 東京都, 日本", extratags: {} }));
var NY = [{ lat: "40.7580", lon: "-73.9855", class: "tourism", type: "attraction", display_name: "Times Square, Manhattan, New York, United States", extratags: {} }];
w.fetch = function (u, init) {
  var s = String(u);
  if (s.indexOf("nominatim") >= 0) { asked.push(s); return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(reply || HITS))) }); }
  if (s.indexOf("wikidata.org") >= 0 || s.indexOf("commons.wikimedia.org/w/api.php") >= 0) return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  return real(u, init);
};
/* 探針的 iframe 不跑 rAF:換成每 16ms 一格,才量得到中途的樣子 */
w.requestAnimationFrame = cb => w.setTimeout(() => cb(w.performance.now()), 16);
w.cancelAnimationFrame = id => w.clearTimeout(id);
var still = false, rawMM = w.matchMedia.bind(w);
w.matchMedia = m => /prefers-reduced-motion/.test(m) ? { matches: still, media: m, addEventListener() {}, removeEventListener() {} } : rawMM(m);
var TILE = 256;
var projX = (lo, z) => (lo + 180) / 360 * Math.pow(2, z);
var projY = (la, z) => { var r = la * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z); };
async function until(f, n) { for (var i = 0; i < (n || 60); i++) { if (f()) return true; await wait(50); } return false; }
var calm = box => until(() => !box._anim, 40);
var top = box => q("#" + box.id + " .layer:not(.under)");
var scaleOf = L => { var m = /scale\(([^)]+)\)/.exec(L && L.style.transform || ""); return m ? +m[1] : 1; };
/* 點畫在哪(畫面上,相對地圖左上)vs 投影算出來的位置 */
function pinOff(box, k, lo, la) {
  var p = q("#" + box.id + ' .pin[data-k="' + k + '"]'); if (!p) return null;
  var b = box.getBoundingClientRect(), r = p.getBoundingClientRect(), v = box._v;
  var n = Math.pow(2, v.z), x = projX(lo, v.z); x += n * Math.round((v.cx - x) / n);
  var ex = box.clientWidth / 2 + (x - v.cx) * TILE, ey = box.clientHeight / 2 + (projY(la, v.z) - v.cy) * TILE;
  return Math.round(Math.abs(r.left + r.width / 2 - b.left - ex) + Math.abs(r.top + r.height / 2 - b.top - ey));
}
function ptr(box, t, x, y, id) {
  var b = box.getBoundingClientRect();
  box.dispatchEvent(new w.PointerEvent(t, { clientX: b.left + x, clientY: b.top + y, pointerId: id || 9, bubbles: true, cancelable: true, pointerType: "touch" }));
}
return (async function () {
  await wait(300);
  var out = { 寬: w.innerWidth }, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };

  /* 1 行程地圖:按 ＋ */
  var mm = q("#map");
  if (mm && mm._v && mm.clientWidth) {
    var z0 = mm._v.z, pk = (q("#map .pin") || {}).dataset;
    var p0 = q("#map .pin"), pb0 = p0 && p0.getBoundingClientRect().width;
    q('#map [data-zoom="1"]').click();
    var right = { z: mm._v.z, 有動畫: !!mm._anim };
    await wait(130);
    var L = top(mm), s = scaleOf(L), pins = q("#map .pins");
    var p1 = q("#map .pins .pin");
    out.行程中途 = { 終點z: right.z, 有動畫: right.有動畫, 縮放: +s.toFixed(3), 圖釘在不縮放那層: !!pins && !L.querySelector(".pin"),
      圖釘大小不變: p1 ? Math.abs(p1.getBoundingClientRect().width - pb0) < 1 : null, 底下撐著: qa("#map .layer.under").length };
    ok("行程地圖按 ＋:_v 馬上是終點、畫面中途是小數縮放(0.5～1 之間)、圖釘在 .pins 不跟著縮、舊圖磚在底下撐著",
      right.z === z0 + 1 && right.有動畫 && s > 0.5 && s < 1 && out.行程中途.圖釘在不縮放那層 && out.行程中途.圖釘大小不變 !== false && out.行程中途.底下撐著 >= 1, out.行程中途);
    await calm(mm);
    L = top(mm);
    out.行程走完 = { 變形: L.style.transform, 圖釘回去: !q("#map .pins") && !!L.querySelector(".pin") };
    ok("走完:圖磚那層不變形、圖釘回到圖層裡", !out.行程走完.變形 && out.行程走完.圖釘回去, out.行程走完);
  } else out.行程地圖 = "這個寬度沒有畫(略過)";

  /* 2 全螢幕搜尋:搜完自動框住 → 有動畫、不算使用者動過 */
  q("#tab-wish").click(); await wait(80);
  q("#add-wish-btn").click(); await wait(150);
  q("#wf-title").value = "麵屋"; q('[data-seek="wf-title"]').click();
  var sm = q("#ss-map");
  await until(() => q("#ss-q-out .hcard"));
  var fitAnim = !!sm._anim;
  await calm(sm);
  out.框住 = { 有動畫: fitAnim, 按鈕: txt(q('[data-seek="ss-q"]')), 點偏: pinOff(sm, "h0", 139.78, 35.70) };
  ok("搜完框住結果:有平移、按鈕還是「搜尋」(自動移動不算動過)、走完點的位置對", out.框住.按鈕 === "搜尋" && out.框住.點偏 <= 2, out.框住);

  /* 3 點卡片 → 平移到那個點,不算動過 */
  q('#ss-q-out [data-hit="ss-q"][data-i="3"]').click();
  out.點卡片 = { 有動畫: !!sm._anim };
  await calm(sm);
  out.點卡片.按鈕 = txt(q('[data-seek="ss-q"]'));
  out.點卡片.點偏 = pinOff(sm, "h3", 139.798, 35.712);
  ok("點卡片:平移過去、按鈕還是「搜尋」、走完點的位置對", out.點卡片.有動畫 && out.點卡片.按鈕 === "搜尋" && out.點卡片.點偏 <= 2, out.點卡片);

  /* 4 中途再按 ＋:從現在的樣子接著走,不跳回去 */
  var z1 = sm._v.z;
  q('#ss-map [data-zoom="1"]').click();
  await wait(120);
  var mid = sm._anim && sm._anim.at.z;
  q('#ss-map [data-zoom="1"]').click();
  var after = sm._anim && sm._anim.at.z;
  out.接著走 = { 第一下中途: mid && +mid.toFixed(3), 第二下開始: after && +after.toFixed(3), 終點: sm._v.z };
  ok("動畫中途再按 ＋:第二段從現在的縮放開始(不跳回起點)、終點 +2", mid > z1 && mid < z1 + 1 && Math.abs(after - mid) < 0.15 && sm._v.z === z1 + 2, out.接著走);
  await calm(sm);
  out.按鈕算動過 = txt(q('[data-seek="ss-q"]'));
  ok("按 ＋／− 算使用者動過(按鈕變「重新搜這個範圍」)", /重新搜這個範圍/.test(out.按鈕算動過), out.按鈕算動過);

  /* 5 中途手指按下去:停在現在的樣子,接著拖即時跟手 */
  q('#ss-map [data-zoom="-1"]').click();
  await wait(120);
  var at = sm._anim && sm._anim.at, cx = sm.clientWidth / 2, cy = sm.clientHeight / 2;
  ptr(sm, "pointerdown", cx, cy);
  out.按住 = { 停了: !sm._anim, z: sm._v.z, 中途z: at && +at.z.toFixed(3), 底下撐著: qa("#ss-map .layer.under").length };
  ok("中途按下去:動畫停、縮放取最近的整數級(不跳回起點)、底下的舊圖磚拿掉",
    out.按住.停了 && Math.abs(out.按住.z - at.z) <= 0.5 && out.按住.底下撐著 === 0, out.按住);
  ptr(sm, "pointermove", cx + 40, cy + 20);
  out.拖 = { 變形: top(sm).style.transform, 有動畫: !!sm._anim };
  ptr(sm, "pointerup", cx + 40, cy + 20);
  out.拖.放開有動畫 = !!sm._anim;
  ok("手指拖:即時跟手(圖層 translate)、不加動畫", /translate\(40px, ?20px\)/.test(out.拖.變形) && !out.拖.有動畫 && !out.拖.放開有動畫, out.拖);

  /* 6 太遠(往外找跳到紐約):不飛,淡入 */
  /* 畫面裡、城市裡都找不到 → 「往外找」才跳到紐約 */
  reply = [];
  q("#ss-q").value = "Times Square"; q('[data-seek="ss-q"]').click();
  for (var t = 0; t < 3 && !q("#ss-q-out [data-wide]"); t++) {
    await until(() => q("#ss-q-out .ss-city"));
    if (!q("#ss-q-out [data-wide]")) { var c = q("#ss-q-out .ss-city"); c.click(); await wait(300); }
  }
  reply = NY;
  q("#ss-q-out [data-wide]").click();
  await until(() => sm._anim || q("#ss-q-out .hcard"));
  var tl = top(sm);
  out.太遠 = { 有動畫: !!sm._anim, 透明度: tl && tl.style.opacity, 沒有飛: !q("#ss-map .pins") && !(tl && tl.style.transform) };
  await calm(sm);
  out.太遠.走完透明度 = top(sm).style.opacity;
  out.太遠.點偏 = pinOff(sm, "h0", -73.9855, 40.758);
  ok("太遠:淡入(新的那層從透明開始、不變形)、走完不透明、點的位置對",
    out.太遠.有動畫 && +out.太遠.透明度 < 1 && out.太遠.沒有飛 && !out.太遠.走完透明度 && out.太遠.點偏 <= 2, out.太遠);
  reply = null;

  /* 7 prefers-reduced-motion:直接跳過去 */
  still = true;
  var z2 = sm._v.z;
  q('#ss-map [data-zoom="1"]').click();
  out.不要動畫 = { 有動畫: !!sm._anim, 變形: top(sm).style.transform, z: sm._v.z };
  ok("prefers-reduced-motion:按 ＋ 直接跳過去,沒有動畫、不變形", !out.不要動畫.有動畫 && !out.不要動畫.變形 && out.不要動畫.z === z2 + 1, out.不要動畫);
  still = false;

  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
