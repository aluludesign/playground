// 筆畫線：出現時由左往右畫出來的手繪抖動線。用法見 src/pen-line.css。
import "./pen-line.css";

// Figma divider/wiggle 畫出來的形狀（79 寬時跟 Figma 一模一樣）；viewBox 上面留 3.5、下面留 1.5，左右各多 1（圓頭）
const PATH = "M0 0L10.05 .08C16.68 .13 21.7 0 25 -.33L35 -1.3C38.3 -1.62 41.66 -1.81 45 -1.86L55 -2.01C58.35 -2.06 61.6 -2.13 64.75 -2.21L74.25 -2.45C77.5 -2.53 79 -2.3 79 -1.92L79 -1.28L78.9 0";

/** drawn：一開始就畫好（不跑動畫）；cls：再加的 class（用來定位） */
export function penLineSVG({ drawn = false, cls = "" } = {}) {
  return `<svg class="ds-pen-line${drawn ? " is-drawn" : ""}${cls ? " " + cls : ""}" viewBox="-1 -3.5 81 5" preserveAspectRatio="none" aria-hidden="true"><path d="${PATH}" pathLength="1" vector-effect="non-scaling-stroke"/></svg>`;
}

/** 畫出來（on = true）或收起來 */
export function drawPenLine(svg, on = true) {
  svg.classList.toggle("is-drawn", on);
}
