/* 交通不是只有飛機(Lulu,2026-09-28):飛機/火車/巴士/船/租車五種。
 * 量:清單照天分組、飛機是深色卡其他是淺色卡、行程上的出發/抵達、表單跟著種類換、
 *     存下去的東西(種類、座位對到哪一段、租車的駕駛)、改班次時座位跟著搬。 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var set = (id, v) => { var e = q("#" + id); e.value = v; e.dispatchEvent(new w.Event("input", { bubbles: true })); };
var pick = k => { var i = q('#fl-kinds input[value="' + k + '"]'); i.checked = true; i.dispatchEvent(new w.Event("change", { bubbles: true })); };
var posts = () => (w.__calls || []).filter(c => c.method !== "GET" && /resource=(flights|seats)/.test(c.url)).map(c => c.method + " " + c.url.replace(/^.*resource=/, "") + " " + JSON.stringify(c.body));
return (async function () {
  var out = {}, bad = [];
  var ok = (name, cond, got) => { if (!cond) bad.push(name + " ← " + JSON.stringify(got)); };
  q("#tab-fly").click(); await wait(150);
  out.分組 = qa(".tl-day").map(e => e.textContent);
  out.深色卡 = qa(".tl .board").length; out.淺色卡 = qa(".tl .tleg").map(e => e.dataset.kind);
  ok("兩張飛機、一張火車、一張租車", out.深色卡 === 2 && out.淺色卡.join() === "火車,租車", [out.深色卡, out.淺色卡]);
  var train = q('.tleg[data-kind="火車"]'), car = q('.tleg[data-kind="租車"]');
  out.火車卡 = train && train.textContent.replace(/\s+/g, " ").trim();
  out.租車卡 = car && car.textContent.replace(/\s+/g, " ").trim();
  ok("火車卡有座位 9車 3A", /9車 3A/.test(out.火車卡), out.火車卡);
  ok("租車卡有取車/還車和兩個駕駛", /取車/.test(out.租車卡) && /還車/.test(out.租車卡) && /開車/.test(out.租車卡) && /志偉/.test(out.租車卡), out.租車卡);
  /* 行程上的固定節點 */
  q("#tab-plan").click(); await wait(80);
  q('#days [data-day="2026-10-03"]').click(); await wait(150);
  out.第一天 = txt("#route");
  ok("第一天有火車發車", /N'EX 41 發車/.test(out.第一天) && /抵達 東京/.test(out.第一天), out.第一天);
  q('#days [data-day="2026-10-06"]').click(); await wait(150);
  out.第四天 = txt("#route");
  ok("第四天有取車", /取車 · TOYOTA 租車/.test(out.第四天), out.第四天);
  q('#days [data-day="2026-10-07"]').click(); await wait(150);
  ok("第五天有還車", /還車 · TOYOTA 租車/.test(txt("#route")), txt("#route"));
  /* 表單跟著種類換 */
  q("#tab-fly").click(); await wait(80);
  q("[data-flight-add]").click(); await wait(80);
  out.預設 = { 種類: q("#fl-kinds input:checked").value, 標題: txt("#fl-title"), 班次: txt("#fl-no-l"), 座位: !q("#fl-f-seats").hidden };
  pick("巴士"); await wait(30);
  out.巴士 = { 班次: txt("#fl-no-l"), 公司: txt("#fl-airline-l"), 出發: txt("#fl-depart-l"), 從: txt("#fl-from-l"), 座位提示: q("#fl-seats input").placeholder };
  pick("租車"); await wait(30);
  out.租車 = { 班次欄: !q("#fl-f-no").hidden, 方向欄: !q("#fl-f-dir").hidden, 座位欄: !q("#fl-f-seats").hidden, 駕駛欄: !q("#fl-f-drivers").hidden, 出發: txt("#fl-depart-l") };
  ok("租車沒有班次、方向、座位,有駕駛", !out.租車.班次欄 && !out.租車.方向欄 && !out.租車.座位欄 && out.租車.駕駛欄, out.租車);
  /* 存一段沒有班次的巴士,兩個人有座位 */
  pick("巴士"); set("fl-no", ""); set("fl-airline", "WILLER"); set("fl-depart", "2026-10-05T07:10"); set("fl-arrive", "2026-10-05T09:00");
  set("fl-from", "新宿"); set("fl-to", "河口湖站");
  set("fl-seat-" + "chang_chiayu", "3a"); set("fl-seat-" + "chen_suchih", "3B");
  q("#flight-form").requestSubmit(); await wait(400);
  out.存巴士 = posts(); out.錯誤 = txt("#fl-err");
  var bus = (w.__rows.flights || []).filter(f => f.kind === "巴士")[0];
  var busSeats = (w.__rows.seats || []).filter(s => bus && s.flight === bus.id.toUpperCase());
  ok("巴士存成種類巴士、座位對到這一列", !!bus && busSeats.length === 2, { bus: bus, seats: busSeats });
  ok("表單關了", q("#flight-overlay").hidden, "");
  /* 改火車的車次:座位跟著搬 */
  q('.tleg[data-kind="火車"] [data-flight-edit]').click(); await wait(80);
  out.改火車 = { 種類: q("#fl-kinds input:checked").value, 車次: q("#fl-no").value, 座位: q("#fl-seat-chang_chiayu").value };
  set("fl-no", "成田特快 N'EX 43"); q("#flight-form").requestSubmit(); await wait(400);
  var moved = (w.__rows.seats || []).filter(s => s.passenger === "chang_chiayu" && /N'EX43$/.test(s.flight));
  ok("改車次之後佳瑜的座位搬到新車次", moved.length === 1, (w.__rows.seats || []).filter(s => /N'EX/.test(s.flight)));
  q("#tab-fly").click(); await wait(100);
  out.火車卡改後 = (q('.tleg[data-kind="火車"]') || {}).textContent;
  ok("改後的火車卡還看得到座位", /9車 3A/.test(out.火車卡改後 || ""), out.火車卡改後);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過";
  out.errors = w.__errors || [];
  return out;
})();
