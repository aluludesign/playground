// 筆畫線／螢光筆「出現時由看不見的筆畫出來」（Style/動態 Motion）的共用觸發：
// 放進畫面時才畫（捲進來才畫），同一筆畫過就記住，畫面重畫時直接是畫好的樣子、不再重播。
//
//   在元件裡用 penMarkerHTML()／penLineSVG()（不要 drawn: true），外層加 data-pen="唯一的 key"，
//   然後 revealPens(root)。key 一樣就當成同一筆（例：日期 + 是不是選到）。
import { drawPenLine } from "./pen-line.js";

const seen = new Set();
const io = typeof IntersectionObserver !== "undefined"
  ? new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      draw(e.target);
    }), { threshold: 0.6 })
  : null;

function pens(el) {
  return el.querySelectorAll(":scope .ds-pen-marker, :scope .ds-pen-line");
}
function draw(el) {
  seen.add(el.dataset.pen);
  pens(el).forEach((p, i) => {
    p.style.setProperty("--pen-line-delay", (i * 0.08).toFixed(2) + "s");
    drawPenLine(p, true);
  });
}

/** root 底下所有 [data-pen]：畫過的直接畫好（不播），沒畫過的捲進畫面才畫 */
export function revealPens(root = document) {
  root.querySelectorAll("[data-pen]").forEach((el) => {
    if (el.dataset.penWired) return;
    el.dataset.penWired = "1";
    if (seen.has(el.dataset.pen)) {
      pens(el).forEach((p) => {
        p.style.transition = "none";
        drawPenLine(p, true);
        requestAnimationFrame(() => (p.style.transition = ""));
      });
    } else if (io) io.observe(el);
    else draw(el);
  });
}
