// 地圖底圖的低飽和濾鏡:套在主地圖的圖磚上,**不**套在標記和候選清單的縮圖上。
//
// 為什麼要有這一支:Lulu 2026-10-02 從六種濾鏡裡挑了「低飽和 0.6」(D3),
// 而且說候選清單左邊那張 OSM 小縮圖「不用」套。濾鏡寫錯(拼錯、被別的規則蓋掉)
// 不會報錯,只是地圖照舊 —— 這個專案的樣式壞掉一向是無聲的。
//
// 量法:在頁面上放一張 `.map .tile`、一個 `.map .pin`、一張 `.thumb img`,讀 computed filter。
// 不靠打開地圖抽屜:抽屜收起來時什麼都不抓,圖磚根本不會出現。
//
//   ./probe.sh probes/tile-filter.js
var log = [], out = { 步驟: log, 沒過的: [] };
function ok(name, cond, extra) {
  log.push((cond ? "✓ " : "✗ ") + name + (cond ? "" : "   ← " + JSON.stringify(extra)));
  if (!cond) out.沒過的.push(name);
}
/* 跟 index.html 的 `.map .tile` 一字不差。從程式裡讀的話,程式錯了期望值也跟著錯。 */
var WANT = "saturate(0.6) brightness(1.03) contrast(0.93)";

var box = d.createElement("div");
box.className = "map";
box.innerHTML = '<div class="layer"><img class="tile" alt=""><a class="pin">1</a></div>';
var th = d.createElement("span");
th.className = "thumb";
th.innerHTML = "<img alt=\"\">";
d.body.appendChild(box);
d.body.appendChild(th);

var f = function (el) { return w.getComputedStyle(el).filter; };
var tile = f(box.querySelector(".tile")), pin = f(box.querySelector(".pin")), thumb = f(th.querySelector("img"));
ok("主地圖的圖磚套了低飽和 0.6", tile === WANT, tile);
ok("地圖上的標記沒有被套到", pin === "none", pin);
ok("候選清單的縮圖沒有被套到", thumb === "none", thumb);

box.remove(); th.remove();
return out;
