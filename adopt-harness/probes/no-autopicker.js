/* 打開任何表單時,游標都不可以自己停在日期/時間欄 —— 手機上那會直接跳出系統的選擇器。
 * Lulu:「要手動點擊才展開」。這一支把每一個會開表單的按鈕按一次,問游標停在哪。 */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var PICK = /^(date|time|datetime-local|month|week)$/;
var where = () => { var a = d.activeElement; return a && a !== d.body ? (a.id || a.tagName) + "(" + (a.type || "") + ")" : "(沒有)"; };
return (async function () {
  var out = {}, bad = [];
  async function tryOpen(name, open, close) {
    open(); await wait(120);
    var a = d.activeElement, got = where();
    out[name] = got;
    if (a && PICK.test(a.type || "")) bad.push(name + " → " + got);
    if (close) { close(); await wait(80); }
  }
  await tryOpen("加行程", () => q("#add-stop-btn").click(), () => q("#sf-cancel") && q("#sf-cancel").click());
  q("#tab-cost").click(); await wait(80);
  await tryOpen("記一筆", () => q("#add-exp-btn").click(), () => q("#xe-cancel").click());
  await tryOpen("改花費", () => q("[data-edit-exp]").click(), () => q("#xe-cancel").click());
  q("#tab-fly").click(); await wait(80);
  await tryOpen("加航班", () => q("[data-flight-add]").click(), () => q("#fl-cancel").click());
  await tryOpen("團的設定", () => q("#cloud-set").click(), () => q("#st-cancel").click());
  out.結論 = bad.length ? "✗ " + bad.join(";") : "✓ 沒有一個自己停在日期/時間欄";
  out.errors = w.__errors || [];
  return out;
})();
