// 第三塊(.fld label → rm-label)的涵蓋率證據。
// 截圖只看得到 9 個標籤,加了 class 的有 32 個 —— 其餘 23 個只有這裡驗得到。
// 但反過來也要記住:這裡量得到不代表截圖看得到(block-02-mono 陷阱 1)。
function px(v) { return v; }
var labels = [].slice.call(d.querySelectorAll('.fld label'));
var rows = labels.map(function (el) {
  var c = w.getComputedStyle(el);
  return {
    text: (el.textContent || '').trim().slice(0, 12),
    hasClass: el.classList.contains('rm-label'),
    inWho: !!el.closest('.who'),
    // offsetParent 是 null = 這個元素現在畫不出來(祖先 hidden / display:none)
    paintable: el.offsetParent !== null,
    fontSize: c.fontSize,
    fontWeight: c.fontWeight,
    color: c.color,
    letterSpacing: c.letterSpacing,
    lineHeight: c.lineHeight,
    marginBottom: c.marginBottom,
    fontFamily: c.fontFamily.split(',')[0].replace(/"/g, '')
  };
});
var flds = [].slice.call(d.querySelectorAll('.fld')).map(function (el) {
  return w.getComputedStyle(el).rowGap;
});
function tally(rows, key) {
  var m = {};
  rows.forEach(function (r) { m[r[key]] = (m[r[key]] || 0) + 1; });
  return m;
}
var direct = rows.filter(function (r) { return !r.inWho; });
var who = rows.filter(function (r) { return r.inWho; });
return {
  總數: rows.length,
  直接欄位標籤: direct.length,
  who膠囊標籤: who.length,
  有rm_label的: rows.filter(function (r) { return r.hasClass; }).length,
  畫得出來的: rows.filter(function (r) { return r.paintable; }).length,
  直接標籤_彙總: {
    fontSize: tally(direct, 'fontSize'),
    fontWeight: tally(direct, 'fontWeight'),
    color: tally(direct, 'color'),
    letterSpacing: tally(direct, 'letterSpacing'),
    lineHeight: tally(direct, 'lineHeight'),
    marginBottom: tally(direct, 'marginBottom'),
    fontFamily: tally(direct, 'fontFamily')
  },
  who膠囊_彙總: {
    fontSize: tally(who, 'fontSize'),
    color: tally(who, 'color'),
    letterSpacing: tally(who, 'letterSpacing')
  },
  fld的rowGap: tally(flds.map(function (g) { return { g: g }; }), 'g'),
  離群值: direct.filter(function (r) {
    return !r.hasClass || r.fontSize !== '13px' || r.fontWeight !== '700';
  })
};
