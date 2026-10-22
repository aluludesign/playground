/* 預收(2026-10-19,Lulu:「預算模式不要留,只有金錢實際流動才記,所以記成預收、收款人」;原 10-02 的共同基金)。
 *   PAGE='/index.html?fund=pot'             預收,收款人佳瑜:結清方式算得平、收款人卡片「手上預收還剩/預收不夠,先墊」、付款人可選預收、補交預收
 *   PAGE='/index.html?fund=pot&keeper=0'    存的收款人是空的 → 當團主(fixture 的團主是阿輝;不再有「不指定」)
 *   PAGE='/index.html?fund=pot&keeper=gone' 存的收款人已經離團 → 不改成團主,結清寫「預收」那一方,設定裡提醒重選
 *   PAGE='/index.html?fund=diff'            每人不一樣:只列有交的人
 *   PAGE='/index.html?fund=boss'            像東京 Pa Pa 造:收款人是團主、自己沒交;進度條 = 交錢的人分到的花費 ÷ 收了
 *   PAGE='/index.html?fund=low'             交得比分到的少:進度條滿、.over、「不夠」
 *   PAGE='/index.html'                      設定:舊的「基金」30,000 讀成「沒有」、切到預收帶出金額(5 人都勾);收款人必填、預選團主阿輝
 *   PAGE='/index.html?nokitty=1'            設定:以前沒有任何出資 → 切到預收,誰有交預設全部、不勾收款人 */
