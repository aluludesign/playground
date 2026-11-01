/* 搜尋提示(2026-11-02,Lulu):全螢幕搜尋框邊打字邊出提示。
 *   WIDTH=390 BUDGET=60000 ./probe.sh probes/search-hints.js
 *   WIDTH=1440 BUDGET=60000 ./probe.sh probes/search-hints.js
 * 看:提示只用 App 自己的資料(全站地點 resource=hints、這支手機搜過的字、相似詞),打字時不連網;
 *     最多 8 筆、名字 → 同義 → 其他、同一層離城市近的先;地點有「國家・縣市・種類」那行小字;
 *     點地點 = 直接當一筆結果標上去、選起來,不查 Nominatim;點搜過的字 = 填進去照平常搜;
 *     Enter、搜尋、點外面、✕ 都收起來;選了提示的地點再存,帶著地點資訊;舊的地點同步時補(resource=geofill)。 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = e => (e && e.textContent || "").replace(/\s+/g, " ").trim();
var real = w.fetch, asked = [], hintsAsked = 0, fills = [], posts = [], typingNet = 0, typing = false;
var HINTS = [
  { n: "大阪駅", la: 34.7025, lo: 135.4959, c: "日本", s: "大阪府", k: "車站" },
  { n: "東京駅", la: 35.6812, lo: 139.7671, c: "日本", s: "東京都", k: "車站", ph: "https://commons.wikimedia.org/wiki/File:Tokyo_Station.jpg" },
  { n: "ラーメン山岡家", la: 43.0621, lo: 141.3544, c: "日本", s: "北海道", k: "拉麵店" },
  { n: "拉麵博物館", la: 35.5076, lo: 139.6176, c: "日本", s: "神奈川縣", k: "博物館" },
  { n: "港灣未來", la: 35.4570, lo: 139.6320, c: "日本", s: "神奈川縣", k: "地區" },
];
var HITS = [{ lat: "35.70", lon: "139.78", class: "amenity", type: "restaurant", display_name: "麵屋一燈, 葛飾區, 東京都, 日本", extratags: {} }];
w.fetch = function (u, init) {
  var s = String(u);
  if (typing) typingNet++;
  if (s.indexOf("nominatim") >= 0) { asked.push(s); return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(HITS))) }); }
  if (s.indexOf("wikidata.org") >= 0 || s.indexOf("commons.wikimedia.org/w/api.php") >= 0) return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  if (s.indexOf("resource=hints") >= 0) { hintsAsked++; return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: HINTS }) }); }
  if (s.indexOf("resource=geofill") >= 0) { fills.push(JSON.parse(init.body)); return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, done: 1 }) }); }
  if (s.indexOf("resource=wishes") >= 0 && init && init.method === "POST") posts.push(JSON.parse(init.body));
  /* 自己這一團的願望:一筆有地點資訊和附圖(PR #91 的 pics)—— 附圖一律不放進提示(2026-11-02,Lulu) */
  if (s.indexOf("resource=wishes") >= 0 && (!init || !init.method || init.method === "GET"))
    return real(u, init).then(r => r.json()).then(b => {
      b.rows.forEach(x => { if (x.id === "w3") { x.place = "箱根湯本"; x.geo = { la: 35.2329, lo: 139.1063, c: "日本", s: "神奈川縣", k: "溫泉" }; x.pics = ["https://example.invalid/own.jpg"]; } });
      return { ok: true, status: 200, json: () => Promise.resolve(b) };
    });
  return real(u, init);
};
var shown = id => !q("#" + id).hidden;
var type = async v => { typing = true; var i = q("#ss-q"); i.value = v; i.dispatchEvent(new w.Event("input", { bubbles: true })); await wait(30); typing = false; };
var items = () => qa("#ss-sug .sug").map(b => ({ 名: txt(b.querySelector("b")), 小: txt(b.querySelector("small")) }));
async function until(f, n) { for (var i = 0; i < (n || 60); i++) { if (f()) return true; await wait(50); } return false; }
var rawTo = w.Element.prototype.scrollTo;
w.Element.prototype.scrollTo = function (o) { return rawTo.call(this, o && typeof o === "object" ? { left: o.left, top: o.top } : o); };
return (async function () {
  await wait(300);
  var out = { 寬: w.innerWidth }, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  try { w.localStorage.removeItem("trippps-hints"); w.localStorage.setItem("trippps-ss-hist", JSON.stringify(["拉麵 新宿", "唱歌"])); } catch (_) {}
  q("#tab-wish").click(); await wait(80);
  q("#add-wish-btn").click(); await wait(150);
  q("#wf-title").value = "麵屋"; q('[data-seek="wf-title"]').click();
  await until(() => q("#ss-q-out .hcard"));
  await wait(100);

  /* 1 進來:抓一次全站清單;還沒打字不出提示;搜過的字記下來 */
  var hist = JSON.parse(w.localStorage.getItem("trippps-ss-hist") || "[]");
  out.進來 = { 抓清單: hintsAsked, 提示開著: shown("ss-sug"), 搜過: hist.slice(0, 3) };
  ok("進全螢幕搜尋抓一次全站清單、還沒打字不出提示、「麵屋」記進搜過的字", hintsAsked === 1 && !shown("ss-sug") && hist[0] === "麵屋", out.進來);

  /* 2 打「拉」:名字有「拉」的 → 同義(ラーメン)；搜過的、相似詞各最多 3;不連網 */
  var n0 = asked.length;
  await type("拉");
  out.拉 = items();
  var names = out.拉.map(x => x.名);
  ok("打「拉」就出提示、最多 8 筆、打字時沒有連網", shown("ss-sug") && out.拉.length > 0 && out.拉.length <= 8 && typingNet === 0 && asked.length === n0, { n: out.拉.length, typingNet: typingNet });
  ok("「拉」:搜過的「拉麵 新宿」、地點「拉麵博物館」、相似詞「拉麵」都在;同義的「ラーメン山岡家」排在名字有「拉」的後面",
     names.indexOf("拉麵 新宿") >= 0 && names.indexOf("拉麵博物館") >= 0 && names.indexOf("拉麵") >= 0 && names.indexOf("ラーメン") >= 0 &&
     names.indexOf("ラーメン山岡家") > names.indexOf("拉麵博物館"), out.拉);
  var mu = out.拉.filter(x => x.名 === "拉麵博物館")[0];
  ok("地點那一行小字 = 國家・縣市・種類;搜過的寫「搜過」、相似詞寫「相似的說法」",
     mu && mu.小 === "日本・神奈川縣・博物館" && out.拉.filter(x => x.名 === "拉麵 新宿")[0].小 === "搜過" && out.拉.filter(x => x.名 === "拉麵")[0].小 === "相似的說法", out.拉);
  /* 「拉」也是「卡拉OK」的一部分,所以同一組的「唱歌」算同義:排在名字有「拉」的那些後面 */
  ok("同義的(唱歌、ラーメン山岡家)排在名字有「拉」的(拉麵博物館、卡拉OK)後面",
     names.indexOf("唱歌") > names.indexOf("卡拉OK") && names.indexOf("唱歌") > names.indexOf("拉麵博物館"), names);

  /* 3 打「車站」:東京駅、大阪駅都靠同義出來,離這一團的城市(東京)近的先 */
  await type("車站");
  out.車站 = items().map(x => x.名);
  ok("「車站」:東京駅 排在 大阪駅 前面(同一層離城市近的先)", out.車站.indexOf("東京駅") >= 0 && out.車站.indexOf("東京駅") < out.車站.indexOf("大阪駅"), out.車站);
  await type("東京車站");
  out.東京車站 = items().map(x => x.名);
  ok("「東京車站」→ 東京駅(同義),大阪駅不出來", out.東京車站.indexOf("東京駅") >= 0 && out.東京車站.indexOf("大阪駅") < 0, out.東京車站);

  /* 3b 桌機對齊搜尋框,手機整排 */
  var sr = q("#ss-sug").getBoundingClientRect(), ir = q("#ss-bar .seek").getBoundingClientRect(), br = q("#ss-bar").getBoundingClientRect();
  out.位置 = { 左: Math.round(sr.left), 寬: Math.round(sr.width), 框左: Math.round(ir.left), 框寬: Math.round(ir.width), 上: Math.round(sr.top), 列底: Math.round(br.bottom) };
  ok("提示貼在搜尋列正下方;寬螢幕對齊搜尋框、窄螢幕整排", Math.abs(sr.top - br.bottom) <= 1 &&
     (w.innerWidth >= 600 ? Math.abs(sr.left - ir.left) <= 1 && Math.abs(sr.width - ir.width) <= 1 : Math.round(sr.width) === w.innerWidth), out.位置);

  /* 3c 縮圖:有公開照片 → 維基縮圖(lazy);沒有 → 種類圖示,不是空框 */
  await type("駅");
  var th = qa("#ss-sug .sug").map(b => ({ 名: txt(b.querySelector("b")), img: b.querySelector(".sth img") && b.querySelector(".sth img").getAttribute("src"),
    lazy: b.querySelector(".sth img") && b.querySelector(".sth img").getAttribute("loading"), 圖示: txt(b.querySelector(".sth .ph-icon")) }));
  out.縮圖 = th;
  var tk = th.filter(x => x.名 === "東京駅")[0], os = th.filter(x => x.名 === "大阪駅")[0];
  ok("東京駅 有維基縮圖(lazy)、大阪駅 沒照片放種類圖示 🚉", tk && /Special:FilePath\/Tokyo_Station\.jpg\?width=96/.test(tk.img) && tk.lazy === "lazy" &&
     os && !os.img && os.圖示 === "🚉", th);

  /* 4 點地點提示:不查 Nominatim,直接一張卡、一顆點、選起來 */
  n0 = asked.length;
  qa("#ss-sug .sug").filter(b => txt(b.querySelector("b")) === "東京駅")[0].click();
  await wait(200);
  var cards = qa("#ss-q-out .hcard");
  out.點地點 = { 收起來: !shown("ss-sug"), 字: q("#ss-q").value, 卡: cards.map(c => txt(c.querySelector(".txt"))), 選起來: cards.length && cards[0].classList.contains("on"),
    點: qa('#ss-map .pin[data-k^="h"]').length, 查了: asked.length - n0 };
  ok("點地點提示:收起來、字變東京駅、一張卡(東京駅・車站・東京都, 日本)、一顆點、選起來、沒有查 Nominatim",
     out.點地點.收起來 && out.點地點.字 === "東京駅" && cards.length === 1 && /東京駅/.test(out.點地點.卡[0]) && /車站/.test(out.點地點.卡[0]) &&
     /東京都/.test(out.點地點.卡[0]) && out.點地點.選起來 && out.點地點.點 === 1 && out.點地點.查了 === 0, out.點地點);

  /* 5 點外面收起來;點搜過的字 = 填進去照平常搜 */
  await type("拉");
  q("#ss-map").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await wait(50);
  out.點外面 = !shown("ss-sug");
  await type("唱");
  n0 = asked.length;
  qa("#ss-sug .sug").filter(b => txt(b.querySelector("b")) === "唱歌")[0].click();
  await until(() => asked.length > n0);
  out.點搜過 = { 收起來: !shown("ss-sug"), 字: q("#ss-q").value, 查了: asked.length - n0 };
  ok("點外面收起來", out.點外面, out.點外面);
  ok("點搜過的字:收起來、字填進去、照平常搜(查 Nominatim)", out.點搜過.收起來 && out.點搜過.字 === "唱歌" && out.點搜過.查了 >= 1, out.點搜過);
  await wait(4000);   /* 唱歌會多查同義詞,等它跑完 */

  /* 6 Enter 收起來;✕ 收起來 */
  await type("拉");
  q("#ss-bar").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await wait(50);
  out.Enter = !shown("ss-sug");
  ok("Enter 收起來", out.Enter, out.Enter);
  await wait(2500);

  /* 7 選提示的地點 → 選這個 → 存:帶著地點資訊 */
  await type("港灣");
  qa("#ss-sug .sug").filter(b => txt(b.querySelector("b")) === "港灣未來")[0].click();
  await wait(150);
  q("#ss-q-out [data-take]").click();
  await wait(150);
  out.選這個 = { 關了: !shown("seek-screen"), 欄: q("#wf-title").value };
  q("#wish-form").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await until(() => posts.length);
  var g = posts[0] && posts[0].geo;
  out.存 = { geo: g };
  ok("選了提示的地點再存:POST 帶 geo(座標、日本、神奈川縣、地區)", out.選這個.關了 && out.選這個.欄 === "港灣未來" && g &&
     g.la === 35.457 && g.lo === 139.632 && g.c === "日本" && g.s === "神奈川縣" && g.k === "地區", out);

  /* 8 舊的地點補:願望 w2(地點「港灣未來」,沒有地點資訊)—— 這支手機選過了 → 同步時送 geofill */
  w.dispatchEvent(new w.Event("focus"));
  await until(() => fills.length, 120);
  out.補 = fills;
  var row = fills[0] && fills[0].rows.filter(r => r.id === "w2")[0];
  ok("同步時補舊地點:geofill 送 w2 和它的地點資訊", row && row.geo && row.geo.s === "神奈川縣", fills);

  /* 8b 自己團的地點也在提示裡,但附圖不放:沒有公開照片 → 種類圖示 */
  q("#wf-title").value = "麵屋"; q('[data-seek="wf-title"]').click();
  await until(() => !q("#seek-screen").hidden);
  await type("箱根");
  var own = qa("#ss-sug .sug").filter(b => txt(b.querySelector("b")) === "箱根湯本")[0];
  out.附圖 = own && { img: !!own.querySelector(".sth img"), 圖示: txt(own.querySelector(".sth .ph-icon")), 小: txt(own.querySelector("small")) };
  ok("自己團的地點出現在提示裡,有附圖也不放,用種類圖示", out.附圖 && !out.附圖.img && out.附圖.圖示 === "🌳" && out.附圖.小 === "日本・神奈川縣・溫泉", out.附圖);
  q("#ss-x").click(); await wait(100);

  /* 9 ✕ 收起來 */
  q("#wf-title").value = "麵屋"; q('[data-seek="wf-title"]').click();
  await until(() => !shown("seek-screen") === false);
  await type("拉");
  var was = shown("ss-sug");
  q("#ss-x").click();
  await wait(50);
  out.叉 = { 之前: was, 之後: shown("ss-sug") };
  ok("✕ 收起來", was && !shown("ss-sug"), out.叉);
  out.抓清單次數 = hintsAsked;
  ok("三十分鐘內再進來不重抓清單", hintsAsked === 1, hintsAsked);

  out.結論 = bad.length ? bad.length + " 項沒過" : "全部通過";
  out.沒過 = bad;
  return out;
})();
