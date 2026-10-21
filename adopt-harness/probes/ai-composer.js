/* AI 對話框:打字、照片、拍照選圖同一個框(2026-10-12,Lulu:「拍照、選圖移到想做什麼的框內(放最底下),
 * 讀進來的照片也一起移進去,框可以大一點」)。
 * 框線畫在 .ai-box —— 要跟一般的 .rm-input **逐項一樣**(平常、打字時),標準是同一張卡裡臨時放的一格一般文字欄。
 *   WIDTH=390 PAGE='/index.html?touch=1' ./probe.sh probes/ai-composer.js
 *   WIDTH=1440 ./probe.sh probes/ai-composer.js */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var P = ["borderTopWidth", "borderTopStyle", "borderTopColor", "borderTopLeftRadius", "backgroundColor", "boxShadow"];
var pick = e => { var cs = w.getComputedStyle(e), o = {}; P.forEach(k => o[k] = cs[k]); return o; };
var diff = (a, b) => P.filter(k => a[k] !== b[k]).map(k => k + ": " + a[k] + " ≠ " + b[k]);
async function file(color) {
  var c = d.createElement("canvas"); c.width = 300; c.height = 200;
  var g = c.getContext("2d"); g.fillStyle = color; g.fillRect(0, 0, 300, 200);
  var blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.9));
  return new w.File([blob], "a.jpg", { type: "image/jpeg" });
}
return (async function () {
  await wait(300);
  /* 過場動畫在無頭瀏覽器的虛擬時間裡不會走完,量到的是半路的值 —— 關掉 */
  var st = d.createElement("style"); st.textContent = "*,*::before,*::after{transition:none!important}"; d.head.appendChild(st);
  var out = {}, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  q("#ai-btn").click(); await wait(150);
  /* 2026-10-21 起要先選類型「交給 AI」才按得下去(停用的鈕拿不到焦點);選類型那排不算空白,點了不跳去打字 */
  var kc = q('[data-ai-kind-chip="wish"] input'); kc.checked = true; kc.dispatchEvent(new Event("change", { bubbles: true }));
  q("#ai-go").focus(); q('[data-ai-kind-chip="wish"]').click();
  ok("點選類型那排不會跳去打字", d.activeElement !== q("#ai-text"), d.activeElement && d.activeElement.id);
  var box = q("#ai-box");
  ok("拍照、選圖、縮圖、幾張的字都在框裡;框在提醒那段上面", ["#ai-pick", "#ai-shoot", "#ai-imgs", "#ai-img-name"].every(s => box.contains(q(s))) &&
    !!(box.compareDocumentPosition(q("#ai-tip")) & Node.DOCUMENT_POSITION_FOLLOWING), "");
  var dt = new w.DataTransfer(); dt.items.add(await file("#c9a07a")); dt.items.add(await file("#7a9bc9"));
  var inp = q("#ai-file"); inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true })); await wait(150);
  var tr = q("#ai-text").getBoundingClientRect(), ir = q("#ai-imgs").getBoundingClientRect(), br = q("#ai-img-row").getBoundingClientRect(), xr = box.getBoundingClientRect();
  out.位置 = { 字: Math.round(tr.bottom), 縮圖: [Math.round(ir.top), Math.round(ir.bottom)], 按鈕: [Math.round(br.top), Math.round(br.bottom)], 框底: Math.round(xr.bottom), 縮圖幾張: qa("#ai-box .ai-im").length };
  ok("由上到下:打字 → 縮圖 → 拍照選圖(最底下),都在框的底線裡面", tr.bottom <= ir.top && ir.bottom <= br.top && br.bottom <= xr.bottom && out.位置.縮圖幾張 === 2, out.位置);
  out.打字高 = q("#ai-text").offsetHeight;
  ok("打字那格比一般多行文字欄高(至少 160px)", out.打字高 >= 160, out.打字高);

  var f = d.createElement("div"); f.className = "fld"; f.innerHTML = '<label class="rm-label" for="zz">標準</label><input class="rm-input" id="zz" value="a">';
  q("#ai-tip").before(f); var ref = q("#zz");
  q("#ai-go").focus(); await wait(100);
  out.平常差 = diff(pick(box), pick(ref));
  ref.focus(); await wait(100); var refF = pick(ref);
  q("#ai-text").focus(); await wait(100);
  out.打字時差 = diff(pick(box), refF);
  var ta = w.getComputedStyle(q("#ai-text"));
  out.裡面那格 = { 框: ta.borderTopWidth, 陰影: ta.boxShadow, 底色: ta.backgroundColor, 拉大小: ta.resize };
  out.標題 = { 底色: w.getComputedStyle(q("#ai-ask-label")).backgroundImage, 框底色: w.getComputedStyle(box).backgroundColor };
  f.remove();
  ok("框平常跟一般文字欄逐項一樣(框線粗細、顏色、圓角、底色、陰影)", !out.平常差.length, out.平常差);
  ok("打字時也一樣(主色框＋內陰影補到 3px)", !out.打字時差.length, out.打字時差);
  ok("裡面那格不畫自己的框、透明、不能拉大小", out.裡面那格.框 === "0px" && out.裡面那格.陰影 === "none" && out.裡面那格.底色 === "rgba(0, 0, 0, 0)" && out.裡面那格.拉大小 === "none", out.裡面那格);
  ok("浮動標題遮框線的那一段 = 框的底色", out.標題.底色.indexOf(out.標題.框底色) >= 0, out.標題);
  var r1 = q("#ai-imgs").getBoundingClientRect();
  q("#ai-go").focus();
  box.dispatchEvent(new MouseEvent("click", { bubbles: true }));   /* 點在框本身(縮圖、按鈕以外的空白) */
  ok("點框裡空白的地方 → 游標進打字那格", d.activeElement === q("#ai-text"), d.activeElement && d.activeElement.id);
  q("#ai-go").focus();
  q('#ai-imgs [data-ai-rm="0"]').click(); await wait(80);
  ok("按縮圖的 ✕ 只拿掉那張,不會跳去打字", qa("#ai-box .ai-im").length === 1 && d.activeElement !== q("#ai-text"), qa("#ai-box .ai-im").length);
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
