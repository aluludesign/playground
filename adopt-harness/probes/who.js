// `.who` 那一整組(成員膠囊 label + 核取方塊 input)的逐項盤點。
//
// 為什麼要有這一支:`.who` 被第三塊(color / letter-spacing)和第四塊
// (width / background / font-size / line-height)各「刻意凍住」過一次,
// 兩輪都寫著同一句理由:「九張截圖沒有一張打開過 #exp-form / #exp-edit-overlay,驗不了」。
// block-05 補了第 10 / 11 張截圖,而這一支是它的對照 —— 圖說「看起來一樣」,
// 這裡說「哪一個值一樣、哪一個不一樣」。
//
// 配合 probe.sh 的 SRC= 開關,同一支可以在三個 commit 上各跑一次:
//   SRC=<worktree>/tokyo-trip WIDTH=390 ./probe.sh probes/who.js
// 這樣「凍住有沒有守住」是**量出來的**,不是從 CSS 讀出來推的。
//
// WIDTH=390 是重點:`:537` 有一條 `.who label{padding:9px 13px; font-size:14px}`
// 只在 <=640px 生效,而 10 / 11 兩張圖都是 390px。只量 1100 等於沒量到截圖裡那一套。
var opened = [];
function act(name, fn) { try { fn(); opened.push(name); } catch (e) { opened.push(name + ' ✗ ' + e); } }
act('tab-cost', function () { d.getElementById('tab-cost').click(); });
act('add-exp-btn', function () { d.getElementById('add-exp-btn').click(); });
act('data-edit-exp', function () { d.querySelector('[data-edit-exp]').click(); });

function r3(n) { return Math.round(n * 1000) / 1000; }

function pill(el) {
  var c = w.getComputedStyle(el), b = el.getBoundingClientRect();
  return {
    文字: (el.textContent || '').trim(),
    // 第三塊凍的兩項
    color: c.color,
    letterSpacing: c.letterSpacing,
    /* **第六塊才發現這一欄不在。** `rm-chip` 會把字體換成 mono,而這支探針
       從 block-05 寫到現在都沒量字體 —— 那正是第二塊(`--font-mono` 的 CJK fallback)
       整輪在處理的東西。不量的欄位不會變紅。 */
    fontFamily: c.fontFamily,
    // 從 .fld label 一起繼承過來、但沒有人登記過的幾項 —— 如果第三塊漏掉了,會在這裡現形
    fontWeight: c.fontWeight,
    fontSize: c.fontSize,
    marginBottom: c.marginBottom,
    display: c.display,
    padding: c.paddingTop + ' ' + c.paddingRight + ' ' + c.paddingBottom + ' ' + c.paddingLeft,
    border: c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + c.borderTopColor,
    radius: c.borderTopLeftRadius,
    background: c.backgroundColor,
    lineHeight: c.lineHeight,
    gap: c.gap,
    // 幾何:小數點才看得出「差 0.5px」這種在整數欄位上看不見的東西
    rect: r3(b.width) + '×' + r3(b.height) + ' @ ' + r3(b.x) + ',' + r3(b.y),
    offset: el.offsetWidth + '×' + el.offsetHeight
  };
}

function box(el) {
  var c = w.getComputedStyle(el), b = el.getBoundingClientRect();
  return {
    id: el.id || '(無)',
    // 第四塊凍的四項
    width: c.width, background: c.backgroundColor, fontSize: c.fontSize, lineHeight: c.lineHeight,
    accentColor: c.accentColor,
    minWidth: c.minWidth,
    margin: c.marginTop + ' ' + c.marginRight + ' ' + c.marginBottom + ' ' + c.marginLeft,
    rect: r3(b.width) + '×' + r3(b.height) + ' @ ' + r3(b.x) + ',' + r3(b.y),
    offset: el.offsetWidth + '×' + el.offsetHeight
  };
}

function group(id) {
  var g = d.getElementById(id);
  if (!g) return { 找不到: id };
  var c = w.getComputedStyle(g), b = g.getBoundingClientRect();
  var labels = [].slice.call(g.querySelectorAll('label'));
  // 逐列的 y:兩列膠囊之間差多少,是「.fld label 的 margin-bottom 有沒有跟著消失」
  // 最直接的證據,而那一項兩輪都沒有人登記過。
  var ys = {};
  labels.forEach(function (l) {
    var y = r3(l.getBoundingClientRect().y);
    (ys[y] = ys[y] || []).push((l.textContent || '').trim());
  });
  return {
    容器: { display: c.display, gap: c.gap, flexWrap: c.flexWrap,
            rect: r3(b.width) + '×' + r3(b.height) + ' @ ' + r3(b.x) + ',' + r3(b.y) },
    可見: g.offsetParent !== null,
    膠囊數: labels.length,
    逐列的y: ys,
    膠囊: labels.map(pill),
    核取方塊: [].slice.call(g.querySelectorAll('input')).map(box)
  };
}

// .fld label 現在是什麼(第三塊把它換成 rm-label 了)—— 拿一個真的 .fld > label 來對照,
// 這樣「.who label 少繼承到什麼」看得出來源。
var ref = d.querySelector('#exp-form .fld > label');
var refC = ref ? w.getComputedStyle(ref) : null;

return {
  打開了什麼: opened,
  視窗寬: w.innerWidth,
  對照_exp_form的第一個標籤: refC ? {
    class: ref.className, color: refC.color, letterSpacing: refC.letterSpacing,
    fontWeight: refC.fontWeight, fontSize: refC.fontSize,
    marginBottom: refC.marginBottom, display: refC.display, lineHeight: refC.lineHeight
  } : null,
  ef_who: group('ef-who'),
  xe_who: group('xe-who')
};
