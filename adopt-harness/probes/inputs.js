// 第四塊(.fld input/select/textarea → rm-input)的事前/事後盤點。
//
// 兩件事只有這裡看得到:
//  1. 涵蓋率 —— 29 個靜態控制項裡,九張截圖只畫得出 08 / 09 的 9 個。
//  2. **`.who` 裡的核取方塊也被 `.fld input` 選到**(.who 住在 .fld 裡)。
//     刪掉主規則會連它一起改,而那不在這一塊的範圍內 —— 跟 block-03 的 .who label
//     是同一個形狀的陷阱,所以這支把它分開統計。
//
// WIDTH=390 跑一次、WIDTH=1100 跑一次。:521 那條手機覆寫只有 390 看得到,
// 而 08 / 09 兩張圖都是 390 —— 只在 1100 量等於沒量到截圖裡的那一套值。
// 表單預設全部 hidden,不打開的話 offsetHeight 一律是 0 —— 量得到 computed 值,
// 量不到「欄位變高多少」。這裡照 shoot.sh 08 / 09 的同一個動作把它們打開,
// 另外多開花費那兩張(九張截圖從來沒開過,但改動會落在它們身上)。
var opened = [];
function act(name, fn) { try { fn(); opened.push(name); } catch (e) { opened.push(name + ' ✗ ' + e); } }
act('add-stop-btn', function () { d.getElementById('add-stop-btn').click(); });
act('data-edit-stop', function () { d.querySelector('[data-edit-stop]').click(); });
act('tab-cost', function () { d.getElementById('tab-cost').click(); });
act('add-exp-btn', function () { d.getElementById('add-exp-btn').click(); });
act('data-edit-exp', function () { d.querySelector('[data-edit-exp]').click(); });

var els = [].slice.call(d.querySelectorAll('.fld input, .fld select, .fld textarea'));
function first(f) { return f.split(',')[0].replace(/"/g, '').trim(); }
var rows = els.map(function (el) {
  var c = w.getComputedStyle(el);
  return {
    tag: el.tagName.toLowerCase(),
    type: el.type || '',
    id: el.id || '(無)',
    inWho: !!el.closest('.who'),
    hasClass: el.classList.contains('rm-input'),
    paintable: el.offsetParent !== null,
    fontSize: c.fontSize,
    fontFamily: first(c.fontFamily),
    color: c.color,
    background: c.backgroundColor,
    border: c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + c.borderTopColor,
    radius: c.borderTopLeftRadius,
    padding: c.paddingTop + ' ' + c.paddingRight + ' ' + c.paddingBottom + ' ' + c.paddingLeft,
    lineHeight: c.lineHeight,
    width: c.width,
    minWidth: c.minWidth,
    boxSizing: c.boxSizing,
    appearance: c.webkitAppearance || c.appearance,
    offsetH: el.offsetHeight,
    offsetW: el.offsetWidth
  };
});
function tally(rs, k) { var m = {}; rs.forEach(function (r) { m[r[k]] = (m[r[k]] || 0) + 1; }); return m; }
function summary(rs) {
  var o = {};
  ['fontSize', 'fontFamily', 'color', 'background', 'border', 'radius', 'padding',
   'lineHeight', 'minWidth', 'boxSizing', 'offsetH', 'offsetW'].forEach(function (k) { o[k] = tally(rs, k); });
  return o;
}
var fields = rows.filter(function (r) { return !r.inWho; });
var who = rows.filter(function (r) { return r.inWho; });

// 一個 .fld 的整塊高度(標籤 + 欄位),用來回答「欄位變高多少」。
var fldH = {};
[].slice.call(d.querySelectorAll('.fld')).forEach(function (el) {
  if (!el.offsetParent) return;
  fldH[el.offsetHeight] = (fldH[el.offsetHeight] || 0) + 1;
});

// :430 的等寬覆寫還活著嗎 —— 金額欄位變成非等寬會很明顯。
var nums = fields.filter(function (r) { return r.type === 'number'; })
                 .map(function (r) { return r.id + '=' + r.fontFamily; });
// :423-426 的 time/date 矯正還活著嗎(iOS 原生外觀 + shadow DOM 對齊)。
var dt = fields.filter(function (r) { return r.type === 'time' || r.type === 'date'; })
               .map(function (r) {
  var el = d.getElementById(r.id), o = {};
  if (el) {
    var v = w.getComputedStyle(el, '::-webkit-date-and-time-value');
    o = { margin: v.margin, textAlign: v.textAlign, lineHeight: v.lineHeight };
  }
  return { id: r.id, appearance: r.appearance, fontFamily: r.fontFamily, value偽元素: o };
});
// rm-input 的 ::placeholder 會改顏色 —— 舊規則沒設過,是瀏覽器預設。
var ph = fields.filter(function (r) { return r.id === 'sf-title'; }).map(function (r) {
  var el = d.getElementById(r.id);
  return { id: r.id, color: el ? w.getComputedStyle(el, '::placeholder').color : null };
});
// `--font-sans` 是 design-system 的 "DM Sans", ...,而 tokyo-trip 的 <link> 沒有載 DM Sans。
// 沒載 = 實際畫出來的還是 Noto Sans TC。用兩個 span 量形狀,不要問 fonts.check()
// (ADOPTION「量字體的四個陷阱」5b)。
function probeFamily(fam) {
  var s = d.createElement('span');
  s.textContent = 'Handgloves 0123456789';
  s.style.cssText = 'position:absolute;left:-9999px;font-size:40px;white-space:pre;font-family:' + fam;
  d.body.appendChild(s);
  var r = s.getBoundingClientRect().width;
  s.remove();
  return Math.round(r * 100) / 100;
}
var dmSans = probeFamily('"DM Sans",serif'), noFont = probeFamily('"__nope__",serif');
return {
  打開了什麼: opened,
  控制項總數: rows.length,
  欄位控制項: fields.length,
  who核取方塊: who.length,
  有rm_input的: rows.filter(function (r) { return r.hasClass; }).length,
  畫得出來的欄位: fields.filter(function (r) { return r.paintable; }).length,
  欄位_彙總: summary(fields),
  who核取方塊_彙總: summary(who),
  // .who 的核取方塊逐個列出來:它們不在這一塊的範圍內,但 `.fld input` 選得到,
  // 而九張截圖沒有一張打開過 #exp-form / #exp-edit-overlay —— 只有這裡看得到它們變了沒有。
  who核取方塊_逐個: who.map(function (r) {
    return { id: r.id, w: r.offsetW, h: r.offsetH, bg: r.background,
             fs: r.fontSize, border: r.border, paintable: r.paintable };
  }),
  fld整塊高度: fldH,
  number欄位的字型: nums,
  time_date矯正: dt,
  placeholder顏色: ph,
  'DM Sans 有沒有真的載到': { 'DM Sans寬': dmSans, '不存在字型寬': noFont,
                              結論: dmSans === noFont ? '沒有載到,落回後援' : '有載到' },
  離群值: fields.filter(function (r) { return !r.paintable && false; })
};
