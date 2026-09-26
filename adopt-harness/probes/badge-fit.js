/* 「測試:成員」那顆標籤在各種寬度下:團主身分時看不到;成員身分時不蓋到頂列的任何東西、按得到。
 *   for W in 390 768 1100; do WIDTH=$W ./probe.sh probes/badge-fit.js; done
 * 由來:浮在畫面上的第一版在某些寬度蓋住了漢堡選單(Lulu 回報)—— 那一版只量了 390 和 1100。 */
var q = s => d.querySelector(s);
var drawn = e => { if (!e) return false; var cs = w.getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") return false; var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
if (!/trip_as=member/.test(d.cookie)) {
  w.sessionStorage.setItem("bf-owner", JSON.stringify(drawn(q("#dev-badge"))));
  d.cookie = "trip_as=member; Path=/"; w.location.reload(); return { 說明: "切成成員中" };
}
var b = q("#dev-badge"), br = b.getBoundingClientRect();
var hit = d.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
var over = ["#trip-name", "#countdown", "#ai-btn", "#menu-btn", ".tabs"].filter(function (s) {
  var e = q(s); if (!drawn(e)) return false; var x = e.getBoundingClientRect();
  return !(x.right <= br.left || x.left >= br.right || x.bottom <= br.top || x.top >= br.bottom); });
d.cookie = "trip_as=; Path=/; Max-Age=0";
var ownerSaw = JSON.parse(w.sessionStorage.getItem("bf-owner") || "null"); w.sessionStorage.removeItem("bf-owner");
var bad = [];
if (ownerSaw) bad.push("團主身分時標籤也畫出來了");
if (!drawn(b)) bad.push("成員身分時看不到標籤");
if (over.length) bad.push("蓋到了 " + over.join("、"));
if (!(hit && (hit === b || b.contains(hit)))) bad.push("標籤本身按不到");
return { 寬: w.innerWidth, 標籤: [Math.round(br.left), Math.round(br.top), Math.round(br.width), Math.round(br.height)], 結論: bad.length ? "✗ " + bad.join(";") : "✓" };
