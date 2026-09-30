/* 副團主 + AI 每人次數(2026-10-01,Lulu 定案)。
 *   團主:        PAGE='/index.html?ai=18/20'            設定裡指派/換副團主、勾權限;選單和 AI 對話框講剩幾次
 *   一般成員:    PAGE='/index.html?fake=member'          只能許願(沒有加行程、交通的筆)
 *   副團主:      PAGE='/index.html?fake=member&can=plan'  團主勾了行程 → 加得了行程,加不了交通
 *   用完:        PAGE='/index.html?ai=0/20'              「你的 AI 額度用完了,下午三點後再用」,交給 AI 按不下去 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var shown = e => !!e && !e.closest("[hidden]") && e.getBoundingClientRect().width > 0;
var qs = w.location.search, mode = (/[?&]fake=([a-z]+)/.exec(qs) || [])[1] || "owner", deputy = /can=/.test(qs);
var aiQ = /[?&]ai=(\d+)\/(\d+)/.exec(qs);
var patches = () => (w.__calls || []).filter(c => c.method === "PATCH" && /resource=team/.test(c.url)).map(c => c.body);
return (async function () {
  var out = { 情境: qs }, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  /* AI 次數:選單和對話框 */
  q("#menu-btn").click(); await wait(250);
  out.選單 = txt("#menu-ai"); out.選單看得到 = shown(q("#menu-ai"));
  q("#menu-btn").click();
  q("#ai-btn").click(); await wait(250);
  out.對話框 = txt("#ai-quota"); out.交給AI按得下去 = !q("#ai-go").disabled;
  q("#ai-cancel").click(); await wait(50);
  if (!aiQ) ok("讀不到次數 → 選單和對話框都不講", !out.選單看得到 && !out.對話框, out);
  else if (+aiQ[1] === 0) ok("用完:講「你的 AI 額度用完了,下午三點後再用」,按不下去;選單也講用完", /你的 AI 額度用完了,下午三點後再用/.test(out.對話框) && !out.交給AI按得下去 && /用完了/.test(out.選單), out);
  else ok("選單「今天的 AI 還能用 N／M 次 · 參加的團共用」;對話框「你今天還能用 AI N 次」", /還能用 18／20 次/.test(out.選單) && /參加的團共用/.test(out.選單) && /你今天還能用 AI 18 次/.test(out.對話框) && out.交給AI按得下去, out);
  /* 權限 */
  out.加行程 = shown(q("#add-stop-btn"));
  q("#tab-fly").click(); await wait(80); out.加交通 = !!q("[data-flight-add]"); q("#tab-plan").click();
  if (mode === "member" && !deputy) ok("一般成員:沒有加行程、沒有加交通(只能許願)", !out.加行程 && !out.加交通, out);
  if (mode === "member" && deputy) ok("副團主(團主勾了行程):加得了行程、加不了交通", out.加行程 && !out.加交通, out);
  if (mode === "owner") {
    q("#menu-btn").click(); q("#cloud-set").click(); if (!q("#menu-pop").hidden) q("#menu-btn").click(); await wait(100);
    var sel = q("#st-deputy");
    out.副團主選單 = qa("#st-deputy option").map(o => o.textContent);
    out.權限標籤 = qa("#set-trip .who label").map(l => l.textContent.trim());
    ok("設定裡有副團主(不含團主自己)、三塊權限叫 行程/記帳/交通", out.副團主選單[0] === "— 沒有 —" && out.副團主選單.indexOf("阿輝") < 0 && out.副團主選單.indexOf("佳瑜") > 0 &&
      out.權限標籤.join() === "行程,記帳,交通" && /25 次/.test(txt("#st-deputy-note")), out);
    sel.value = "chang_chiayu"; sel.dispatchEvent(new w.Event("change", { bubbles: true }));
    q("#st-can-plan").checked = true;
    q("#settings-form").requestSubmit(); await wait(400);
    var p1 = patches().pop() || {};
    ok("存起來:送出副團主是佳瑜、行程打勾", p1.deputy === "chang_chiayu" && p1.can && p1.can.plan === true, p1);
    q("#menu-btn").click(); q("#cloud-set").click(); if (!q("#menu-pop").hidden) q("#menu-btn").click(); await wait(100);
    ok("再打開:副團主是佳瑜", q("#st-deputy").value === "chang_chiayu", q("#st-deputy").value);
    sel = q("#st-deputy"); sel.value = "chang_chihwei"; sel.dispatchEvent(new w.Event("change", { bubbles: true }));
    q("#settings-form").requestSubmit(); await wait(400);
    q("#menu-btn").click(); q("#cloud-set").click(); if (!q("#menu-pop").hidden) q("#menu-btn").click(); await wait(100);
    out.換過之後 = { 副團主: q("#st-deputy").value, 鎖住: q("#st-deputy").disabled, 說: txt("#st-deputy-note") };
    ok("換成志偉之後:今天鎖住、講幾點之後才能再換", out.換過之後.副團主 === "chang_chihwei" && out.換過之後.鎖住 && /今天已經換過副團主了/.test(out.換過之後.說), out.換過之後);
    q("#st-cancel").click();
  }
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過";
  out.errors = w.__errors || [];
  return out;
})();
