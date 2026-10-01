/* 免費搜不限 6 筆(2026-10-01,Lulu):第 1、2 段(Nominatim)要 40 筆(它自己的上限);畫面一次 8 筆,捲到底接下一批 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var asked = [];
var many = Array.from({ length: 40 }, (_, i) => ({ lat: String(35.6 + i / 1000), lon: "139.7", display_name: "第" + (i + 1) + "間拉麵, 新宿, 東京都, 日本" }));
w.fetch = (u => function (x, i) { if (/nominatim/.test(String(x))) { asked.push(String(x)); return Promise.resolve({ ok: true, json: () => Promise.resolve(many) }); } return u(x, i); })(w.fetch);
return (async function () {
  var out = {}, bad = [];
  q("#add-stop-btn").click(); await wait(80);
  q("#sf-title").value = "拉麵"; q('[data-seek="sf-title"]').click(); await wait(1500);
  out.要幾筆 = (/[?&]limit=(\d+)/.exec(asked[0] || "") || [])[1];
  var n = () => qa('#stop-form [data-hit="sf-title"]').length;
  var hits = q("#stop-form .hits");
  out.一開始排幾筆 = n();
  out.捲得動 = !!hits && hits.scrollHeight > hits.clientHeight;
  /* 動態載入(2026-10-01,Lulu:每 8 筆一次):捲到底才接下一批 */
  out.每捲一次 = [];
  for (var k = 0; k < 6; k++) { hits.scrollTop = hits.scrollHeight; hits.dispatchEvent(new w.Event("scroll")); await wait(60); out.每捲一次.push(n()); }
  if (out.要幾筆 !== "40") bad.push("要的是 " + out.要幾筆 + " 筆");
  if (out.一開始排幾筆 !== 8) bad.push("一開始排了 " + out.一開始排幾筆 + " 筆");
  if (out.每捲一次.join() !== "16,24,32,40,40,40") bad.push("捲到底接的批次不對 " + out.每捲一次.join());
  if (!out.捲得動) bad.push("清單沒有捲");
  /* 後面才接上來的那幾筆挑得到(序號對得上原本那一份) */
  qa('#stop-form [data-hit="sf-title"]')[37].click(); await wait(80);
  out.挑第38筆 = q("#sf-title").value;
  if (out.挑第38筆 !== "第38間拉麵") bad.push("挑第 38 筆拿到 " + out.挑第38筆);
  q("#sf-cancel").click();
  out.結論 = bad.length ? "✗ " + bad.join(";") : "全部通過";
  out.errors = w.__errors || [];
  return out;
})();