var q = s => d.querySelector(s), qa = s => Array.from(d.querySelectorAll(s)), wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
return (async function () {
  await wait(300);
  var nav = (w.performance.getEntriesByType("navigation")[0] || {}).name || "", bad = [], out = {};
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var num = (t, re) => Number(((re.exec(t) || [])[1] || "").replace(/,/g, ""));
  var pot = /fund=pot/.test(nav), diff = /fund=diff/.test(nav), boss = /fund=boss/.test(nav), low = /fund=low/.test(nav), keeper0 = /keeper=0/.test(nav), gone = /keeper=gone/.test(nav);
  q("#tab-split").click(); await wait(100);
  out.標題 = txt("#panel-split .sec-head h2");
  out.預收 = txt("#fund-sub") + " | " + txt("#fund");
  out.轉帳 = qa("#transfers .pay").map(x => x.textContent.replace(/\s+/g, " ").trim());
  out.卡片 = qa("#people .person").map(x => x.textContent.replace(/\s+/g, " ").trim());
  out.結清提示 = q("#fund-transfer-note") && !q("#fund-transfer-note").hidden ? txt("#fund-transfer-note") : "";
  if (pot) {
    ok("分帳頁那一塊叫「預收」;共 25,000、列出三個交的人;寫「預收付了」「交了」", out.標題 === "預收" && /25,000/.test(out.預收) && qa("#fund .fp").length === 3 && /用了 NT\$/.test(out.預收) && /還剩|不夠/.test(out.預收) && /交了/.test(out.預收), out.預收);
    if (gone) {
      ok("收款人已經離團:不改成團主,結清方式出現「預收」那一方,提醒重選", out.轉帳.some(t => /預收/.test(t)) && /收款人已經不在這一團/.test(out.預收) && !/錢在 佳瑜/.test(out.預收), { 轉帳: out.轉帳, 預收: out.預收 });
    } else {
      var K = keeper0 ? "阿輝" : "佳瑜";
      ok("收款人" + K + "(存空的就當團主):標題「" + K + "收」、錢在" + K + "手上、結清方式不出現「預收」", new RegExp(K + "收").test(out.預收) && new RegExp("錢在 " + K + " 手上").test(out.預收) && !out.轉帳.some(t => /預收/.test(t)), { 預收: out.預收, 轉帳: out.轉帳 });
      ok("收款人卡片有「手上預收還剩」或「預收不夠,先墊」", out.卡片.some(t => t.indexOf(K) === 0 && /手上預收還剩|預收不夠,先墊/.test(t)), out.卡片);
      ok("結清方式下面講預收怎麼算進去(看收款人自己的淨額)", new RegExp("(由 " + K + " 轉|已經從大家要給 " + K + " 的錢裡扣掉了)").test(out.結清提示), out.結清提示);
    }
    ok("交了錢的人卡片有「交了預收」", out.卡片.filter(t => /交了預收/.test(t)).length === 3, out.卡片);
    q("#tab-cost").click(); await wait(80);
    out.第一格 = txt("#cost-stats .stat");
    ok("花費第一格「預收剩餘」、下面寫「用了」(交得比分到的少就「不夠了,要再收」)", /預收剩餘/.test(out.第一格) && /用了 NT\$|不夠了,要再收/.test(out.第一格), out.第一格);
    addBy("expense"); await wait(80);
    out.付款人選項 = qa("#xe-payer option").map(o => o.textContent);
    ok("記帳:付款人多一個「預收(X收的錢)」(收款人離團就只寫「預收」)", out.付款人選項.indexOf(gone ? "預收" : "預收(" + (keeper0 ? "阿輝" : "佳瑜") + "收的錢)") >= 0, out.付款人選項);
    q("#xe-cancel") && q("#xe-cancel").click();
    q("#tab-split").click(); await wait(80);
    var btn = q("#fund-top-btn");
    ok("團主看得到「補交預收」", !!btn && btn.textContent.trim() === "補交預收", btn && btn.textContent);
    if (btn) {
      btn.click(); await wait(80);
      ok("補交預收:列出全部 5 個成員,先勾交過的 3 個;標題「補交預收」", qa("#ft-who input").length === 5 && qa("#ft-who input:checked").length === 3 && txt("#ft-title") === "補交預收", qa("#ft-who input").length);
      q("#ft-amt").value = "2000"; q("#fund-top-form").requestSubmit(); await wait(300);
      out.補完 = txt("#fund-sub");
      ok("補完:共變成 31,000", /31,000/.test(out.補完), out.補完);
    }
    if (!gone && !keeper0) {
      /* 記一筆「付款人 = 預收」→ 團的設定想改成沒有,要先擋下來(伺服器也擋) */
      q("#tab-cost").click(); await wait(80); addBy("expense"); await wait(100);
      q("#xe-title").value = "租車"; q("#xe-amount").value = "9000"; q("#xe-amount").dispatchEvent(new Event("input", { bubbles: true }));
      q("#xe-payer").value = "fund"; q("#xe-payer").dispatchEvent(new Event("change", { bubbles: true }));
      q("#exp-edit-form").requestSubmit(); await wait(400);
      q("#menu-btn").click(); await wait(60); q("#cloud-set").click(); await wait(150);
      var md = q("#st-fund-mode"); md.value = "none"; md.dispatchEvent(new Event("change"));
      var p0 = (w.__calls || []).filter(x => /resource=team/.test(x.url) && x.method === "PATCH").length;
      q("#settings-form").requestSubmit(); await wait(300);
      out.離開預收 = { 錯誤: txt("#st-err"), 送了: (w.__calls || []).filter(x => /resource=team/.test(x.url) && x.method === "PATCH").length - p0 };
      ok("還有預收付的帳 → 設定先擋:「還有 1 筆是預收付的,先改付款人」,沒送出去", /還有 1 筆是預收付的,先改付款人/.test(out.離開預收.錯誤) && out.離開預收.送了 === 0, out.離開預收);
      q("#st-cancel").click(); await wait(60);
    }
    if (gone) {
      q("#menu-btn").click(); await wait(60); q("#cloud-set").click(); await wait(150);
      ok("設定裡提醒「收款人已經不在這一團,請團主重選」", !q("#st-keeper-gone").hidden, "");
      q("#st-cancel").click();
    }
  } else if (diff) {
    ok("每人不一樣:標題寫「阿輝收 · 每人不一樣」,只列有交的兩個人", /阿輝收 · 每人不一樣/.test(out.預收) && qa("#fund .fp").length === 2, out.預收);
  } else if (low) {
    ok("交得比分到的少:進度條滿 100%、.over、右邊寫「不夠」", q("#fund .fund-bar").classList.contains("over") && q("#fund .fund-bar i").style.width === "100%" && /不夠/.test(txt("#fund .fund-top")), txt("#fund .fund-top"));
    q("#tab-cost").click(); await wait(80);
    ok("花費第一格:預收剩餘、「不夠了,要再收」", /預收剩餘/.test(txt("#cost-stats .stat")) && /不夠了,要再收/.test(txt("#cost-stats .stat")), txt("#cost-stats .stat"));
  } else if (boss) {
    ok("收款人是團主、自己沒交:「阿輝收 · 每人 NT$30,000 · 共 NT$90,000」", /阿輝收 · 每人 NT\$30,000 · 共 NT\$90,000/.test(txt("#fund-sub")), txt("#fund-sub"));
    /* 進度條 = 交錢的人分到的花費加總 ÷ 收了(2026-10-19 改;以前是「付款人 = 預收」的帳,帳多半記成個人付就永遠 0) */
    var used = num(txt("#fund .fund-top"), /用了 NT\$([\d,]+)/), left = num(txt("#fund .fund-top"), /還剩 NT\$([\d,]+)/);
    var rowsUsed = qa("#fund .fp").map(x => num(x.textContent.replace(/\s+/g, " "), /用 NT\$([\d,]+)/)).reduce((a, b) => a + b, 0);
    var barW = parseFloat(q("#fund .fund-bar i").style.width);
    out.進度條 = { 用了: used, 還剩: left, 各列用加總: rowsUsed, 寬: barW };
    ok("上面「用了」= 下面每人「用」的加總(差 1 元內)、還剩 = 90,000 − 用了、進度條寬 = 用了 ÷ 90,000;說明寫定義",
      used > 0 && Math.abs(used - rowsUsed) <= 2 && Math.abs(left - (90000 - used)) <= 1 && Math.abs(barW - used / 90000 * 100) < 0.5 && /用了 = 交錢的人分到的花費/.test(txt("#fund")), out.進度條);
    q("#tab-cost").click(); await wait(80);
    ok("花費第一格:預收剩餘 = 還剩、寫「用了」", num(txt("#cost-stats .stat"), /預收剩餘\s*NT\$([\d,]+)/) === left && /用了 NT\$/.test(txt("#cost-stats .stat")), txt("#cost-stats .stat"));
    q("#tab-split").click(); await wait(80);
    /* 每人那一排:交了、用掉(分攤到的所有花費)、剩 —— 沒自己另外付錢的人,剩的就是結清時阿輝要退給他的 */
    out.每人 = qa("#fund .fp").map(x => x.textContent.replace(/\s+/g, " ").trim());
    var yalun = out.每人.find(t => /雅倫/.test(t)) || "", yCard = out.卡片.find(t => t.indexOf("雅倫") === 0) || "";
    ok("預收每人一排:交了 · 用 · 剩;雅倫(沒自己付過)剩的 = 卡片上應收回", /交了 NT\$30,000 · 用 NT\$[\d,]+ · 剩 NT\$[\d,]+/.test(yalun) &&
      num(yalun, /剩 NT\$([\d,]+)/) === num(yCard, /應收回\s*NT\$([\d,]+)/), { 雅倫: yalun, 卡片: yCard });
    ok("阿輝卡片有「手上預收還剩 NT$90,000」、沒有「交了預收」(這一團沒有預收付的帳)", out.卡片.some(t => t.indexOf("阿輝") === 0 && /手上預收還剩\s*NT\$90,000/.test(t) && !/交了預收/.test(t)), out.卡片);
  } else {
    q("#menu-btn").click(); await wait(60); q("#cloud-set").click(); await wait(150);
    var mode = q("#st-fund-mode"), set = v => { mode.value = v; mode.dispatchEvent(new Event("change")); };
    out.模式選項 = qa("#st-fund-mode option").map(o => o.value + ":" + o.textContent);
    ok("模式只剩兩種:沒有、有預收", out.模式選項.join() === "none:沒有,pot:有預收(先把錢交給收款人)", out.模式選項);
    ok("舊的團(只有「基金」30,000):讀成「沒有」,下面收起來", mode.value === "none" && q("#st-fund-box").hidden, mode.value);
    set("pot"); await wait(30);
    var fresh = /nokitty=1/.test(nav);
    out.收款人 = { 值: q("#st-keeper").value, 選項: qa("#st-keeper option").map(o => o.value), 在最上面: q("#st-fund-box").firstElementChild === q("#st-keeper-fld"), 標籤: txt("#st-keeper-fld .rm-label") };
    ok("切到預收:收款人在最上面、叫「收款人」、預選團主阿輝、沒有「不指定」", out.收款人.在最上面 && out.收款人.標籤 === "收款人" && out.收款人.值 === "hsieh_chinhui" && out.收款人.選項.indexOf("") < 0, out.收款人);
    var checked = qa("[data-fund-who]:checked").map(x => x.dataset.fundWho);
    if (fresh) ok("以前沒有任何出資:誰有交預設全部成員、不勾收款人阿輝(4 人)", checked.length === 4 && checked.indexOf("hsieh_chinhui") < 0, checked);
    else ok("舊的「基金」30,000:帶出每人一樣 30,000、照原本的出資勾 5 人", q("#st-fund-same1").checked && q("#st-kitty").value === "30000" && checked.length === 5, { v: q("#st-kitty").value, 勾: checked });
    if (!fresh) { var c0 = q('[data-fund-who="hsieh_chinhui"]'); c0.checked = false; c0.dispatchEvent(new Event("change", { bubbles: true })); await wait(30); }
    q("#st-fund-same0").checked = true; q("#st-fund-same0").dispatchEvent(new Event("change", { bubbles: true })); await wait(30);
    var rows = () => qa("[data-fund-row]").filter(x => !x.hidden).map(x => x.textContent.trim());
    ok("每人不一樣:勾了的人各一格(4 格)", q("#st-kitty-fld").hidden && !q("#st-fund-each").hidden && rows().length === 4, rows());
    q("#st-fe-chang_chiayu").value = "8000"; q("#st-fe-chang_chihwei").value = "6000"; q("#st-fe-chang_yalun").value = "6000"; q("#st-fe-chen_suchih").value = "6000";
    q("#st-keeper").value = "chang_chihwei";
    q("#settings-form").requestSubmit(); await wait(300);
    var patch = (w.__calls || []).filter(x => /resource=team/.test(x.url) && x.method === "PATCH").pop();
    out.送出 = patch && patch.body.fund;
    ok("存起來:送 fund {mode:pot, 四個人各自的金額(阿輝沒交), 收款人志偉}", out.送出 && out.送出.mode === "pot" && out.送出.shares.chang_chiayu === 8000 && out.送出.shares.chen_suchih === 6000 &&
      out.送出.shares.hsieh_chinhui === undefined && out.送出.keeper === "chang_chihwei", out.送出);
  }
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
