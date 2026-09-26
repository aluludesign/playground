/* 介紹頁:誰看得到、按鈕去哪裡。
 *   PAGE='/index.html?fake=visitor' ./probe.sh probes/landing.js       沒登入、直接打開首頁 → 介紹頁
 *   PAGE='/index.html?fake=anon&i=q4wn8t' ./probe.sh probes/landing.js 帶邀請連結 → 不是介紹頁,是登入卡
 *   PAGE='/index.html?fake=new&start=create' ./probe.sh probes/landing.js  登入回來 → 開團表單 */
var q = s => d.querySelector(s), txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var wait = ms => new Promise(r => window.setTimeout(r, ms));
if (window.__landing) return window.__landing;
return (async function () {
  var out = {
    網址: w.location.search,
    介紹頁: !q("#landing").hidden,
    登入卡: !q("#home-overlay").hidden ? txt("#home-title") : "(沒開)",
    後面有沒有讀資料: (w.__calls || []).filter(c => /resource=/.test(c.url)).map(c => c.url.replace(/^.*resource=/, "")),
    errors: w.__errors || [],
  };
  if (!q("#landing").hidden) {
    var b = q("#landing-go"), r = b.getBoundingClientRect(), hit = d.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    out.按鈕 = b.textContent.trim();
    out.按鈕按得到 = !!hit && (hit === b || b.contains(hit));
    window.__landing = out;
    var before = String(w.location.href);
    b.click();
    for (var i = 0; i < 60 && String(w.location.href) === before; i++) await wait(50);
    out.按下去去了 = String(w.location.href).replace(/^https?:\/\/[^/]+/, "");
  }
  return out;
})();
