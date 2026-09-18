/*!
 * Retro Modern Design System — 動態反光引擎與互動輔助
 *
 *   <script src="../design-system/retro-modern.js"></script>
 *
 * 載進來就會自動啟動；不想要就在 <body> 上加 data-rm-autoinit="false"。
 * 沒有這支 JS，金屬面照樣長得對，只是高光固定在正中間不會動。
 */
(function (global) {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var cur = { x: 50, y: 50 };
  var target = { x: 50, y: 50 };
  var scrollVelocity = 0;
  var lastScrollY = 0;
  var sensorActive = false;
  var running = false;
  var lastAccel = { x: 0, y: 0, z: 0 };
  var SHAKE_THRESHOLD = 18;

  /* 光源是全域的：所有金屬面共用同一盞燈。寫在 :root 上讓它繼承下去，
     每幀只要改 4 個變數，而不是走訪 N 個元件各改 4 個。 */
  function paint() {
    var angle = 90 + (cur.x - 50) * 1.8 + (cur.y - 50) * 0.9 + scrollVelocity * 0.4;
    var intensity = 0.5 + Math.abs(cur.x - 50) * 0.008;
    root.style.setProperty('--sheen-x', cur.x.toFixed(1) + '%');
    root.style.setProperty('--sheen-y', cur.y.toFixed(1) + '%');
    root.style.setProperty('--sheen-angle', angle.toFixed(1) + 'deg');
    root.style.setProperty('--sheen-intensity', intensity.toFixed(2));
  }

  /* 追到定位就停下來。一直空轉 rAF 只是在耗電池——
     行程網站是在外面邊走邊看的，這點很要緊。 */
  function loop() {
    var dx = target.x - cur.x;
    var dy = target.y - cur.y;
    cur.x += dx * 0.18;
    cur.y += dy * 0.18;
    scrollVelocity *= 0.88;
    paint();

    if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05 && Math.abs(scrollVelocity) < 0.05) {
      running = false;
      return;
    }
    requestAnimationFrame(loop);
  }

  function wake() {
    if (running || reduceMotion) return;
    running = true;
    requestAnimationFrame(loop);
  }

  function aim(x, y) {
    target.x = Math.max(5, Math.min(95, x));
    target.y = Math.max(5, Math.min(95, y));
    wake();
  }

  function onScroll() {
    var now = global.scrollY || global.pageYOffset || 0;
    scrollVelocity = now - lastScrollY;
    lastScrollY = now;
    if (sensorActive) { wake(); return; }

    var page = Math.max(1, document.documentElement.scrollHeight - global.innerHeight);
    var f = now / page;
    aim(50 + Math.sin(f * Math.PI * 3) * 35, 50 + Math.cos(f * Math.PI * 2) * 30);
  }

  function onPointer(e) {
    if (sensorActive) return;
    aim((e.clientX / global.innerWidth) * 100, (e.clientY / global.innerHeight) * 100);
  }

  function onTouch(e) {
    if (!e.touches || !e.touches.length) return;
    var t = e.touches[0];
    aim((t.clientX / global.innerWidth) * 100, (t.clientY / global.innerHeight) * 100);
  }

  function onOrientation(e) {
    if (e.gamma === null && e.beta === null) return;
    sensorActive = true;
    var g = Math.max(-45, Math.min(45, e.gamma || 0));
    var b = Math.max(-45, Math.min(45, (e.beta || 0) - 45));
    aim(50 + (g / 45) * 40, 50 + (b / 45) * 40);
  }

  function onMotion(e) {
    var a = e.acceleration || e.accelerationIncludingGravity;
    if (!a) return;
    var delta = Math.abs((a.x || 0) - lastAccel.x)
              + Math.abs((a.y || 0) - lastAccel.y)
              + Math.abs((a.z || 0) - lastAccel.z);
    lastAccel = { x: a.x || 0, y: a.y || 0, z: a.z || 0 };
    if (delta > SHAKE_THRESHOLD) flare();
  }

  /* 整片金屬閃一下。晃動手機或手動呼叫都走這裡。 */
  function flare() {
    if (reduceMotion) return;
    var els = document.querySelectorAll('.steel-sheen-surface');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      el.classList.remove('sheen-flare');
      void el.offsetWidth; // 強制回流，動畫才會重播
      el.classList.add('sheen-flare');
    }
  }

  /* 按鈕的觸覺回饋。callback 延後 160ms 才跑，
     讓使用者先看到金屬凹下去，再看到事情發生。 */
  function pressFlash(el, callback) {
    if (el && !reduceMotion) {
      el.classList.remove('steel-press-flash');
      void el.offsetWidth;
      el.classList.add('steel-press-flash');
      el.style.setProperty('--sheen-specular', '1.05');
      setTimeout(function () { el.style.removeProperty('--sheen-specular'); }, 260);
    }
    if (typeof callback === 'function') {
      setTimeout(callback, reduceMotion ? 0 : 160);
    }
  }

  /* iOS 13+ 要使用者手勢觸發才給感應器權限，所以這支一定要綁在按鈕上。 */
  function requestMotion() {
    var needsPermission = typeof DeviceOrientationEvent !== 'undefined'
      && typeof DeviceOrientationEvent.requestPermission === 'function';

    if (!needsPermission) {
      global.addEventListener('deviceorientation', onOrientation, true);
      global.addEventListener('devicemotion', onMotion, true);
      return Promise.resolve('granted');
    }

    return DeviceOrientationEvent.requestPermission().then(function (state) {
      if (state !== 'granted') return state;
      global.addEventListener('deviceorientation', onOrientation, true);
      if (typeof DeviceMotionEvent !== 'undefined'
          && typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then(function (m) {
          if (m === 'granted') global.addEventListener('devicemotion', onMotion, true);
        }).catch(function () { /* 晃動閃光是加分項，拒絕就算了 */ });
      }
      return state;
    }).catch(function () { return 'denied'; });
  }

  var toastTimer = null;
  function toast(message, ms) {
    var el = document.querySelector('.rm-toast');
    if (!el) return;
    var slot = el.querySelector('[data-rm-toast-text]') || el;
    slot.textContent = message;
    el.classList.add('is-open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-open'); }, ms || 2200);
  }

  function copy(text, label) {
    var done = function () { toast((label ? label + '：' : '') + text); };
    if (navigator.clipboard && global.isSecureContext) {
      return navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
    }
    fallback(text, done);
    return Promise.resolve();
  }

  function fallback(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); }
    catch (err) { toast('複製失敗，請手動複製：' + text); }
    document.body.removeChild(ta);
  }

  var started = false;
  function init() {
    if (started) return;
    started = true;
    lastScrollY = global.scrollY || 0;

    if (reduceMotion) { paint(); return; }

    global.addEventListener('scroll', onScroll, { passive: true });
    global.addEventListener('touchmove', onTouch, { passive: true });
    /* hover 是滑鼠才有的事，觸控裝置綁了只是白耗 */
    if (global.matchMedia && global.matchMedia('(hover: hover)').matches) {
      global.addEventListener('mousemove', onPointer, { passive: true });
    }
    paint();
  }

  global.RetroModern = {
    init: init,
    flare: flare,
    pressFlash: pressFlash,
    requestMotion: requestMotion,
    toast: toast,
    copy: copy,
  };

  function autoInit() {
    if (document.body && document.body.dataset.rmAutoinit === 'false') return;
    init();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})(typeof window !== 'undefined' ? window : globalThis);
