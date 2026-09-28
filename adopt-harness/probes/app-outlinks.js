/* 主畫面 App 裡點站外的連結(地圖上的點、備註裡的網址、用 LINE 傳給朋友)不可以另開視窗 ——
 * iPhone 把 Google 地圖 / LINE 交給別的 App 之後,那個新視窗會留成一頁空白(Lulu 回報)。
 * App 裡要「這一頁直接往那裡走」;瀏覽器裡照舊開新分頁。
 * 手機瀏覽器(touch=1)只有 Google 地圖和 LINE 這一頁直接走,其他網站照舊開新分頁。
 * app=1 扮成主畫面 App,touch=1 扮成手機瀏覽器(pointer: coarse)。往站外走的那一下用 Navigation API 攔下來記著,探針才不會跟著離開。 */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var APP = /[?&]app=1/.test(w.location.search) || w.__probeApp;
var TOUCH = /[?&]touch=1/.test(w.location.search);
if (TOUCH) { var mm = w.matchMedia.bind(w); w.matchMedia = function (qq) { return /pointer:\s*coarse/.test(qq) ? { matches: true } : mm(qq); }; }
if (APP) Object.defineProperty(w.navigator, "standalone", { value: true, configurable: true });
var opened = [], went = [];
w.open = function (u) { opened.push(String(u)); return null; };
w.navigation.addEventListener("navigate", e => { went.push(e.destination.url); e.preventDefault(); });
function tapPin() {
  var pin = q(".map .pin"), r = pin.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  var pe = t => new w.PointerEvent(t, { clientX: x, clientY: y, pointerId: 7, bubbles: true, isPrimary: true, button: 0 });
  pin.dispatchEvent(pe("pointerdown")); pin.dispatchEvent(pe("pointerup"));
  pin.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true, clientX: x, clientY: y }));
}
return (async function () {
  var out = { 模式: APP ? "主畫面 App" : TOUCH ? "手機瀏覽器" : "電腦瀏覽器" };
  var snap = () => ({ 另開視窗: opened.splice(0), 這頁走去: went.splice(0) });
  tapPin(); await wait(150); out.地圖的點 = snap();
  var lnk = q("#route .lnk"); lnk.click(); await wait(150); out.備註的網址 = snap();
  q("#menu-btn").click(); q("#cloud-invite").click(); await wait(100);
  q("#inv-line").click(); await wait(150); out.用LINE傳 = snap();
  var here = s => !s.另開視窗.length && s.這頁走去.length === 1;
  var ok = APP ? [out.地圖的點, out.備註的網址, out.用LINE傳].every(here)
    : TOUCH ? here(out.地圖的點) && here(out.用LINE傳) && !out.備註的網址.這頁走去.length
    : out.地圖的點.另開視窗.length === 1 && ![out.地圖的點, out.備註的網址, out.用LINE傳].some(s => s.這頁走去.length);
  out.結論 = ok ? "✓" : "✗";
  out.還在原畫面 = !!q("#trip-name");
  out.errors = w.__errors || [];
  return out;
})();
