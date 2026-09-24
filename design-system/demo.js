/* demo.html 的黏著層。
 *
 * 規格書原稿的 markup 直接呼叫 copyColor()、showToast() 這些全域函式，
 * 而那些行為在系統裡是 RetroModern.* —— 這支把名字接起來，
 * **不重寫任何邏輯**。動態反光引擎由 retro-modern.js 自動啟動，
 * 這裡不碰它（規格書原稿自己帶了一份，那份是重複的，沒有搬過來）。
 */
'use strict';

function showToast(msg) { RetroModern.toast(msg); }
function copyColor(text, label) { RetroModern.copy(text, label); }
function triggerSheenBurst() { RetroModern.flare(); RetroModern.toast('✨ 觸發金屬高光閃耀'); }
function tactileSteelButtonAction(btn, cb) { RetroModern.pressFlash(btn, cb); }

/* 切換標籤。規格書原稿是一次增刪十個 class；系統把狀態放在 aria-pressed 上，
   所以這裡只翻一個屬性 —— 外觀由 CSS 決定。 */
function toggleTag(btn) {
  var on = btn.getAttribute('aria-pressed') === 'true';
  btn.setAttribute('aria-pressed', String(!on));
  btn.classList.add('rm-chip', 'rm-chip--selectable');
}

function copySaturationParam() {
  var v = getComputedStyle(document.documentElement).getPropertyValue('--iri-saturate').trim();
  RetroModern.copy('--iri-saturate: ' + v + ';', '虹光彩度參數');
}

async function requestMotionPermission() {
  var state = await RetroModern.requestMotion();
  var ok = state === 'granted';
  var badge = document.getElementById('gyro-badge');
  var readout = document.getElementById('gyro-readout');
  var btn = document.getElementById('btn-request-gyro');
  if (badge) badge.textContent = ok ? '感應器連線中 (Live)' : '觸控模擬中 (Touch/Mouse)';
  if (readout) readout.textContent = ok ? '傾斜裝置，高光會跟著轉' : '未取得權限 —— 捲動或滑動一樣推得動高光';
  if (btn) { btn.textContent = ok ? '✅ 陀螺儀已授權' : '⚠️ 未授權，改用觸控'; btn.classList.remove('animate-bounce'); }
  RetroModern.toast(ok ? '📱 陀螺儀已啟用' : '未取得感應器權限，改用觸控滑動');
}

/* 彩度拉桿。換算照規格書：value/100 —— 拉桿預設 120 對應 --iri-saturate: 1.2，
   跟 CSS 的預設值一致。（我一開始自己換算成 value/100*1.2，結果預設變成 1.44，
   那是多此一舉。） */
(function slider() {
  var el = document.getElementById('iri-sat-slider');
  var out = document.getElementById('iri-sat-value');
  if (!el) return;
  var apply = function () {
    var v = (el.value / 100).toFixed(2);
    document.documentElement.style.setProperty('--iri-saturate', v);
    if (out) out.textContent = el.value + '%';
  };
  el.addEventListener('input', apply);
  apply();
})();

/* Auto Pulse：虹光掃一次、白光再掃一次，然後停一下重來。
   用 RetroModern.sweep()（它自己有「事件沒來就時間到收尾」的後路），
   不自己數毫秒 —— 時長只存在 CSS 那一處。 */
(function autoPulse() {
  var btn = document.getElementById('btn-auto-pulse');
  if (!btn) return;
  var loop = function () {
    RetroModern.sweep(btn).then(function () { setTimeout(loop, 1200); });
  };
  setTimeout(loop, 800);
})();

/* 走鐘與樣式表檢查 —— 跟先前一樣，只是搬到這支來。 */
(function checks() {
  if (getComputedStyle(document.body).backgroundColor !== 'rgb(241, 239, 230)') {
    document.getElementById('rm-css-warning').hidden = false;
    console.warn('[rm] demo.css 沒有生效，body 底色不是 muslin');
  } else {
    console.log('[rm] 樣式表生效：body 底色 = muslin');
  }
  var fnv = function (t) {
    var h = 2166136261;
    for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  };
  fetch('./demo.css').then(function (r) { return r.text(); }).then(function (out) {
    var m = /\/\*src:([a-z0-9]+):([^*]+)\*\//.exec(out);
    if (!m) { console.warn('[rm] demo.css 沒有指紋，新舊比對這次等於沒做'); return; }
    var want = m[1], list = m[2].split(',');
    return Promise.all(list.map(function (f) { return fetch(f).then(function (r) { return r.text(); }); }))
      .then(function (parts) {
        var got = fnv(parts.join(''));
        if (got !== want) {
          document.getElementById('rm-stale-warning').hidden = false;
          console.warn('[rm] demo.css 比原始碼舊（記 ' + want + ' / 實 ' + got + '），跑 ./build.sh');
        } else {
          console.log('[rm] demo.css 是最新的（指紋 ' + got + '，涵蓋 ' + list.length + ' 個來源檔）');
        }
      });
  }).catch(function () { console.log('[rm] 抓不到檔案（file:// 或離線），新舊比對這次跳過'); });
})();
