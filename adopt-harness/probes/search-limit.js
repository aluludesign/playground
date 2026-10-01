/* 免費搜不限 6 筆(2026-10-01,Lulu):第 1、2 段(Nominatim)要 40 筆(它自己的上限),清單全部排得出來、可以捲 */
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
  out.排出幾筆 = qa('#stop-form [data-hit="sf-title"]').length;
  var hits = q("#stop-form .hits");
  out.捲得動 = !!hits && hits.scrollHeight > hits.clientHeight;
  if (out.要幾筆 !== "40") bad.push("要的是 " + out.要幾筆 + " 筆");
  if (out.排出幾筆 !== 40) bad.push("排出 " + out.排出幾筆 + " 筆");
  if (!out.捲得動) bad.push("清單沒有捲");
  q("#sf-cancel").click();
  out.結論 = bad.length ? "✗ " + bad.join(";") : "全部通過";
  out.errors = w.__errors || [];
  return out;
})();
