/* 全螢幕地圖搜尋(2026-10-29,Lulu)。Nominatim 假造,其餘(Wikidata、Commons)回空的。
 *   WIDTH=390 ./probe.sh probes/map-search.js
 *   WIDTH=1440 ./probe.sh probes/map-search.js
 * 看:按搜尋 → 全螢幕(搜尋框＋✕、撐滿的地圖、下面卡片),只搜畫面範圍(viewbox＋bounded=1);
 *     結果全部標在地圖上、編號跟卡片一樣;點卡片/點點 = 選起來(兩邊一起亮),「選這個」才帶回去;
 *     縮放後卡片只列畫面裡的、按鈕變「重新搜這個範圍」(不自動搜);第一次搜 = 城市;0 筆只給下一步那一顆
 *     (「搜整個城市」→「往外找」→ 找不到);「往外找」不限國家;
 *     ✕ = 不選地點、打的字留著;Esc 照對話框的關閉規則。 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = e => (e && e.textContent || "").replace(/\s+/g, " ").trim();
var real = w.fetch, asked = [], reply = null;
var HITS = [];
for (var n = 0; n < 12; n++) HITS.push({ lat: String(35.700 + (n % 4) * 0.004), lon: String(139.780 + Math.floor(n / 4) * 0.006),
  class: "amenity", type: "restaurant", display_name: "拉麵" + (n + 1) + "號, 台東區, 東京都, 日本", extratags: { cuisine: "ramen" } });
HITS.push({ lat: "x", lon: "y", class: "shop", type: "convenience", display_name: "壞座標, 台東區, 東京都, 日本", extratags: {} });
w.fetch = function (u, init) {
  var s = String(u);
  if (s.indexOf("nominatim") >= 0) { asked.push(s); return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(reply || HITS))) }); }
  if (s.indexOf("wikidata.org") >= 0 || s.indexOf("commons.wikimedia.org/w/api.php") >= 0) return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  return real(u, init);
};
var TILE = 256, out0 = null, CV = "139.150,36.126,140.150,35.226";   /* 東京的 cityView() */
var projX = (lo, z) => (lo + 180) / 360 * Math.pow(2, z);
var projY = (la, z) => { var r = la * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z); };
var param = (u, k) => { var m = String(u).match(new RegExp("[?&]" + k + "=([^&]*)")); return m ? decodeURIComponent(m[1]) : null; };
var shown = id => !q("#" + id).hidden;
var esc = () => d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
var tapPin = k => {
  var p = q('#ss-map .pin[data-k="' + k + '"]'), b = p.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
  var ev = t => new w.PointerEvent(t, { clientX: x, clientY: y, pointerId: 3, bubbles: true, cancelable: true, pointerType: "touch" });
  p.dispatchEvent(ev("pointerdown")); q("#ss-map").dispatchEvent(ev("pointerup"));
};
/* 畫面裡看得到的那一塊(px):地圖扣掉搜尋框和卡片 */
function visRect() {
  var m = q("#ss-map").getBoundingClientRect(), bar = q("#ss-bar").getBoundingClientRect(), out = q("#ss-q-out");
  return { top: bar.bottom, bottom: out.hidden ? m.bottom : out.getBoundingClientRect().top, left: m.left, right: m.right };
}
function pinIn(k) {
  var p = q('#ss-map .pin[data-k="' + k + '"]'); if (!p) return false;
  var b = p.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, v = visRect();
  return x >= v.left && x <= v.right && y >= v.top && y <= v.bottom;
}
async function until(f, n) { for (var i = 0; i < (n || 60); i++) { if (f()) return true; await wait(50); } return false; }
/* 無頭瀏覽器不跑平滑捲動:換成直接捲過去 */
var rawTo = w.Element.prototype.scrollTo;
w.Element.prototype.scrollTo = function (o) { return rawTo.call(this, o && typeof o === "object" ? { left: o.left, top: o.top } : o); };
return (async function () {
  await wait(300);
  var mm = q("#map"), mv = mm && mm._v;
  out0 = { 主地圖: mv ? { z: mv.z, 寬: mm.clientWidth, 高: mm.clientHeight } : null };
  var out = { 寬: w.innerWidth, 開場: out0 }, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  q("#tab-wish").click(); await wait(80);
  q("#add-wish-btn").click(); await wait(150);
  var mv0 = q("#map")._v, mainW = mv0 ? w.innerWidth / TILE / Math.pow(2, mv0.z) * 360 : null;
  q("#wf-title").value = "麵屋"; q('[data-seek="wf-title"]').click();
  await until(() => q("#ss-q-out .hcard"));

  /* 1 進來了 */
  var scr = q("#seek-screen"), sr = scr.getBoundingClientRect(), mr = q("#ss-map").getBoundingClientRect();
  out.進來 = { 開: shown("seek-screen"), 對話框還在: shown("wish-add-overlay"), 字: q("#ss-q").value, 撐滿: [Math.round(mr.width), Math.round(mr.height), w.innerWidth, w.innerHeight],
    最上面: d.elementFromPoint(w.innerWidth / 2, Math.round(visRect().top + 40)).closest("#ss-map") ? "地圖" : "別的" };
  ok("按搜尋 → 全螢幕(地圖撐滿)、字帶過來、原本對話框留著", out.進來.開 && out.進來.對話框還在 && out.進來.字 === "麵屋" &&
    Math.round(mr.width) === w.innerWidth && Math.round(mr.height) === w.innerHeight && out.進來.最上面 === "地圖", out.進來);
  var u0 = asked[asked.length - 1];
  out.第一次查 = { bounded: param(u0, "bounded"), viewbox: param(u0, "viewbox"), countrycodes: param(u0, "countrycodes") };
  var vb = (out.第一次查.viewbox || "").split(",").map(Number);
  /* 2026-10-30:沒動過地圖按「搜尋」= 搜這一團的城市(假資料的城市是東京) */
  ok("第一次搜 = 城市框＋bounded=1", out.第一次查.bounded === "1" && out.第一次查.viewbox === CV, out.第一次查);

  /* 1b 搜完畫面自動框住全部結果(2026-10-30):全部在看得到的那一塊裡、再放大一級就塞不下(或到 16 級上限);按鈕還是「搜尋」 */
  function fitted() {
    var ps = qa("#ss-map .pin.hit").length ? qa("#ss-map .pin.hit") : qa('#ss-map .pin[data-k^="h"]');
    var rs = ps.map(p => p.getBoundingClientRect()), v = visRect(), z = q("#ss-map")._v.z;
    var xs = rs.map(r => r.left + r.width / 2), ys = rs.map(r => r.top + r.height / 2);
    var sw = Math.max.apply(null, xs) - Math.min.apply(null, xs), sh = Math.max.apply(null, ys) - Math.min.apply(null, ys);
    return { z: z, 點數: ps.length, 全在: ps.every(p => pinIn(p.dataset.k)),
      再放大塞不下: z >= 16 || sw * 2 > (v.right - v.left) - 40 || sh * 2 > (v.bottom - v.top) - 40, 按鈕: txt(q('[data-seek="ss-q"]')) };
  }
  out.框住 = fitted();
  ok("搜完畫面框住全部結果(最大縮放),按鈕還是「搜尋」", out.框住.點數 === 12 && out.框住.全在 && out.框住.再放大塞不下 && out.框住.按鈕 === "搜尋", out.框住);

  /* 2 點全部標上去,編號跟卡片一樣 */
  var pins = qa("#ss-map .pin");
  out.點 = { 數: pins.length, 編號: pins.map(p => txt(p).replace(/\D.*$/, "")).slice(0, 4), 卡片編號: qa("#ss-q-out .hn").slice(0, 4).map(txt) };
  ok("12 個有座標的都標上去(壞座標不標)、編號 1 起跳跟卡片一樣", out.點.數 === 12 && out.點.編號.join() === "1,2,3,4" && out.點.卡片編號.join() === "1,2,3,4", out.點);
  ok("地圖上看不到別的行程/願望的點", qa("#ss-map .pin").every(p => /^h\d+$/.test(p.dataset.k)), qa("#ss-map .pin").map(p => p.dataset.k));
  ok("沒選之前看不到「選這個」", qa("#ss-q-out .htake").every(b => b.offsetParent === null), null);

  /* 2b「全部已排」(2026-10-29):預設關著;開了六天已排的點畫上去(那天的顏色、第幾天),卡片不變;點它不會選;再按收掉 */
  var chip = q("#ss-all"), nHit = qa("#ss-map .pin").length, nCard = qa("#ss-q-out .hcard").length;
  out.全部已排 = { 預設: chip && chip.getAttribute("aria-pressed") };
  chip.click(); await wait(80);
  var plan = qa("#ss-map .pin.plan");
  out.全部已排.開 = { 點: plan.length, 搜到的點: qa("#ss-map .pin:not(.plan)").length, 卡片: qa("#ss-q-out .hcard").length,
    有顏色: plan.every(p => !!p.style.background), 編號是第幾天: plan.every(p => /^[1-9]$/.test(txt(p).replace(/\D.*$/, ""))), 按著: chip.getAttribute("aria-pressed") };
  var pv = plan.filter(p => pinIn(p.dataset.k))[0];
  if (pv) { tapPin(pv.dataset.k); await wait(80); }
  out.全部已排.點了 = { 卡片亮: qa("#ss-q-out .hcard.on").length, 那顆亮: pv ? q('#ss-map .pin[data-k="' + pv.dataset.k + '"]').classList.contains("on") : null, 還開著: shown("seek-screen") };
  chip.click(); await wait(80);
  out.全部已排.關 = qa("#ss-map .pin.plan").length;
  ok("「全部已排」預設關;開了畫出已排的點(那天的顏色、第幾天),搜到的點和卡片不變;點它不選卡片;再按收掉",
    out.全部已排.預設 === "false" && out.全部已排.開.點 > 3 && out.全部已排.開.搜到的點 === nHit && out.全部已排.開.卡片 === nCard &&
    out.全部已排.開.有顏色 && out.全部已排.開.編號是第幾天 && out.全部已排.開.按著 === "true" &&
    (!pv || (out.全部已排.點了.卡片亮 === 0 && out.全部已排.點了.那顆亮 && out.全部已排.點了.還開著)) && out.全部已排.關 === 0, out.全部已排);
  delete q("#seek-screen").dataset.picked;   /* 上面點了已排的點不算改過,保險起見清掉,後面的 Esc 測試才準 */

  /* 3 點卡片 = 選起來、地圖移過去,對話框不關 */
  q('#ss-q-out [data-hit="ss-q"][data-i="5"]').click(); await wait(80);
  var on = qa("#ss-q-out .hcard.on");
  out.點卡片 = { 亮的卡: on.map(c => c.querySelector("[data-i]").dataset.i), 亮的點: qa("#ss-map .pin.on").map(p => p.dataset.k), 點在畫面裡: pinIn("h5"),
    選這個: on[0] && on[0].querySelector(".htake").offsetParent !== null, 還開著: shown("seek-screen"), 名字: txt(q("#ss-map .pin.on .lab")) };
  ok("點卡片:那張和第 6 個點一起亮、地圖移到那裡(在看得到的範圍)、出現「選這個」、還沒帶回去", out.點卡片.亮的卡.join() === "5" && out.點卡片.亮的點.join() === "h5" &&
    out.點卡片.點在畫面裡 && out.點卡片.選這個 && out.點卡片.還開著 && out.點卡片.名字 === "拉麵6號", out.點卡片);

  /* 4 點地圖上的點 = 選起來、清單捲到那張 */
  var target = qa("#ss-map .pin").map(p => p.dataset.k).filter(k => k !== "h5" && pinIn(k)).pop();
  tapPin(target); await wait(600);
  var ti = target.slice(1), tc = q('#ss-q-out [data-hit="ss-q"][data-i="' + ti + '"]'), lr = q("#ss-q-out .hits").getBoundingClientRect(), cr = tc && tc.getBoundingClientRect();
  out.點點 = { 點: target, 亮的卡: qa("#ss-q-out .hcard.on").map(c => c.querySelector("[data-i]").dataset.i), 卡在清單看得到: !!cr && cr.left >= lr.left - 1 && cr.left < lr.right - 40, 沒開新頁: shown("seek-screen") };
  ok("點地圖上的點:對應那張亮起來、清單捲到它、不開 Google 地圖", out.點點.亮的卡.join() === ti && out.點點.卡在清單看得到 && out.點點.沒開新頁, out.點點);

  /* 5 選了之後 Esc 關不掉,講要按哪裡 */
  esc(); await wait(60);
  var hint = q("#seek-screen .ov-hint");
  out.Esc改過 = { 還開著: shown("seek-screen"), 提示: hint && !hint.hidden ? txt(hint) : "" };
  ok("選起來之後 Esc 關不掉、講「選這個」或 ✕", out.Esc改過.還開著 && /選這個/.test(out.Esc改過.提示) && /✕/.test(out.Esc改過.提示), out.Esc改過);

  /* 6 放大:卡片只列畫面裡的、按鈕變「重新搜這個範圍」、不自動搜 */
  var nAsk = asked.length, before = qa("#ss-q-out .hcard").length;
  q('#ss-map [data-zoom="1"]').click(); await wait(80);
  q('#ss-map [data-zoom="1"]').click(); await wait(120);
  var inView = qa("#ss-map .pin").filter(p => pinIn(p.dataset.k)).map(p => p.dataset.k.slice(1)).sort().join();
  var cards = qa("#ss-q-out .hit").map(b => b.dataset.i).sort().join();
  out.放大 = { 前: before, 後: qa("#ss-q-out .hcard").length, 畫面裡的點: inView, 卡片: cards, 按鈕: txt(q('[data-seek="ss-q"]')), 有自動搜: asked.length !== nAsk,
    沒有的提示: q("#ss-q-out .ss-none") && !q("#ss-q-out .ss-none").hidden };
  ok("放大後卡片 = 畫面裡看得到的那幾個點(變少)、按鈕「重新搜這個範圍」、沒有自動搜", out.放大.後 < out.放大.前 && (cards === inView || (!inView && out.放大.沒有的提示)) &&
    out.放大.按鈕 === "重新搜這個範圍" && !out.放大.有自動搜, out.放大);

  /* 7 拖一下:同樣只篩不搜 */
  var m = q("#ss-map"), b = m.getBoundingClientRect(), cx = b.left + b.width / 2, cy = visRect().top + 80;
  var pe = (t, x, y) => new w.PointerEvent(t, { clientX: x, clientY: y, pointerId: 9, bubbles: true, cancelable: true, pointerType: "touch" });
  m.dispatchEvent(pe("pointerdown", cx, cy)); m.dispatchEvent(pe("pointermove", cx - 120, cy)); m.dispatchEvent(pe("pointerup", cx - 120, cy)); await wait(120);
  inView = qa("#ss-map .pin").filter(p => pinIn(p.dataset.k)).map(p => p.dataset.k.slice(1)).sort().join();
  cards = qa("#ss-q-out .hit").map(b => b.dataset.i).sort().join();
  out.拖 = { 畫面裡的點: inView, 卡片: cards, 有自動搜: asked.length !== nAsk };
  ok("拖動後卡片跟著畫面、沒有自動搜", (cards === inView || (!inView && !q("#ss-q-out .ss-none").hidden)) && !out.拖.有自動搜, out.拖);

  /* 8 按「重新搜這個範圍」:用現在的畫面查(搜完畫面會自己框住結果,所以畫面左邊在按之前量) */
  var z = m._v.z, lonL = (m._v.cx - b.width / 2 / TILE) / Math.pow(2, z) * 360 - 180;
  q('[data-seek="ss-q"]').click();
  await until(() => asked.length > nAsk); await wait(150);
  var u1 = asked[asked.length - 1], vb1 = param(u1, "viewbox").split(",").map(Number), v = visRect();
  out.重搜 = { bounded: param(u1, "bounded"), viewbox左: vb1[0].toFixed(4), 畫面左: lonL.toFixed(4), 比上次小: Math.abs(vb1[2] - vb1[0]) < Math.abs(vb[2] - vb[0]), 按鈕: txt(q('[data-seek="ss-q"]')) };
  ok("重搜用現在的畫面(bounded=1、viewbox 左邊 = 畫面左邊、比城市小),按鈕回到「搜尋」", out.重搜.bounded === "1" && out.重搜.viewbox左 === out.重搜.畫面左 && out.重搜.比上次小 && out.重搜.按鈕 === "搜尋", out.重搜);

  /* 9 動過地圖、畫面比城市小、0 筆 →「這個範圍找不到」＋只有「搜整個城市」;畫面不動;不自動往外 */
  var btns = () => qa("#ss-q-out [data-city], #ss-q-out [data-wide]").map(txt);   /* 「強力搜」是三段式提示那一顆,不算 */
  q('#ss-map [data-zoom="1"]').click(); await wait(80);
  var v9 = JSON.stringify(q("#ss-map")._v);
  reply = []; q("#ss-q").value = "泡溫泉"; nAsk = asked.length; q('[data-seek="ss-q"]').click();
  await until(() => /這個範圍找不到/.test(txt(q("#ss-q-out")))); await wait(1300);
  var u9 = asked[nAsk];
  ok("0 筆畫面不動", JSON.stringify(q("#ss-map")._v) === v9, [v9, q("#ss-map")._v]);
  out.零筆 = { 字: txt(q("#ss-q-out .said")), 鈕: btns(), 點: qa("#ss-map .pin").length, 查了幾次: asked.length - nAsk, 範圍: param(u9, "viewbox") };
  ok("畫面裡 0 筆:講「這個範圍找不到」、只有「搜整個城市」、點清掉、查兩次(泡溫泉＋泡温泉,都是畫面範圍)", /這個範圍找不到「泡溫泉」/.test(out.零筆.字) && out.零筆.鈕.join() === "搜整個城市" &&
    out.零筆.點 === 0 && out.零筆.查了幾次 === 2 && out.零筆.範圍 !== CV, out.零筆);

  /* 9b「搜整個城市」:城市框、bounded=1,城市外的地名也一樣;0 筆 →「這個城市找不到」＋只有「往外找」 */
  q("#ss-q").value = "京都車站"; nAsk = asked.length;
  q("#ss-q-out [data-city]").click();
  await until(() => /這個城市找不到/.test(txt(q("#ss-q-out")))); await wait(1300);
  var u3 = asked[nAsk];
  out.城市外 = { 字: txt(q("#ss-q-out .said")), 鈕: btns(), 查了幾次: asked.length - nAsk, bounded: param(u3, "bounded"), viewbox: param(u3, "viewbox") };
  ok("「搜整個城市」0 筆:查三次(京都車站＋京都駅＋京都站,城市框、bounded=1),講「這個城市找不到」、只剩「往外找」",
    out.城市外.查了幾次 === 3 && out.城市外.bounded === "1" && out.城市外.viewbox === CV && /這個城市找不到「京都車站」/.test(out.城市外.字) && out.城市外.鈕.join() === "往外找", out.城市外);

  /* 9c「往外找」:不帶 bounded、countrycodes,城市框當加權;結果框進畫面 */
  var KYOTO = [{ lat: "34.98580", lon: "135.75880", class: "railway", type: "station", display_name: "京都車站, 下京區, 京都市, 日本", extratags: {} },
               { lat: "34.98700", lon: "135.75950", class: "railway", type: "station", display_name: "京都車站八條口, 下京區, 京都市, 日本", extratags: {} }];
  reply = KYOTO; nAsk = asked.length;
  q("#ss-q-out [data-wide]").click();
  await until(() => q("#ss-q-out .hcard")); await wait(150);
  var u4 = asked[nAsk];
  out.往外找 = { bounded: param(u4, "bounded"), countrycodes: param(u4, "countrycodes"), viewbox: param(u4, "viewbox"), 卡片: qa("#ss-q-out .hcard").length,
    全在畫面裡: qa("#ss-map .pin").every(p => pinIn(p.dataset.k)), 按鈕: txt(q('[data-seek="ss-q"]')) };
  ok("「往外找」:不帶 bounded、countrycodes,viewbox = 城市框(加權);京都的結果框進畫面、按鈕還是「搜尋」", out.往外找.bounded === null && out.往外找.countrycodes === null &&
    out.往外找.viewbox === CV && out.往外找.卡片 === 2 && out.往外找.全在畫面裡 && out.往外找.按鈕 === "搜尋", out.往外找);

  /* 9d 往外找也 0 筆 →「找不到」,沒有按鈕 */
  reply = []; q("#ss-q").value = "不存在的地方"; q('[data-seek="ss-q"]').click();
  await until(() => q("#ss-q-out [data-wide]")); await wait(1300);
  q("#ss-q-out [data-wide]").click();
  await until(() => /「不存在的地方」找不到/.test(txt(q("#ss-q-out")))); await wait(100);
  out.都沒有 = { 字: txt(q("#ss-q-out .said")), 鈕: btns() };
  ok("往外找也 0 筆:「「X」找不到。」、沒有按鈕", /「不存在的地方」找不到/.test(out.都沒有.字) && !out.都沒有.鈕.length, out.都沒有);

  /* 9e 縮到畫面蓋住整個城市、0 筆 →「這個範圍找不到」＋只有「往外找」 */
  var sv = q("#ss-map")._v; sv.cx = projX(139.6503, sv.z); sv.cy = projY(35.6762, sv.z);   /* 上一步框到京都了,拉回東京 */
  for (var zz = 0; zz < 8; zz++) q('#ss-map [data-zoom="-1"]').click();
  await wait(1300);
  nAsk = asked.length; q('[data-seek="ss-q"]').click();
  await until(() => asked.length > nAsk && /這個範圍找不到/.test(txt(q("#ss-q-out")))); await wait(100);
  out.蓋住城市 = { z: q("#ss-map")._v.z, 字: txt(q("#ss-q-out .said")), 鈕: btns() };
  ok("畫面已經蓋住整個城市、0 筆:「這個範圍找不到」、只有「往外找」", /這個範圍找不到/.test(out.蓋住城市.字) && out.蓋住城市.鈕.join() === "往外找", out.蓋住城市);

  /* 9f 一筆都不刪,只排順序(2026-10-31):完全符合 → 同義寫法 → 其他 → 同音異字;同義詞多查兩次;同音的也框進地圖 */
  await wait(1300);
  var sv2 = q("#ss-map")._v; sv2.cx = projX(139.6503, sv2.z); sv2.cy = projY(35.6762, sv2.z);
  delete q("#seek-screen").dataset.picked;
  var P = (name, nd, lat, lon) => ({ lat: lat || "35.70", lon: lon || "139.78", class: "amenity", type: "bar", name: name, display_name: name + ", 東京都, 日本", extratags: {}, namedetails: nd || { name: name } });
  var names = () => qa("#ss-q-out .hcard b").map(txt);
  reply = [P("常各庄村", 0, "39.2", "118.9")];
  q("#ss-q").value = "唱歌"; q("#ss-x").click(); await wait(80);
  nAsk = asked.length;
  q('[data-seek="wf-title"]').click(); await until(() => q("#ss-q-out .hcard")); await wait(200);
  out.只有同音 = { 卡片: names(), 點: qa("#ss-map .pin").length, 查了: asked.slice(nAsk).map(u => param(u, "q")) };
  ok("搜「唱歌」只回「常各庄村」→ 照樣列出來(不刪),而且「カラオケ」「卡拉OK」也查了", out.只有同音.卡片.join() === "常各庄村" && out.只有同音.點 === 1 &&
     out.只有同音.查了.join() === "唱歌,カラオケ,卡拉OK", out.只有同音);
  await wait(1300);
  reply = [P("常各庄村", 0, "39.2", "118.9"), P("葛飾区立常盤中学校"), P("Big Echo", { name: "ビッグエコー", "name:en": "Big Echo" }), P("カラオケ館"), P("唱歌教室")];
  q("#ss-q").value = "唱歌"; q('[data-seek="ss-q"]').click();
  await until(() => qa("#ss-q-out .hcard").length === 5); await wait(1300);
  out.唱歌 = { 卡片: names(), 點: qa("#ss-map .pin").length, z: q("#ss-map")._v.z };
  ok("搜「唱歌」排序:唱歌教室(完全)→ カラオケ館(同義)→ Big Echo(其他)→ 常各庄村、葛飾…(同音,照原順序)",
     out.唱歌.卡片.join() === "唱歌教室,カラオケ館,Big Echo,常各庄村,葛飾区立常盤中学校", out.唱歌);
  ok("同音的也框進地圖(中國那一點也看得到 → 縮得很遠)", out.唱歌.點 === 5 && out.唱歌.z <= 6, out.唱歌);
  await wait(1300);
  reply = [P("一蘭 渋谷店"), P("東京駅", { name: "東京駅", "name:en": "Tokyo Station" }, "35.681", "139.767"), P("東京車站大飯店")];
  nAsk = asked.length;
  q("#ss-q").value = "東京車站"; q('[data-seek="ss-q"]').click();
  await until(() => qa("#ss-q-out .hcard").length === 3); await wait(100);
  out.東京車站 = { 卡片: names(), 查了: asked.slice(nAsk).map(u => param(u, "q")) };
  ok("搜「東京車站」:也查「東京駅」「東京站」;東京車站大飯店 → 東京駅 → 一蘭(重複的只算一次)",
     out.東京車站.卡片.join() === "東京車站大飯店,東京駅,一蘭 渋谷店" && out.東京車站.查了.join() === "東京車站,東京駅,東京站", out.東京車站);
  await wait(1300);
  reply = [P("Shinjuku", { name: "Shinjuku", "name:zh-Hant": "新宿站" }), P("浅草寺", 0, "35.7148", "139.7967")];
  q("#ss-q").value = "淺草"; q('[data-seek="ss-q"]').click();
  await until(() => qa("#ss-q-out .hcard").length === 2); await wait(100);
  out.淺草 = names();
  ok("搜「淺草」:日文寫法的浅草寺排第一(完全符合),新宿留著排後面", out.淺草.join() === "浅草寺,Shinjuku", out.淺草);

  await wait(1300);
  reply = HITS; q("#ss-q").value = "麵屋"; q('[data-seek="ss-q"]').click();
  await until(() => q("#ss-q-out .hcard")); await wait(100);

  /* 10 選這個 → 回到對話框、地點填好 */
  q('#ss-q-out [data-hit="ss-q"][data-i="2"]').click(); await wait(50);
  q('#ss-q-out .hcard.on .htake').click(); await wait(100);
  var pin = JSON.parse(w.localStorage.getItem("tokyo5-pin3") || "{}")["拉麵3號"];
  out.選這個 = { 關了: !shown("seek-screen"), 對話框: shown("wish-add-overlay"), 欄: q("#wf-title").value, 狀態: txt(q("#wf-title-out")), 座標: pin && [pin.la, pin.lo, pin.by] };
  ok("「選這個」:回到對話框、地點欄 = 名字、✓ 已標定、座標記下", out.選這個.關了 && out.選這個.對話框 && out.選這個.欄 === "拉麵3號" && /已標定/.test(out.選這個.狀態) &&
    pin && pin.by === "pick" && Math.abs(pin.la - 35.708) < 1e-6, out.選這個);
  esc(); await wait(60);
  ok("挑過之後,對話框點外面/Esc 關不掉", shown("wish-add-overlay"), null);

  /* 11 ✕ = 不選地點,打的字留著 */
  q('[data-seek="wf-title"]').click(); await until(() => q("#ss-q-out .hcard"));
  q("#ss-q").value = "泡溫泉";
  q("#ss-x").click(); await wait(80);
  out.叉 = { 關了: !shown("seek-screen"), 欄: q("#wf-title").value, 沒標定: !/已標定/.test(txt(q("#wf-title-out"))) };
  ok("✕:回到對話框、地點欄留「泡溫泉」、沒有標定", out.叉.關了 && out.叉.欄 === "泡溫泉" && out.叉.沒標定, out.叉);

  /* 12 沒改過 Esc 就關(只關搜尋畫面,對話框還在) */
  q('[data-seek="wf-title"]').click(); await until(() => q("#ss-q-out .hcard"));
  esc(); await wait(60);
  out.Esc沒改 = { 搜尋關了: !shown("seek-screen"), 對話框還在: shown("wish-add-overlay") };
  ok("沒改過:Esc 只關搜尋畫面", out.Esc沒改.搜尋關了 && out.Esc沒改.對話框還在, out.Esc沒改);

  /* 13 縮放鈕、OSM 標示沒被搜尋框或卡片蓋住 */
  q('[data-seek="wf-title"]').click(); await until(() => q("#ss-q-out .hcard"));
  var hitAt = e => { var r = e.getBoundingClientRect(), t = d.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t && (t === e || e.contains(t)); };
  out.蓋住 = { 放大鈕: hitAt(q('#ss-map [data-zoom="1"]')), 標示: hitAt(q("#ss-map .attr a")), 搜尋框: hitAt(q("#ss-q")), 叉: hitAt(q("#ss-x")), 全部已排: hitAt(q("#ss-all")) };
  ok("縮放鈕、OpenStreetMap 標示、搜尋框、✕、全部已排都點得到", out.蓋住.放大鈕 && out.蓋住.標示 && out.蓋住.搜尋框 && out.蓋住.叉 && out.蓋住.全部已排, out.蓋住);
  var fs = parseFloat(getComputedStyle(q("#ss-q")).fontSize);
  ok("搜尋框字 ≥16px(iPhone 點下去才不會自己放大)", fs >= 16, fs);
  q("#ss-x").click(); await wait(50);
  q("#wf-cancel").click();

  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過";
  out.errors = w.__errors || [];
  return out;
})();
