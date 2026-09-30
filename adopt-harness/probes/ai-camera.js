/* AI 的圖片兩條路(Lulu,2026-09-30):手機、平板多一顆「拍照」直接開相機;電腦只有「選一張圖」。
 *   WIDTH=390 TOUCH:網址帶 touch=1 扮觸控 ;  不帶 = 電腦 */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var shown = e => !!e && !e.hidden && e.getBoundingClientRect().width > 0;
var touch = /[?&]touch=1/.test(w.location.search);
return (async function () {
  var out = { 模式: touch ? "觸控" : "電腦" }, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  q("#ai-btn").click(); await wait(80);
  out.拍照鈕 = shown(q("#ai-shoot")); out.選圖鈕 = shown(q("#ai-pick"));
  var cam = q("#ai-cam"), file = q("#ai-file");
  out.相機欄 = { capture: cam.getAttribute("capture"), accept: cam.accept }; out.選圖欄有capture = file.hasAttribute("capture");
  ok(touch ? "觸控:拍照和選圖兩顆都在" : "電腦:只有選圖", out.拍照鈕 === touch && out.選圖鈕, out);
  ok("拍照那一格直接開後鏡頭、選圖那一格不限制來源", out.相機欄.capture === "environment" && /image/.test(out.相機欄.accept) && !out.選圖欄有capture, out);
  var clicked = [];
  cam.click = () => clicked.push("相機"); file.click = () => clicked.push("相簿");
  if (touch) q("#ai-shoot").click(); q("#ai-pick").click();
  ok("按鈕各自打開自己那一格", JSON.stringify(clicked) === JSON.stringify(touch ? ["相機", "相簿"] : ["相簿"]), clicked);
  /* 拍到的照片真的進得去(模擬相機回來一張圖) */
  if (touch) {
    var c = d.createElement("canvas"); c.width = 40; c.height = 30; c.getContext("2d").fillRect(0, 0, 40, 30);
    var blob = await new Promise(r => c.toBlob(r, "image/png"));
    var dt = new w.DataTransfer(); dt.items.add(new w.File([blob], "image.jpg", { type: "image/png" }));
    cam.files = dt.files; cam.dispatchEvent(new w.Event("change", { bubbles: true })); await wait(300);
    out.收到 = (q("#ai-img-name").textContent || "").trim();
    ok("拍完的照片收進來,講「剛拍的照片」", /剛拍的照片/.test(out.收到), out.收到);
    q("#ai-overlay").dispatchEvent(new w.MouseEvent("click", { bubbles: true })); await wait(60);
    ok("拍了照片就算改過,點外面不會關掉", !q("#ai-overlay").hidden, "");
  }
  q("#ai-cancel").click();
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過";
  out.errors = w.__errors || [];
  return out;
})();
