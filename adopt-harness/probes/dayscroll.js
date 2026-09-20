// 為什麼有這支:01-plan-mobile 在同一個乾淨工作樹上連跑兩次會得到兩張不同的圖
// (差 2.1481%,全部落在 y=454..651 = 日期橫條那一列)。差異式檢查對這種東西
// 只會說「有差異」,而那正好跟「我這一塊改壞了」長得一模一樣。
//
// renderDays() 最後一行是 cur.scrollIntoView({inline:"center"})。它算出來的
// scrollLeft 取決於**算的那一刻**每張日卡多寬,而日卡的寬度取決於網頁字體
// (Noto Sans TC / Zen Kaku Gothic New)有沒有載完。載完之前算 = 用後援字體的
// 度量;之後字體換上去,卡片變寬,scrollLeft 卻不會重算。
//
// 所以這支量三件事:實際的 scrollLeft、用現在(字體已載)的度量重算一次的
// scrollLeft、以及字體狀態。兩個 scrollLeft 對不上 = 那次的捲動是用舊度量算的。
var days = d.getElementById('days');
var cur = days && days.querySelector('[aria-pressed="true"]');
if (!days || !cur) return { error: '找不到 #days 或選中的日卡' };
// offsetLeft 是相對 offsetParent 的,而 .days 沒有 position,所以那個 parent 是外層
// 的 .wrap —— 直接拿來減會多算一個 16px 的頁面內距。要減掉容器自己的起點。
var curLeft = cur.getBoundingClientRect().left - days.getBoundingClientRect().left + days.scrollLeft;
var ideal = Math.round(curLeft + cur.offsetWidth / 2 - days.clientWidth / 2);
var max = days.scrollWidth - days.clientWidth;
ideal = Math.max(0, Math.min(max, ideal));
var faces = [];
d.fonts.forEach(function (f) { faces.push(f.family + ' ' + f.weight + ' ' + f.status); });
return {
  視窗寬: w.innerWidth,
  實際scrollLeft: Math.round(days.scrollLeft),
  以現在的度量重算: ideal,
  對得上嗎: Math.abs(Math.round(days.scrollLeft) - ideal) <= 1,
  scrollWidth: days.scrollWidth,
  clientWidth: days.clientWidth,
  選中日卡: { text: cur.querySelector('.dd') && cur.querySelector('.dd').textContent,
              容器內起點: Math.round(curLeft), offsetWidth: cur.offsetWidth },
  // 2.5*卡寬 - 165 就是這一版版面下「置中」的解。反推當初算的時候卡片多寬,
  // 看得出來那一刻用的是後援字體(寬)還是 Noto Sans TC(窄)。
  反推當初的卡寬: Math.round(((days.scrollLeft + 165) / 2.5) * 10) / 10,
  每張日卡寬: [].slice.call(days.children).map(function (b) { return b.offsetWidth; }),
  fonts狀態: d.fonts.status,
  載入的face數: faces.length,
  已載入的face: faces.filter(function (s) { return /loaded$/.test(s); }).length
};
