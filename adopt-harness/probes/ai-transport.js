/* AI 按鈕串交通(2026-09-28):丟車票/訂位確認 → 打開「加一段交通」,讀到的都填好,人看過再存。
 * 已經有的那一段(同班次、同一天)要打開那一段來改,不是多加一筆。
 * 還量:送給 AI 的是這一團的事實(日期、成員、已經有的交通),不是寫死的東京五人行。
 * PAGE='/index.html?fake=member' 跑的是「團主沒開交通」的成員:要看到講清楚的一句話,按不下去。 */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var mode = (/[?&]fake=([a-z]+)/.exec(w.location.search) || [])[1] || "owner";
var sentCtx = null, next = null;
var real = w.fetch;
w.fetch = function (u, init) {
  if (/\/api\/ai/.test(String(u))) {
    try { sentCtx = JSON.parse(init.body).context; } catch (_) {}
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: next }) });
  }
  return real(u, init);
};
var leg = { kind: "", no: "", company: "", depart: "", from: "", arrive: "", to: "", code: "", dir: "", match: "", note: "", seats: [] };
/* 交通回來的形狀是 { intent, legs: [...], message } —— 一次可以好幾段 */
async function ask(r) {
  next = Object.assign({ title: "", day: "", time: "", note: "", message: "" }, r,
    r.legs ? { legs: r.legs.map(l => Object.assign({}, leg, l)) } : { legs: [] });
  q("#ai-btn").click(); await wait(80);
  q("#ai-text").value = "這張票"; q("#ai-form").requestSubmit(); await wait(300);
}
return (async function () {
  var out = { 角色: mode }, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  if (mode === "member" && !/[?&]can=[^&]*seat/.test(w.location.search)) {
    await ask({ intent: "transport", legs: [{ kind: "巴士", depart: "2026-10-05T07:10" }] });
    out.卡 = { 開著: !q("#ai-overlay").hidden, 說: txt("#ai-err"), 交通表單: !q("#flight-overlay").hidden, 許願表單: !q("#wish-add-overlay").hidden };
    ok("沒開交通的成員:留在 AI 視窗、講清楚,不會被倒進許願表", out.卡.開著 && /團主還沒開放/.test(out.卡.說) && !out.卡.交通表單 && !out.卡.許願表單, out.卡);
  } else {
    /* 1. 新的一段巴士 */
    await ask({ intent: "transport", message: "高速巴士的訂位確認", legs: [{ kind: "巴士", company: "WILLER", depart: "2026-10-05T07:10", arrive: "2026-10-05T09:00",
      from: "新宿", to: "河口湖站", code: "WL-777", dir: "其他", seats: [{ member: "chang_chiayu", seat: "3A" }] }] });
    out.送出的 = sentCtx && { days: sentCtx.days.length, members: sentCtx.members.map(m => m.name), legs: sentCtx.legs.length, trip: sentCtx.trip.name };
    ok("送給 AI 的是這一團的事實", out.送出的 && out.送出的.days === 6 && out.送出的.legs === 4 && out.送出的.trip === "東京五人行", out.送出的);
    out.巴士 = { AI關了: q("#ai-overlay").hidden, 表單開著: !q("#flight-overlay").hidden, 標題: txt("#fl-title"), 種類: q("#fl-kinds input:checked").value,
      公司: q("#fl-airline").value, 發車: q("#fl-depart").value, 從: q("#fl-from").value, 代號: q("#fl-code").value, 佳瑜: q("#fl-seat-chang_chiayu").value, 說: txt("#fl-ai") };
    ok("巴士:打開加一段交通,讀到的都填好", out.巴士.AI關了 && out.巴士.表單開著 && out.巴士.標題 === "加一段交通" && out.巴士.種類 === "巴士" &&
      out.巴士.公司 === "WILLER" && out.巴士.發車 === "2026-10-05T07:10" && out.巴士.代號 === "WL-777" && out.巴士.佳瑜 === "3A" && /AI 讀到的都填好了/.test(out.巴士.說), out.巴士);
    q("#flight-form").requestSubmit(); await wait(400);
    ok("存得進去", q("#flight-overlay").hidden && (w.__rows.flights || []).some(f => f.kind === "巴士" && f.code === "WL-777"), txt("#fl-err"));
    /* 2. 已經有的 MM626:模型沒給 id,靠班次 + 日期認出來 → 改那一段,座位換掉 */
    await ask({ intent: "transport", legs: [{ kind: "飛機", no: "MM626", depart: "2026-10-03T10:50", seats: [{ member: "chang_chiayu", seat: "30C" }] }] });
    out.MM626 = { 標題: txt("#fl-title"), 航班: q("#fl-no").value, 刪除鈕: !q("#fl-del").hidden, 佳瑜: q("#fl-seat-chang_chiayu").value, 阿輝: q("#fl-seat-hsieh_chinhui").value, 說: txt("#fl-ai") };
    ok("已經有的那一班:打開那一段來改、只換 AI 讀到的座位", out.MM626.標題 === "改這一段" && out.MM626.刪除鈕 && out.MM626.佳瑜 === "30C" && out.MM626.阿輝 === "27B" && /已經有了/.test(out.MM626.說), out.MM626);
    var n0 = (w.__rows.flights || []).length;
    q("#flight-form").requestSubmit(); await wait(400);
    ok("存了沒有多一筆", (w.__rows.flights || []).length === n0, (w.__rows.flights || []).length);
    /* 2b. 文字講去程、圖是回程:一次兩段 → 一張一張開,存了開下一張,跳過就關 */
    await ask({ intent: "transport", legs: [
      { kind: "船", company: "東海汽船", depart: "2026-10-04T08:00", from: "竹芝碼頭", to: "大島 岡田港" },
      { kind: "船", company: "東海汽船", depart: "2026-10-04T16:00", from: "大島 岡田港", to: "竹芝碼頭" }] });
    out.兩段 = { 第一張: txt("#fl-ai"), 從: q("#fl-from").value, 跳過鈕: !q("#fl-skip").hidden };
    q("#flight-form").requestSubmit(); await wait(400);
    out.兩段.第二張 = { 開著: !q("#flight-overlay").hidden, 說: txt("#fl-ai"), 從: q("#fl-from").value };
    ok("兩段:先開第 1 段,存了自動開第 2 段", /AI 讀到 2 段,這是第 1 段/.test(out.兩段.第一張) && out.兩段.從 === "竹芝碼頭" && out.兩段.跳過鈕 &&
      out.兩段.第二張.開著 && /第 2 段/.test(out.兩段.第二張.說) && out.兩段.第二張.從 === "大島 岡田港", out.兩段);
    q("#fl-skip").click(); await wait(100);
    var ships = (w.__rows.flights || []).filter(f => f.kind === "船").length;
    ok("第 2 段按跳過:表單關掉,只存了第 1 段", q("#flight-overlay").hidden && ships === 1, { 開著: !q("#flight-overlay").hidden, 船: ships });
    /* 3. AI 看成許願,人自己換成交通 → 打開一張空的交通表 */
    await ask({ intent: "wish", title: "某個地方", message: "" });
    q("#ai-kind").value = "transport"; q("#ai-kind").dispatchEvent(new w.Event("change", { bubbles: true }));
    q("#ai-confirm").requestSubmit(); await wait(150);
    ok("人換成交通按確定 → 打開加一段交通", !q("#flight-overlay").hidden && txt("#fl-title") === "加一段交通", txt("#fl-title"));
    q("#fl-cancel").click();
  }
  out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過";
  out.errors = w.__errors || [];
  return out;
})();
