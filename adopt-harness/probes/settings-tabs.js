/* 團的設定分三個 tab(2026-10-21,Lulu):一般(團名、國家、城市、日期 ─ 我在這團叫、我的顏色)|錢(匯率、預收)|副團主。
 * 只切顯示、不重畫:改到一半換 tab 值還在;「存起來」一次存全部;每次打開從「一般」開始;改了任何一個 tab,點外面都不會關。
 * 不是團主:沒有 tab 列,只有自己的名字和顏色。
 *   WIDTH=390 ./probe.sh probes/settings-tabs.js
 *   PAGE='/index.html?fake=member' WIDTH=390 ./probe.sh probes/settings-tabs.js */
var q = s => d.querySelector(s), qa = s => Array.from(d.querySelectorAll(s)), wait = ms => new Promise(r => w.setTimeout(r, ms));
var vis = e => !!e && !e.closest("[hidden]") && e.getBoundingClientRect().height > 0;
return (async function () {
  await wait(300);
  var nav = (w.performance.getEntriesByType("navigation")[0] || {}).name || "", member = /fake=member/.test(nav), out = {}, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var open = async () => { q("#menu-btn").click(); await wait(60); q("#cloud-set").click(); await wait(150); };
  var tab = async k => { q('[data-st-tab="' + k + '"]').click(); await wait(40); };
  var shown = () => ["st-name", "st-country", "st-start", "st-myname", "st-mycolor", "st-rate", "st-fund-mode", "st-deputy", "st-can-plan"].filter(id => vis(q("#" + id)));
  await open();
  if (member) {
    out.看得到 = shown();
    ok("不是團主:沒有 tab 列,只有自己的名字和顏色,沒有「團的設定只有團主能改」", !vis(q("#st-tabs")) && out.看得到.join() === "st-myname,st-mycolor" && !/只有團主能改/.test(q("#settings-form").textContent), out.看得到);
  } else {
    out.tab = qa("[data-st-tab]").map(b => b.textContent.trim() + ":" + b.getAttribute("aria-pressed"));
    ok("tab 列在最上方:一般|錢|副團主,打開時在「一般」", vis(q("#st-tabs")) && out.tab.join() === "一般:true,錢:false,副團主:false" &&
      q("#st-tabs").getBoundingClientRect().top < q("#st-name").getBoundingClientRect().top, out.tab);
    out.一般 = shown();
    ok("一般:團名、國家、日期,細線下面是我在這團叫、我的顏色", out.一般.join() === "st-name,st-country,st-start,st-myname,st-mycolor" && vis(q(".set-sep")), out.一般);
    q("#st-name").value = "東京五人行・改"; q("#st-name").dispatchEvent(new Event("input", { bubbles: true }));
    await tab("money"); out.錢 = shown();
    ok("錢:匯率、預收", out.錢.join() === "st-rate,st-fund-mode", out.錢);
    q("#st-rate").value = "0.22"; q("#st-rate").dispatchEvent(new Event("input", { bubbles: true }));
    await tab("dep"); out.副團主 = shown();
    ok("副團主:副團主、可以管哪幾塊", out.副團主.join() === "st-deputy,st-can-plan", out.副團主);
    q("#st-can-cost").checked = true;
    await tab("gen");
    ok("換回「一般」:剛剛改的團名還在(只切顯示,沒重畫)", q("#st-name").value === "東京五人行・改", q("#st-name").value);
    /* 點外面:改過了不能關 */
    q("#settings-overlay").dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(80);
    ok("改過(三個 tab 都有改)→ 點外面不會關", !q("#settings-overlay").hidden, "");
    var p0 = (w.__calls || []).filter(x => /resource=team/.test(x.url) && x.method === "PATCH").length;
    q("#settings-form").requestSubmit(); await wait(400);
    var patch = (w.__calls || []).filter(x => /resource=team/.test(x.url) && x.method === "PATCH").slice(p0)[0];
    out.送出 = patch && { name: patch.body.name, rate: patch.body.rate, can: patch.body.can };
    ok("「存起來」一次存三個 tab:團名、匯率、副團主權限都送出", out.送出 && out.送出.name === "東京五人行・改" && out.送出.rate === 0.22 && out.送出.can.cost === true, out.送出);
    await open(); await tab("money"); q("#st-cancel").click(); await wait(60);
    await open();
    ok("再打開:又從「一般」開始", q('[data-st-tab="gen"]').getAttribute("aria-pressed") === "true" && vis(q("#st-name")) && !vis(q("#st-rate")), "");
    q("#settings-overlay").dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(80);
    ok("沒改過 → 點外面就關", q("#settings-overlay").hidden, "");
  }
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
