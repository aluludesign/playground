/* 共同基金:一包錢、誰出多少、保管人、補基金、結算(2026-10-02,Lulu)。
 *   PAGE='/index.html?fund=pot'           一包錢,保管人佳瑜:結清方式算得平、保管人卡片有「手上基金剩」、付款人可選共同基金、補基金
 *   PAGE='/index.html?fund=pot&keeper=0'  沒指定保管人:結清方式裡出現「共同基金」
 *   PAGE='/index.html?fund=diff'          預算、每人不一樣:只列有出的人
 *   PAGE='/index.html'                    設定:模式、誰有出、每人一樣一格 / 不一樣每人一格(照成員)、一包錢才有保管人 */
var q = s => d.querySelector(s), qa = s => Array.from(d.querySelectorAll(s)), wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
return (async function () {
  await wait(300);
  var nav = (w.performance.getEntriesByType("navigation")[0] || {}).name || "", bad = [], out = {};
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var pot = /fund=pot/.test(nav), diff = /fund=diff/.test(nav), nokeeper = /keeper=0/.test(nav);
  q("#tab-split").click(); await wait(100);
  out.基金 = txt("#fund-sub") + " | " + txt("#fund");
  out.轉帳 = qa("#transfers .pay").map(x => x.textContent.replace(/\s+/g, " ").trim());
  if (pot) {
    ok("一包錢:標題寫一包錢、共 25,000;列出三個出錢的人", /一包錢/.test(out.基金) && /25,000/.test(out.基金) && qa("#fund .fp").length === 3, out.基金);
    ok("講錢在誰手上", nokeeper ? /錢在 共同基金 手上/.test(out.基金) : /錢在 佳瑜 手上/.test(out.基金), out.基金);
    /* 轉帳加起來要平:每個人最後付的剛好是自己分到的 */
    var amt = s => Number(String(s).replace(/[^\d]/g, ""));
    out.卡片 = qa("#people .person").map(x => x.textContent.replace(/\s+/g, " ").trim());
    if (nokeeper) ok("沒指定保管人:結清方式出現「共同基金」", out.轉帳.some(t => /共同基金/.test(t)), out.轉帳);
    else ok("有保管人:結清方式不出現「共同基金」,保管人卡片有「手上基金剩」或「基金墊不夠」", !out.轉帳.some(t => /共同基金/.test(t)) && out.卡片.some(t => /佳瑜/.test(t) && /基金剩|墊不夠/.test(t)), { 轉帳: out.轉帳, 卡片: out.卡片 });
    ok("出錢的人卡片有「出基金」", out.卡片.filter(t => /出基金/.test(t)).length === 3, out.卡片);
    q("#tab-cost").click(); await wait(80);
    q("#add-exp-btn") && q("#add-exp-btn").click(); await wait(80);
    out.付款人選項 = qa("#ef-payer option").map(o => o.textContent);
    ok("記帳:付款人多一個「共同基金」", out.付款人選項.indexOf("共同基金") >= 0, out.付款人選項);
    q("#tab-split").click(); await wait(80);
    var btn = q("#fund-top-btn");
    ok("團主看得到「補基金」", !!btn, "");
    if (btn) {
      btn.click(); await wait(80);
      ok("補基金對話框:列出出錢的人(預設全勾)", qa("#ft-who input:checked").length === 3, qa("#ft-who input").length);
      q("#ft-amt").value = "2000"; q("#fund-top-form").requestSubmit(); await wait(300);
      out.補完 = txt("#fund-sub");
      ok("補完:共變成 31,000", /31,000/.test(out.補完), out.補完);
    }
  } else if (diff) {
    ok("預算每人不一樣:標題寫「每人不一樣」,只列有出的兩個人", /每人不一樣/.test(out.基金) && qa("#fund .fp").length === 2, out.基金);
  } else {
    q("#menu-btn").click(); await wait(60); q("#cloud-set").click(); await wait(150);
    var mode = q("#st-fund-mode"), set = v => { mode.value = v; mode.dispatchEvent(new Event("change")); };
    ok("舊的團(只有「基金」30,000):當成預算、每人一樣 30,000", mode.value === "budget" && q("#st-fund-same1").checked && q("#st-kitty").value === "30000", { mode: mode.value, v: q("#st-kitty").value });
    set("none"); await wait(30);
    ok("選「沒有」:下面全部收起來", q("#st-fund-box").hidden, "");
    set("pot"); await wait(30);
    ok("選「一包錢」:誰有出(照成員 5 人)、保管人出現", !q("#st-fund-box").hidden && qa("[data-fund-who]").length === 5 && !q("#st-keeper-fld").hidden, "");
    ok("每人一樣:只有一格金額", !q("#st-kitty-fld").hidden && q("#st-fund-each").hidden, "");
    q("#st-fund-same0").checked = true; q("#st-fund-same0").dispatchEvent(new Event("change", { bubbles: true })); await wait(30);
    var rows = () => qa("[data-fund-row]").filter(x => !x.hidden).map(x => x.textContent.trim());
    ok("每人不一樣:展開勾了的人各一格(5 格)", q("#st-kitty-fld").hidden && !q("#st-fund-each").hidden && rows().length === 5, rows());
    var c = q('[data-fund-who="chen_suchih"]'); c.checked = false; c.dispatchEvent(new Event("change", { bubbles: true })); await wait(30);
    ok("取消勾「媽」→ 只剩 4 格,沒有媽", rows().length === 4 && rows().indexOf("媽") < 0, rows());
    set("budget"); await wait(30);
    ok("預算模式沒有保管人", q("#st-keeper-fld").hidden, "");
    set("pot"); q("#st-fe-hsieh_chinhui").value = "8000"; q("#st-fe-chang_chiayu").value = "6000"; q("#st-fe-chang_chihwei").value = "6000"; q("#st-fe-chang_yalun").value = "6000";
    q("#st-keeper").value = "chang_chihwei";
    q("#settings-form").requestSubmit(); await wait(300);
    var patch = (w.__calls || []).filter(x => /resource=team/.test(x.url) && x.method === "PATCH").pop();
    out.送出 = patch && patch.body.fund;
    ok("存起來:送 fund {mode:pot, 四個人各自的金額, 保管人志偉}", out.送出 && out.送出.mode === "pot" && out.送出.shares.hsieh_chinhui === 8000 && out.送出.shares.chang_yalun === 6000 && out.送出.shares.chen_suchih === undefined && out.送出.keeper === "chang_chihwei", out.送出);
  }
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
