/* 選單裡會開對話框的按鈕(邀請朋友、團的設定)按了要把選單收起來,不然選單蓋在對話框上面(2026-10-02)。
 *   WIDTH=390 ./probe.sh probes/menu-close.js */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
return (async function () {
  await wait(300);
  var bad = [], out = {};
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  for (var id of ["cloud-set", "cloud-invite"]) {
    q("#menu-btn").click(); await wait(60);
    q("#" + id).click(); await wait(80);
    out[id] = { 選單收了: q("#menu-pop").hidden };
    ok(id + " → 選單收起來", q("#menu-pop").hidden, out[id]);
    d.querySelectorAll(".overlay:not([hidden])").forEach(o => { o.hidden = true; });
  }
  q("#menu-btn").click(); await wait(60); q("#cloud-sync").click(); await wait(80);
  ok("重新整理 → 選單留著(要看結果)", !q("#menu-pop").hidden, "");
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
