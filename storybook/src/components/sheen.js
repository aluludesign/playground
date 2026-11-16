// 動態反光引擎（從 design-system/retro-modern.js 搬過來，只留反光與按壓回饋）。
// 光源是全域的：所有虹光面共用同一盞燈，寫在 :root 的 --sheen-* 上。
// 滑鼠移動、捲動、手機傾斜（已授權時）會讓光移動；追到定位就停，不空轉耗電。

let started = false;

export function startSheen(win = window) {
  if (started) return;
  started = true;
  const root = win.document.documentElement;
  const reduce = win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cur = { x: 50, y: 50 };
  const target = { x: 50, y: 50 };
  let scrollVelocity = 0;
  let lastScrollY = win.scrollY || 0;
  let sensorActive = false;
  let running = false;

  const paint = () => {
    const angle = 90 + (cur.x - 50) * 1.8 + (cur.y - 50) * 0.9 + scrollVelocity * 0.4;
    const intensity = 0.5 + Math.abs(cur.x - 50) * 0.008;
    root.style.setProperty("--sheen-x", cur.x.toFixed(1) + "%");
    root.style.setProperty("--sheen-y", cur.y.toFixed(1) + "%");
    root.style.setProperty("--sheen-angle", angle.toFixed(1) + "deg");
    root.style.setProperty("--sheen-intensity", intensity.toFixed(2));
  };
  const loop = () => {
    const dx = target.x - cur.x;
    const dy = target.y - cur.y;
    cur.x += dx * 0.18;
    cur.y += dy * 0.18;
    scrollVelocity *= 0.88;
    paint();
    if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05 && Math.abs(scrollVelocity) < 0.05) {
      running = false;
      return;
    }
    win.requestAnimationFrame(loop);
  };
  const wake = () => {
    if (running || reduce) return;
    running = true;
    win.requestAnimationFrame(loop);
  };
  const aim = (x, y) => {
    target.x = Math.max(5, Math.min(95, x));
    target.y = Math.max(5, Math.min(95, y));
    wake();
  };

  paint();
  if (reduce) return;

  win.addEventListener(
    "scroll",
    () => {
      const now = win.scrollY || 0;
      scrollVelocity = now - lastScrollY;
      lastScrollY = now;
      if (sensorActive) return wake();
      const page = Math.max(1, win.document.documentElement.scrollHeight - win.innerHeight);
      const f = now / page;
      aim(50 + Math.sin(f * Math.PI * 3) * 35, 50 + Math.cos(f * Math.PI * 2) * 30);
    },
    { passive: true },
  );
  win.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches && e.touches[0];
      if (t) aim((t.clientX / win.innerWidth) * 100, (t.clientY / win.innerHeight) * 100);
    },
    { passive: true },
  );
  if (win.matchMedia && win.matchMedia("(hover: hover)").matches) {
    win.addEventListener(
      "mousemove",
      (e) => {
        if (!sensorActive) aim((e.clientX / win.innerWidth) * 100, (e.clientY / win.innerHeight) * 100);
      },
      { passive: true },
    );
  }
  // 手機傾斜：iOS 要使用者手勢授權，這裡只在已經能收到事件時接手
  win.addEventListener(
    "deviceorientation",
    (e) => {
      if (e.gamma === null && e.beta === null) return;
      sensorActive = true;
      const g = Math.max(-45, Math.min(45, e.gamma || 0));
      const b = Math.max(-45, Math.min(45, (e.beta || 0) - 45));
      aim(50 + (g / 45) * 40, 50 + (b / 45) * 40);
    },
    true,
  );
}

/** 按鈕的觸覺回饋：金屬先凹下去、亮一下，callback 延後 160ms 才跑 */
export function pressFlash(el, callback) {
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (el && !reduce) {
    el.classList.remove("is-press-flash");
    void el.offsetWidth;
    el.classList.add("is-press-flash");
    el.style.setProperty("--sheen-specular", "1.05");
    setTimeout(() => el.style.removeProperty("--sheen-specular"), 260);
  }
  if (typeof callback === "function") setTimeout(callback, reduce ? 0 : 160);
}
