/* AI 讀到好幾筆:隨意換筆編、最後一起存(2026-10-12,Lulu:「不一定要照順序編完一筆才能下一筆,可隨時換筆編;
 * 全部編完才有一個最後的確定存檔,不需要每筆有一個存檔」)。她選的:上面一排編號 + 左右滑;每一筆都看得到「全部存起來」。
 *   WIDTH=390 ./probe.sh probes/ai-batch.js                       團主:交通 3 段、交通+花費、行程 2 筆、取消、單筆
 *   PAGE='/index.html?fake=member' WIDTH=390 ./probe.sh probes/ai-batch.js   一般成員:許願 2 筆(許願表) */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var member = /fake=member/.test((w.frameElement && w.frameElement.getAttribute("src")) || "");
var next = null, real = w.fetch;
w.fetch = function (u, init) {
  if (/\/api\/ai/.test(String(u)) && init && init.method === "POST") return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: next }) });
  return real(u, init);
};
var base = { title: "", day: "", time: "", note: "", amount: 0, currency: "", date: "", category: "", legs: [], items: [], parts: [], message: "" };
var L = { kind: "船", no: "", company: "東海汽船", code: "", dir: "", match: "", note: "", seats: [], arrive: "" };
var calls = (re, m) => (w.__calls || []).filter(c => re.test(c.url) && (!m || c.method === m));
var vis = id => !q("#" + id).hidden;
var tabs = form => qa("#" + form + " .batch-tabs:not([hidden]) .rm-chip").map(c => c.textContent.trim());
var tabOn = form => { var c = qa("#" + form + " .batch-tabs .rm-chip").findIndex(c => c.querySelector("input").checked); return c; };
var bad = form => qa("#" + form + " .batch-tabs .rm-chip.bt-bad").map(c => c.textContent.trim());
/* 「全部存起來」在卡片外面(整疊下面),卡片裡原本那顆藏起來(2026-10-12,Lulu) */
var barBtn = ov => q("#" + ov + " .batch-bar:not([hidden]) [data-batch-save]");
var barTxt = ov => { var b = barBtn(ov); return b ? b.textContent.trim() : ""; };
var clickTab = async (form, i) => { var inp = qa("#" + form + " .batch-tabs input")[i]; inp.click(); await wait(120); };
async function ask(result) { next = result; addAI(); await wait(100); q("#ai-text").value = "好幾筆"; q("#ai-form").requestSubmit(); await wait(450); }
function swipe(form, dx) {
  var f = q("#" + form), r = f.getBoundingClientRect(), h = f.querySelector("h2").getBoundingClientRect();
  var y = h.top + h.height / 2, x = r.left + r.width / 2;
  var pe = (t, xx) => new w.PointerEvent(t, { clientX: xx, clientY: y, bubbles: true, pointerId: 3, pointerType: "touch" });
  f.querySelector("h2").dispatchEvent(pe("pointerdown", x)); f.querySelector("h2").dispatchEvent(pe("pointerup", x + dx));
}
/* 按著拖(2026-10-12,Lulu:「手指按著時往左,卡片就往左」):down → 幾次 move → up;slow = 拖完停一下再放(不算甩) */
async function drag(form, from, dxs, slow) {
  var f = q("#" + form), r = (from || f.querySelector("h2")).getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  var pe = (t, xx) => new w.PointerEvent(t, { clientX: xx, clientY: y, bubbles: true, pointerId: 7, pointerType: "touch" });
  (from || f.querySelector("h2")).dispatchEvent(pe("pointerdown", x));
  var tf = [];
  for (var dx of dxs) { f.dispatchEvent(pe("pointermove", x + dx)); tf.push(f.style.transform); await wait(16); }
  if (slow) await wait(400);
  f.dispatchEvent(pe("pointerup", x + dxs[dxs.length - 1]));
  return tf;
}
return (async function () {
  await wait(300);
  var out = {}, fails = [];
  var ok = (n, c, g) => { if (!c) fails.push(n + " ← " + JSON.stringify(g)); };

  if (member) {
    var w0 = (w.__rows.wishes || []).length;
    await ask(Object.assign({}, base, { intent: "wish", items: [Object.assign({}, base, { title: "淺草寺" }), Object.assign({}, base, { title: "晴空塔" })] }));
    out.許願 = { 許願表: vis("wish-add-overlay"), 編號: tabs("wish-form"), 按鈕: barTxt("wish-add-overlay"), 卡片裡的藏了: q("#wf-submit").hidden, 標題: q("#wf-title").value };
    ok("一般成員許願 2 筆:許願表、兩個編號、按鈕「全部存起來(2 筆)」", out.許願.許願表 && out.許願.編號.join() === "1,2" && out.許願.按鈕 === "全部存起來(2 筆)" && out.許願.卡片裡的藏了 && out.許願.標題 === "淺草寺", out.許願);
    q("#wf-note").value = "要排隊";
    await clickTab("wish-form", 1);
    ok("點 2 → 晴空塔", q("#wf-title").value === "晴空塔", q("#wf-title").value);
    await clickTab("wish-form", 0);
    ok("點回 1 → 改的備註還在", q("#wf-note").value === "要排隊", q("#wf-note").value);
    q("#wish-form").requestSubmit(); await wait(600);
    var ws = (w.__rows.wishes || []).slice(w0).map(x => x.title + "/" + (x.note || ""));
    ok("全部存起來 → 兩筆都許了(第一筆帶改過的備註)、關掉", !vis("wish-add-overlay") && ws.join() === "淺草寺/要排隊,晴空塔/", ws);
  } else {
    /* ---- 1. 交通 3 段 ---- */
    var f0 = calls(/resource=flights/, "POST").length;
    await ask(Object.assign({}, base, { intent: "transport", legs: [
      Object.assign({}, L, { depart: "2026-10-04T08:00", from: "竹芝碼頭", to: "大島" }),
      Object.assign({}, L, { depart: "2026-10-04T13:00", from: "大島", to: "神津島" }),
      Object.assign({}, L, { depart: "2026-10-05T09:00", from: "神津島", to: "竹芝碼頭" })] }));
    var fr = q("#flight-form").getBoundingClientRect(), g2 = q("#flight-form").parentElement.querySelector(".g2").getBoundingClientRect(), br = barBtn("flight-overlay") && barBtn("flight-overlay").getBoundingClientRect();
    out.交通 = { 開著: vis("flight-overlay"), 編號: tabs("flight-form"), 選著: tabOn("flight-form"), 按鈕: barTxt("flight-overlay"), 卡片裡的藏了: q("#fl-save").hidden, 不要: txt("#fl-skip"), 從: q("#fl-from").value,
      按鈕在整疊下面: !!br && br.top > g2.bottom && br.top > fr.bottom && br.bottom <= w.innerHeight, 後面疊: [!!q("#flight-form").parentElement.querySelector(".g1:not([hidden])"), !!q("#flight-form").parentElement.querySelector(".g2:not([hidden])")] };
    ok("交通 3 段:一批、上面 1 2 3、選著 1;「全部存起來(3 筆)」在整疊卡片外面下面(卡片裡那顆藏起來)、卡片裡有「不要這筆」", out.交通.開著 && out.交通.編號.join() === "1,2,3" && out.交通.選著 === 0 &&
      out.交通.按鈕 === "全部存起來(3 筆)" && out.交通.卡片裡的藏了 && out.交通.按鈕在整疊下面 && out.交通.不要 === "不要這筆" && out.交通.從 === "竹芝碼頭", out.交通);
    q("#fl-note").value = "第一段改過";
    var inp3 = qa("#flight-form .batch-tabs input")[2]; inp3.click(); await wait(40);
    var fly = q("#flight-form").parentElement.querySelector(".deck-fly");
    out.翻牌 = { 有飛的那張: !!fly, 飛的沒有id: !!fly && !fly.querySelector("[id]"), 真的那張已經換: q("#fl-from").value };
    ok("點 3 → 翻牌:一張複製的卡飛走(不帶 id),真的那張已經換成第 3 段", out.翻牌.有飛的那張 && out.翻牌.飛的沒有id && out.翻牌.真的那張已經換 === "神津島", out.翻牌);
    await wait(800);
    ok("動畫完 → 飛的那張拿掉、停在第 3 段、後面照樣疊兩張(一疊會循環的牌)", !q("#flight-form").parentElement.querySelector(".deck-fly") && tabOn("flight-form") === 2 &&
      !!q("#flight-form").parentElement.querySelector(".g2:not([hidden])"), tabOn("flight-form"));
    /* 往右滑 = 下一筆(1 → 2 → 3)、往左滑 = 上一筆(2026-10-12,Lulu 糾正:之前做反了) */
    swipe("flight-form", 120); await wait(700);
    ok("在最後一段往右滑 → 回到第 1 段(循環)", q("#fl-from").value === "竹芝碼頭" && tabOn("flight-form") === 0, q("#fl-from").value);
    swipe("flight-form", -120); await wait(700);
    ok("在第 1 段往左滑 → 繞到最後一段", q("#fl-from").value === "神津島" && tabOn("flight-form") === 2, q("#fl-from").value);
    await clickTab("flight-form", 0);
    ok("點回 1 → 剛剛改的還在(草稿)", q("#fl-note").value === "第一段改過" && q("#fl-from").value === "竹芝碼頭", q("#fl-note").value);
    swipe("flight-form", 120); await wait(120);
    ok("往右滑 → 下一筆(第 2 段)", q("#fl-from").value === "大島" && tabOn("flight-form") === 1, q("#fl-from").value);
    swipe("flight-form", -120); await wait(120);
    ok("往左滑 → 上一筆(第 1 段)", q("#fl-from").value === "竹芝碼頭", q("#fl-from").value);
    await wait(500);
    /* 按著拖:卡片跟著手指走;不夠遠慢慢放 → 彈回、不換;夠遠 → 換;從打字的格子開始拖不算 */
    await clickTab("flight-form", 0); await wait(500);
    var tfs = await drag("flight-form", null, [-12, -30, -50], true); await wait(300);
    out.拖 = { 跟著走: tfs, 放手後: q("#flight-form").style.transform, 還是: q("#fl-from").value };
    ok("按著往左拖 50px:卡片跟著往左(translateX 負的、有一點轉);慢慢放 → 彈回中間、不換筆", /translateX\(-50px\)/.test(tfs[2]) && /rotate\(-/.test(tfs[2]) &&
      out.拖.放手後 === "" && out.拖.還是 === "竹芝碼頭", out.拖);
    var tfs2 = await drag("flight-form", null, [20, 70, 130]); await wait(80);
    out.拖過 = { 跟著走: tfs2[2], 換到: q("#fl-from").value, 飛的那張: !!q("#flight-form").parentElement.querySelector(".deck-fly"), 真的那張歸位: q("#flight-form").style.transform };
    ok("往右拖 130px 放手 → 翻到下一筆(第 2 段),飛出去的那張從放手的位置接著飛,真的那張歸位", /translateX\(130px\)/.test(out.拖過.跟著走) && out.拖過.換到 === "大島" &&
      out.拖過.飛的那張 && out.拖過.真的那張歸位 === "", out.拖過);
    await wait(700);
    var tfs3 = await drag("flight-form", null, [-20, -70, -130]); await wait(700);
    ok("往左拖 130px → 卡片往左跟著走、放手翻回上一筆(第 1 段)", /translateX\(-130px\)/.test(tfs3[2]) && /rotate\(-/.test(tfs3[2]) && q("#fl-from").value === "竹芝碼頭", { 跟著走: tfs3[2], 換到: q("#fl-from").value });
    var tfs4 = await drag("flight-form", q("#fl-from"), [-30, -80, -130]); await wait(300);
    ok("從打字的格子開始拖:卡片不動、不換筆", !tfs4[2] && q("#fl-from").value === "竹芝碼頭", { 跟著走: tfs4[2], 還是: q("#fl-from").value });

    /* 「全部存起來」左右各一顆:‹ 往左滑(上一筆)、› 往右滑(下一筆);中間那顆變短。兩顆是 Outlined、方的、跟中間一樣高 */
    var bL = q("#flight-overlay [data-batch-left]"), bR = q("#flight-overlay [data-batch-right]"), bM = barBtn("flight-overlay");
    var lr = bL.getBoundingClientRect(), mr = bM.getBoundingClientRect(), rr = bR.getBoundingClientRect(), barR = bM.parentElement.getBoundingClientRect(), ls = w.getComputedStyle(bL), ms = w.getComputedStyle(bM);
    var tok = v => { var i = d.createElement("i"); d.body.appendChild(i); i.style.color = "var(" + v + ")"; var c = w.getComputedStyle(i).color; i.remove(); return c; };
    out.左右鈕 = { 順序: lr.right <= mr.left && mr.right <= rr.left, 方的: Math.abs(lr.width - lr.height) <= 1 && Math.abs(rr.width - rr.height) <= 1, 一樣高: Math.abs(lr.height - mr.height) <= 1 && Math.abs(rr.height - mr.height) <= 1,
      中間變短: mr.width < barR.width - lr.width - rr.width, 框: ls.borderTopColor === tok("--ds-sys-shared-color-outline") && parseFloat(ls.borderTopWidth) > 0, 圖示色: ls.color === tok("--ds-sys-shared-color-primary"),
      圓角一樣: ls.borderTopLeftRadius === ms.borderTopLeftRadius, 有說明: !!bL.getAttribute("aria-label") && !!bR.getAttribute("aria-label") };
    ok("「全部存起來」左右各一顆圖示鈕:← 中 →、方的、跟中間一樣高、中間變短;Outlined 的框和字色、圓角跟中間一樣", Object.values(out.左右鈕).every(Boolean), out.左右鈕);
    await clickTab("flight-form", 0); await wait(500);
    bR.click(); await wait(80);
    ok("按 › → 卡片往右翻、到下一筆(第 2 段)", q("#fl-from").value === "大島" && !!q("#flight-form").parentElement.querySelector(".deck-fly"), q("#fl-from").value);
    await wait(700);
    bL.click(); await wait(700);
    ok("按 ‹ → 回到上一筆(第 1 段)", q("#fl-from").value === "竹芝碼頭", q("#fl-from").value);
    bL.click(); await wait(700);
    ok("在第 1 段按 ‹ → 繞到最後一段(循環)", q("#fl-from").value === "神津島", q("#fl-from").value);

    await clickTab("flight-form", 1);
    q("#fl-skip").click(); await wait(150);
    out.拿掉 = { 編號: tabs("flight-form"), 按鈕: barTxt("flight-overlay"), 從: q("#fl-from").value };
    ok("第 2 段按「不要這筆」→ 剩 2 筆、換到下一筆(原本的第 3 段)", out.拿掉.編號.join() === "1,2" && out.拿掉.按鈕 === "全部存起來(2 筆)" && out.拿掉.從 === "神津島", out.拿掉);
    q("#fl-depart").value = "";
    await clickTab("flight-form", 0);
    q("#flight-form").requestSubmit(); await wait(300);
    out.檢查 = { 跳到: tabOn("flight-form"), 標紅: bad("flight-form"), 講: txt("#fl-err"), 存了: calls(/resource=flights/, "POST").length - f0 };
    ok("有一筆沒填好 → 一筆都不存、跳到那一筆、編號標紅、講缺什麼", out.檢查.跳到 === 1 && out.檢查.標紅.join() === "2" && /時間要填/.test(out.檢查.講) && out.檢查.存了 === 0, out.檢查);
    q("#fl-depart").value = "2026-10-05T09:00";
    q("#flight-form").requestSubmit(); await wait(1200);
    var fp = calls(/resource=flights/, "POST").slice(f0).map(c => c.body.from + "/" + (c.body.note || ""));
    out.存 = { 存了: fp, 關了: !vis("flight-overlay"), 說: txt("#sync"), 按鈕換回: txt("#fl-save"), 卡片裡的回來了: !q("#fl-save").hidden, 外面的收了: !barBtn("flight-overlay") };
    ok("全部存起來 → 兩段都存(第一段帶改過的備註)、關掉、講「存好了 2 筆」、卡片裡的「存起來」回來、外面那顆收起來", out.存.存了.join() === "竹芝碼頭/第一段改過,神津島/" && out.存.關了 &&
      /存好了 2 筆/.test(out.存.說) && out.存.按鈕換回 === "存起來" && out.存.卡片裡的回來了 && out.存.外面的收了, out.存);

    /* ---- 2. 交通 + 花費(複合) ---- */
    var LEG = { kind: "火車", no: "125", company: "台灣高鐵", from: "南港", to: "左營", depart: "2026-10-06T11:20", arrive: "2026-10-06T13:05", code: "", dir: "其他", match: "", note: "", seats: [{ member: "chang_chiayu", seat: "5車 2C" }] };
    var EXP = { title: "高鐵 南港→左營", day: "", time: "", note: "", amount: 1530, currency: "TWD", date: "2026-10-06", category: "交通" };
    var fl1 = calls(/resource=flights/, "POST").length, ex1 = calls(/resource=expenses/, "POST").length;
    await ask(Object.assign({}, base, { intent: "transport", legs: [LEG], parts: [{ intent: "transport", legs: [LEG], items: [] }, { intent: "expense", legs: [], items: [EXP] }] }));
    out.複合 = { 交通: vis("flight-overlay"), 編號: tabs("flight-form"), 說: txt("#fl-ai") };
    ok("複合:編號寫種類「1 交通」「2 花費」、先開交通", out.複合.交通 && out.複合.編號.join() === "1 交通,2 花費" && /交通 1、花費 1/.test(out.複合.說), out.複合);
    await clickTab("flight-form", 1);
    out.複合2 = { 交通關了: !vis("flight-overlay"), 記一筆: vis("exp-edit-overlay"), 編號: tabs("exp-edit-form"), 選著: tabOn("exp-edit-form"), 金額: q("#xe-amount").value, 誰分攤: qa("#xe-who input:checked").map(i => i.value), 誰付: q("#xe-payer").value };
    ok("點「2 花費」→ 換成記一筆(交通那張收起來)、¥… 填好、誰分攤只勾有座位的佳瑜、誰付的空著", out.複合2.交通關了 && out.複合2.記一筆 && out.複合2.編號.join() === "1 交通,2 花費" &&
      out.複合2.選著 === 1 && out.複合2.金額 === "1530" && out.複合2.誰分攤.join() === "chang_chiayu" && out.複合2.誰付 === "", out.複合2);
    swipe("exp-edit-form", 120); await wait(150);
    ok("在記一筆往右滑 → 回到交通(換回交通那張)", vis("flight-overlay") && !vis("exp-edit-overlay") && q("#fl-no").value === "125", "");
    q("#flight-form").requestSubmit(); await wait(1200);
    out.複合存 = { 交通: calls(/resource=flights/, "POST").length - fl1, 花費: calls(/resource=expenses/, "POST").length - ex1, 關: !vis("flight-overlay") && !vis("exp-edit-overlay") };
    ok("在交通那張按「全部存起來」→ 交通、花費都存、都關", out.複合存.交通 === 1 && out.複合存.花費 === 1 && out.複合存.關, out.複合存);

    /* ---- 3. 行程 2 筆(確認卡) ---- */
    var s0 = (w.__rows.itinerary || []).length;
    await ask(Object.assign({}, base, { intent: "stop", items: [Object.assign({}, base, { title: "築地", day: "2026-10-04", time: "08:00" }), Object.assign({}, base, { title: "銀座", day: "2026-10-04", time: "" })] }));
    out.行程 = { 確認卡: vis("ai-overlay") && !q("#ai-confirm").hidden, 編號: tabs("ai-confirm"), 按鈕: barTxt("ai-overlay") };
    ok("行程 2 筆:確認卡、兩個編號、「全部存起來(2 筆)」", out.行程.確認卡 && out.行程.編號.join() === "1,2" && out.行程.按鈕 === "全部存起來(2 筆)", out.行程);
    q("#ai-confirm").requestSubmit(); await wait(300);
    ok("第 2 筆沒填時間 → 跳到 2、標紅、講要時間", tabOn("ai-confirm") === 1 && bad("ai-confirm").join() === "2" && /要有時間/.test(txt("#ai-cerr")), { 跳: tabOn("ai-confirm"), 紅: bad("ai-confirm"), 講: txt("#ai-cerr") });
    q("#ai-time").value = "11:00";
    q("#ai-confirm").requestSubmit(); await wait(800);
    var st = (w.__rows.itinerary || []).slice(s0).map(x => x.title + " " + x.time);
    ok("補上時間 → 兩筆行程都加了、關掉", !vis("ai-overlay") && st.join() === "築地 08:00,銀座 11:00", st);

    /* ---- 4. 取消 = 整批不要 ---- */
    var f2 = calls(/resource=flights/, "POST").length;
    await ask(Object.assign({}, base, { intent: "transport", legs: [Object.assign({}, L, { depart: "2026-10-04T08:00", from: "A", to: "B" }), Object.assign({}, L, { depart: "2026-10-04T10:00", from: "B", to: "C" })] }));
    q("#fl-cancel").click(); await wait(200);
    ok("取消 → 全部關掉、什麼都沒存、卡片裡的「存起來」回來、外面那顆和編號收起來", !vis("flight-overlay") && calls(/resource=flights/, "POST").length === f2 && txt("#fl-save") === "存起來" &&
      !q("#fl-save").hidden && !barBtn("flight-overlay") && !tabs("flight-form").length, txt("#fl-save"));

    /* ---- 5. 只有一筆:照舊 ---- */
    await ask(Object.assign({}, base, { intent: "expense", items: [Object.assign({}, base, { title: "便利商店", amount: 600, currency: "JPY", date: "2026-10-05", category: "餐飲" })] }));
    ok("只有一筆:沒有編號、卡片裡的「存起來」、外面沒有那顆", vis("exp-edit-overlay") && !tabs("exp-edit-form").length && txt("#xe-save") === "存起來" && !q("#xe-save").hidden && !barBtn("exp-edit-overlay"), { 編號: tabs("exp-edit-form"), 按鈕: txt("#xe-save") });
    q("#xe-cancel").click(); await wait(100);
  }
  out.結論 = fails.length ? "✗ " + fails.join(" ;; ") : "全部通過"; out.errors = w.__errors || [];
  return out;
})();
