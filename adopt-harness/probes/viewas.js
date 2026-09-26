/* 測試環境:團主切成「用成員身分看」再切回來。prod=1 模擬正式站 —— 那裡不能有這顆鈕。
 *   ./probe.sh probes/viewas.js
 *   PAGE='/index.html?prod=1' ./probe.sh probes/viewas.js */
var q = s => d.querySelector(s), txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
/* offsetParent 對 position:fixed 的元素永遠是 null(提示條就是 fixed)—— 改問畫出來的方塊有沒有大小 */
var shown = e => { if (!e || e.hidden) return false; var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
var state = () => ({ 切換鈕: txt("#cloud-viewas") || "(沒有)", 提示條: shown(q("#dev-badge")), 加行程: shown(q("#add-stop-btn")), 狀態列: txt("#cloud-msg") });
if (/prod=1/.test(w.location.search)) {
  var s0 = state(); d.cookie = "trip_as=member; Path=/";
  return { 正式站: s0, 說明: "正式站不該有切換鈕,也不該有提示條" };
}
var step = Number(w.sessionStorage.getItem("va-step") || "0");
var log = JSON.parse(w.sessionStorage.getItem("va-log") || "[]");
log.push(state());
w.sessionStorage.setItem("va-log", JSON.stringify(log));
if (step === 0) { w.sessionStorage.setItem("va-step", "1"); q("#cloud-viewas").click(); return { 說明: "切成成員中…" }; }
if (step === 1) { w.sessionStorage.setItem("va-step", "2"); q("#dev-badge-back").click(); return { 說明: "切回團主中…" }; }
w.sessionStorage.removeItem("va-step"); w.sessionStorage.removeItem("va-log");
return { 一開始是團主: log[0], 切成成員之後: log[1], 按提示條切回來: log[2], errors: w.__errors || [] };
