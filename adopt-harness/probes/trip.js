/* 第 2 期:團主打開東京五人行,畫面上有沒有該有的東西。
 * 這些以前是寫死的(團名、日期、航班、座位),現在從假後端長出來 —— 這支盯的是
 * 「資料真的走到畫面上」,不是「程式接得到」。 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
return {
  url: w.location.search,
  errors: w.__errors || [],
  title: d.title,
  h1: txt("#trip-name"),
  foot: txt("#trip-foot"),
  homeOpen: !q("#home-overlay").hidden,
  homeCard: txt("#home-card").slice(0, 120),
  cloud: txt("#cloud-msg"),
  cloudOps: qa("#cloud-ops .btn").map(b => b.textContent.trim()),
  days: qa("#days [data-day], #days button").length,
  countdown: txt("#countdown"),
  legs: qa("#board-wrap .leg-no").map(x => x.textContent.replace(/\s+/g, " ").trim()),
  boardName: txt("#board-wrap .bh-name"),
  seats: qa("#board-wrap .seat").length,
  moved: qa("#board-wrap .seat.moved").map(x => x.textContent),
  anchorsDay1: (function(){ return qa(".stop.anchor").map(x => x.textContent.replace(/\s+/g, " ").trim().slice(0, 40)); })(),
  flightAdd: !!q("[data-flight-add]"),
  canEdit: d.body.classList.contains("can-edit"),
  calls: (w.__calls || []).map(c => c.method + " " + c.url.replace(/^.*\/api\//, "")).slice(0, 12),
};
