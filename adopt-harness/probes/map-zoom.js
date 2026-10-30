/* 地圖縮放 0～19 級(2026-10-30,Lulu:放到 OSM 圖磚能給的極限)。Nominatim 假造。
 *   WIDTH=390 ./probe.sh probes/map-zoom.js
 *   WIDTH=1440 ./probe.sh probes/map-zoom.js
 * 看:兩張地圖(行程地圖、全螢幕搜尋)都縮得到 0、放得到 19,再按不會超過;
 *     每一張圖磚的 x、y 都在 0..2^z-1(超出去 OSM 回 404);世界比畫面窄時只畫一份、置中;
 *     點的位置跟投影算出來的一樣(0 級、19 級、跨換日線);拖曳、雙擊在兩端正常;
 *     「重新搜這個範圍」送出的 viewbox:縮到全世界是 -180..180、跨換日線只送一邊、經緯度都合法。 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var real = w.fetch, asked = [];
var HITS = [0, 1, 2].map(n => ({ lat: String(35.70 + n * 0.004), lon: String(139.78 + n * 0.004), class: "amenity", type: "restaurant",
  display_name: "拉麵" + (n + 1) + "號, 台東區, 東京都, 日本", extratags: {} }));
w.fetch = function (u, init) {
  var s = String(u);
  if (s.indexOf("nominatim") >= 0) { asked.push(s); return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(HITS))) }); }
  if (s.indexOf("wikidata.org") >= 0 || s.indexOf("commons.wikimedia.org/w/api.php") >= 0) return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  return real(u, init);
};
var TILE = 256;
var projX = (lo, z) => (lo + 180) / 360 * Math.pow(2, z);
var projY = (la, z) => { var r = la * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z); };
var param = (u, k) => { var m = String(u).match(new RegExp("[?&]" + k + "=([^&]*)")); return m ? decodeURIComponent(m[1]) : null; };
async function until(f, n) { for (var i = 0; i < (n || 60); i++) { if (f()) return true; await wait(50); } return false; }
/* 圖磚:全部合法?有沒有重複?世界那一份蓋不蓋得住畫面 */
function tiles(box) {
  var v = box._v, n = Math.pow(2, v.z), seen = {}, badT = [], dup = 0;
  qa("#" + box.id + " img.tile").forEach(t => {
    var m = t.getAttribute("src").match(/\/(\d+)\/(-?\d+)\/(-?\d+)\.png$/);
    if (!m || +m[1] !== v.z || +m[2] < 0 || +m[2] >= n || +m[3] < 0 || +m[3] >= n) badT.push(t.getAttribute("src"));
    var key = m && m[2] + "/" + m[3]; if (seen[key]) dup++; seen[key] = 1;
  });
  return { z: v.z, 張數: qa("#" + box.id + " img.tile").length, 不合法: badT.slice(0, 3), 重複: dup };
}
/* 點畫在哪(相對地圖左上)vs 投影算出來的位置(取離中心最近那一份) */
function pinOff(box, k, lo, la) {
  var p = q("#" + box.id + ' .pin[data-k="' + k + '"]'); if (!p) return null;
  var v = box._v, n = Math.pow(2, v.z), x = projX(lo, v.z); x += n * Math.round((v.cx - x) / n);
  var ex = box.clientWidth / 2 + (x - v.cx) * TILE, ey = box.clientHeight / 2 + (projY(la, v.z) - v.cy) * TILE;
  return Math.round(Math.abs(parseFloat(p.style.left) - ex) + Math.abs(parseFloat(p.style.top) - ey));
}
function drag(box, dx, dy) {
  var b = box.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2 - 40;
  var ev = (t, X, Y) => new w.PointerEvent(t, { clientX: X, clientY: Y, pointerId: 7, bubbles: true, cancelable: true, pointerType: "touch" });
  box.dispatchEvent(ev("pointerdown", x, y)); box.dispatchEvent(ev("pointermove", x + dx, y + dy)); box.dispatchEvent(ev("pointerup", x + dx, y + dy));
}
function dbl(box) {
  var b = box.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2 - 40;
  var ev = t => new w.PointerEvent(t, { clientX: x, clientY: y, pointerId: 8, bubbles: true, cancelable: true, pointerType: "touch" });
  for (var i = 0; i < 2; i++) { box.dispatchEvent(ev("pointerdown")); box.dispatchEvent(ev("pointerup")); }
}
var zoomBtn = (box, s) => q("#" + box.id + ' [data-zoom="' + s + '"]').click();
function box4(u) { var v = (param(u, "viewbox") || "").split(",").map(Number); return { 左: v[0], 上: v[1], 右: v[2], 下: v[3] }; }
var legal = b => [b.左, b.右].every(x => x >= -180 && x <= 180) && [b.上, b.下].every(y => y >= -90 && y <= 90) && b.左 < b.右 && b.下 < b.上;
return (async function () {
  await wait(300);
  var out = { 寬: w.innerWidth }, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };

  /* 1 行程地圖 */
  var mm = q("#map");
  if (mm && mm._v) {
    for (var i = 0; i < 25; i++) zoomBtn(mm, -1);
    out.行程縮到底 = tiles(mm);
    ok("行程地圖縮得到 0,圖磚全合法、不重複(世界只畫一份)", out.行程縮到底.z === 0 && !out.行程縮到底.不合法.length && !out.行程縮到底.重複 && out.行程縮到底.張數 === 1, out.行程縮到底);
    drag(mm, 60, 30);
    out.行程0拖 = { 中心: [mm._v.cx, mm._v.cy], 圖磚: tiles(mm) };
    ok("0 級拖了也不會把世界拖走(還是置中)", mm._v.cx === 0.5 && mm._v.cy === 0.5 && !out.行程0拖.圖磚.不合法.length, out.行程0拖);
    for (var i = 0; i < 25; i++) zoomBtn(mm, 1);
    out.行程放到底 = tiles(mm);
    ok("行程地圖放得到 19,圖磚全合法", out.行程放到底.z === 19 && !out.行程放到底.不合法.length && out.行程放到底.張數 > 0, out.行程放到底);
    dbl(mm);
    ok("19 級雙擊不會超過 19", mm._v.z === 19, mm._v.z);
  } else out.行程地圖 = "這個寬度沒有畫(略過)";

  /* 2 全螢幕搜尋地圖 */
  q("#tab-wish").click(); await wait(80);
  q("#add-wish-btn").click(); await wait(150);
  q("#wf-title").value = "拉麵"; q('[data-seek="wf-title"]').click();
  await until(() => q("#ss-q-out .hcard"));
  var sm = q("#ss-map");
  for (var i = 0; i < 25; i++) zoomBtn(sm, -1);
  out.搜尋0 = tiles(sm);
  out.搜尋0.點偏 = pinOff(sm, "h0", 139.78, 35.70);
  ok("搜尋地圖縮得到 0,圖磚合法、只一份;點的位置對", out.搜尋0.z === 0 && !out.搜尋0.不合法.length && !out.搜尋0.重複 && out.搜尋0.點偏 !== null && out.搜尋0.點偏 <= 2, out.搜尋0);
  ok("縮小之後搜尋鈕變「重新搜這個範圍」", /重新搜這個範圍/.test(q('[data-seek="ss-q"]').textContent), q('[data-seek="ss-q"]').textContent);
  var n0 = asked.length;
  q('[data-seek="ss-q"]').click();
  await until(() => asked.length > n0);
  out.全世界範圍 = box4(asked[asked.length - 1]);
  /* 縮到全世界按「重新搜這個範圍」就是搜全世界(2026-10-30 Lulu),結果拉進畫面 */
  ok("0 級重新搜:viewbox 是整個世界(-180..180)、合法、bounded=1", legal(out.全世界範圍) && out.全世界範圍.左 === -180 && out.全世界範圍.右 === 180 &&
    param(asked[asked.length - 1], "bounded") === "1", out.全世界範圍);
  await until(() => sm._v.z > 5); await wait(300);
  out.拉進來 = { z: sm._v.z, 點偏: pinOff(sm, "h0", 139.78, 35.70) };
  ok("0 級搜到的結果:畫面拉到框得住結果", out.拉進來.z > 5 && out.拉進來.點偏 <= 2, out.拉進來);
  for (var i = 0; i < 25; i++) zoomBtn(sm, -1);
  dbl(sm); await wait(50);
  ok("0 級雙擊放大到 1", sm._v.z === 1, sm._v.z);

  /* 跨換日線:3 級、畫面中心放在 179°E 附近,往右拖過去 */
  for (var i = 0; i < 2; i++) zoomBtn(sm, 1);
  for (; sm._v.z > 3;) zoomBtn(sm, -1);
  sm._v.cx = projX(179, sm._v.z); sm._v.cy = projY(35.7, sm._v.z);
  drag(sm, -20, 0);
  out.換日線 = tiles(sm);
  out.換日線.中心經度 = +(sm._v.cx / Math.pow(2, sm._v.z) * 360 - 180).toFixed(2);
  out.換日線.點偏 = pinOff(sm, "h0", 139.78, 35.70);
  ok("跨換日線:圖磚合法(左右接起來)、中心收回 0..n、點的位置對",
    sm._v.z === 3 && !out.換日線.不合法.length && sm._v.cx >= 0 && sm._v.cx < 8 && out.換日線.點偏 <= 2, out.換日線);
  n0 = asked.length;
  q('[data-seek="ss-q"]').click();
  await until(() => asked.length > n0);
  out.換日線範圍 = box4(asked[asked.length - 1]);
  ok("跨換日線重新搜:viewbox 合法、左 < 右(只送佔比較多的那一邊)", legal(out.換日線範圍) && (out.換日線範圍.左 === -180 || out.換日線範圍.右 === 180), out.換日線範圍);
  await wait(300);

  /* 放到 19 */
  for (var i = 0; i < 25; i++) zoomBtn(sm, 1);
  sm._v.cx = projX(139.784, 19); sm._v.cy = projY(35.704, 19);
  drag(sm, 10, 10);
  out.搜尋19 = tiles(sm);
  out.搜尋19.點偏 = pinOff(sm, "h1", 139.784, 35.704);
  ok("搜尋地圖放得到 19,再按 + 還是 19,圖磚合法,點的位置對", sm._v.z === 19 && !out.搜尋19.不合法.length && out.搜尋19.點偏 !== null && out.搜尋19.點偏 <= 2, out.搜尋19);
  n0 = asked.length;
  q('[data-seek="ss-q"]').click();
  await until(() => asked.length > n0);
  out.街區範圍 = box4(asked[asked.length - 1]);
  ok("19 級重新搜:viewbox 合法、很小(< 0.01 度)", legal(out.街區範圍) && out.街區範圍.右 - out.街區範圍.左 < 0.01, out.街區範圍);

  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
