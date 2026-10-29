/* 每個元素（含 ::before/::after）的 computed style 全部抓下來，改名前後各跑一次比對。
 *   WIDTH=390 ./probe.sh probes/computed-all.js > before.json   （改之前）
 *   WIDTH=390 ./probe.sh probes/computed-all.js > after.json    （改之後）
 * 只改變數名字時，兩份要一模一樣。分頁逐一切過，因為有些樣式跟著 body[data-view] 走。
 * 回傳 { 分頁: { 路徑: 雜湊 } }；DETAIL=路徑 時改回傳那個元素的全部屬性。 */
var tabs = ["plan", "wish", "fly", "cost", "split"];
var pseudo = [null, "::before", "::after"];
function path(e) {
  var p = [];
  for (; e && e !== d.documentElement; e = e.parentElement) {
    var i = 0; for (var s = e; (s = s.previousElementSibling);) i++;
    p.unshift(e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + ":" + i);
  }
  return p.join(">");
}
function h(s) { var x = 2166136261; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); }
function dump(e, ps) {
  var cs = getComputedStyle(e, ps), o = [];
  for (var i = 0; i < cs.length; i++) { var k = cs[i]; if (k.indexOf("--") === 0) continue; o.push(k + ":" + cs.getPropertyValue(k)); }
  return o.join(";");
}
return (async function () {
  /* 轉場、動畫關掉：不然切分頁當下量到的是轉場中途的值，兩次跑的結果會不一樣 */
  var st = d.createElement("style"); st.textContent = "*,*::before,*::after{transition:none!important;animation:none!important}";
  d.head.appendChild(st);
  var out = {};
  for (var t of tabs) {
    if (typeof w.switchTab === "function") w.switchTab(t);
    else { var b = d.querySelector('[data-tab="' + t + '"]'); if (b) b.click(); }
    await new Promise(r => w.setTimeout(r, 250));
    var m = {};
    d.querySelectorAll("*").forEach(e => {
      if (e === st || /^(script|style|link|meta|title|head)$/i.test(e.tagName)) return;
      var k = path(e);
      pseudo.forEach(ps => { m[k + (ps || "")] = h(dump(e, ps)); });
    });
    out[t] = m;
  }
  return out;
})();
