/* 團主只開了幾個開關的時候,成員看到的入口有沒有對。
 *   PAGE='/index.html?fake=member&can=cost' ./probe.sh probes/toggles.js
 * 第 2 期以前三個全開才算「可共編」,只開一個的話伺服器放行、畫面唯讀 —— 這一支盯的是那個缺口補上了。 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var shown = e => !!e && !e.hidden && e.offsetParent !== null;
return (async function () {
  var out = { 開了: (/[?&]can=([a-z,]*)/.exec(w.location.search) || [])[1] || (/fake=member/.test(w.location.search) ? "(都沒開)" : "(團主)") };
  out.加行程 = shown(q("#add-stop-btn"));
  out.行程上的筆 = qa("#route [data-edit-stop]").length;
  q("#tab-cost").click(); await wait(80);
  out.記一筆 = shown(q("#add-exp-btn"));
  out.花費的改 = qa("[data-edit-exp]").length;
  q("#tab-fly").click(); await wait(80);
  out.加航班 = !!q("[data-flight-add]");
  out.航班的筆 = qa("[data-flight-edit]").length;
  q("#tab-wish").click(); await wait(80);
  out.願望的加入 = qa("[data-add-wish]").length;
  out.自己願望的刪除 = qa(".wish.mine [data-del-wish]").length;
  out.別人願望的刪除 = qa(".wish:not(.mine) [data-del-wish]").length;
  out.errors = w.__errors || [];
  return out;
})();
