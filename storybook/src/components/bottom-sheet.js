import "../pattern.css";
import "./bottom-sheet.css";

/**
 * 可上下拉的面板（Figma「bottom sheet」162236:14235，Handle 161623:5771）
 * 「按住整個 bottom sheet 可上、下滑動至最低與展開至最大」
 * content：面板裡的東西（Figma 的 slot，例：日期列＋時間軸）
 * label：給讀螢幕的人聽的名字
 * bare：沒有面板的底和陰影，只有把手（Figma 許願牆：卡片直接浮在地圖上）
 *
 * 面板本身的高度永遠是最高那一段，用 translateY 往下藏；所以拉的時候裡面不會重排。
 */
export function bottomSheetHTML({ content = "", label = "行程", bare = false } = {}) {
  return `<section class="ds-sheet${bare ? " ds-sheet--bare" : " ds-pattern"}" aria-label="${label}">
<div class="ds-sheet__header"><button type="button" class="ds-sheet__handle" aria-label="拉開或收起${label}"></button></div>
<div class="ds-sheet__body">${content}</div>
</section>`;
}

/**
 * 接上拖拉。snaps：面板露出來的高度（px，由低到高），例：[186, 450, 707]
 *   也可以給函式（每次量的時候才算，畫面大小變了跟著變）
 * at：一開始停在第幾段（預設 1）
 * scroller：面板裡會自己捲的那一塊（選擇器）；拉到最高之後在它裡面上下滑是捲它，捲到頂再往下拉才收面板
 * 停好一段會發出 ds-sheet-snap（detail.index、detail.height）
 * 回傳 { snapTo(i), index() }
 */
export function wireBottomSheet(sheet, { snaps = [186, 450, 707], at = 1, scroller = "" } = {}) {
  if (sheet._sheet) return sheet._sheet;
  const list = () => (typeof snaps === "function" ? snaps() : snaps).slice().sort((a, b) => a - b);
  let idx = at;
  let shown = 0; // 現在露出來多高
  const reduce = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const apply = (h, animate) => {
    const s = list();
    const max = s[s.length - 1];
    shown = Math.max(s[0], Math.min(max, h));
    sheet.style.height = max + "px";
    sheet.classList.toggle("is-animating", !!animate && !reduce());
    sheet.style.transform = `translateY(${max - shown}px)`;
    sheet.classList.toggle("is-max", shown >= max - 1);
    sheet.style.setProperty("--sheet-shown", shown + "px");
  };
  const snapTo = (i, animate = true) => {
    const s = list();
    idx = Math.max(0, Math.min(s.length - 1, i));
    apply(s[idx], animate);
    sheet.dispatchEvent(new CustomEvent("ds-sheet-snap", { bubbles: true, detail: { index: idx, height: s[idx] } }));
  };

  // 拖拉：方向先鎖住（橫的交給裡面的日期列）；拉到最高時在可捲區裡上滑是捲，不是拉面板
  let start = null;
  sheet.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("input, textarea, select, [contenteditable]")) return;
    start = { x: e.clientX, y: e.clientY, h: shown, t: performance.now(), lock: "", id: e.pointerId, sc: scroller ? e.target.closest(scroller) : null };
  });
  sheet.addEventListener("pointermove", (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!start.lock) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      start.lock = Math.abs(dy) > Math.abs(dx) ? "y" : "x";
      const s = list();
      // 在最高、而且裡面還能捲（往上滑，或沒捲到頂）→ 讓它捲
      if (start.lock === "y" && start.sc && shown >= s[s.length - 1] - 1 && (dy < 0 || start.sc.scrollTop > 0)) start.lock = "scroll";
      if (start.lock === "y") sheet.setPointerCapture(e.pointerId);
    }
    if (start.lock !== "y") return;
    e.preventDefault();
    apply(start.h - dy, false);
  });
  const end = (e) => {
    if (!start || e.pointerId !== start.id) return;
    const was = start;
    start = null;
    if (was.lock !== "y") return;
    const s = list();
    const v = (was.h - shown) / Math.max(1, performance.now() - was.t); // 正的 = 往下
    // 甩得夠快就往那個方向跳一段，不然停在最近的那一段
    let i = s.reduce((best, h, k) => (Math.abs(h - shown) < Math.abs(s[best] - shown) ? k : best), 0);
    if (v > 0.5) i = Math.max(0, s.filter((h) => h < was.h - 1).length - 1);
    else if (v < -0.5) i = Math.min(s.length - 1, s.findIndex((h) => h > was.h + 1));
    if (i < 0) i = s.length - 1;
    snapTo(i);
  };
  sheet.addEventListener("pointerup", end);
  sheet.addEventListener("pointercancel", end);
  // 只點把手（沒拖）：最低→中間→最高→最低
  sheet.querySelector(".ds-sheet__handle")?.addEventListener("click", () => snapTo(idx >= list().length - 1 ? 0 : idx + 1));
  if (scroller) sheet.style.touchAction = "none";
  sheet.querySelectorAll(scroller || "_").forEach((el) => (el.style.touchAction = "pan-y"));

  snapTo(at, false);
  sheet._sheet = { snapTo, index: () => idx, refresh: () => snapTo(idx, false) };
  return sheet._sheet;
}
