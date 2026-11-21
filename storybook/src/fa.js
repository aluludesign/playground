// Font Awesome（Free，圖示 CC BY 4.0）：Figma 還沒有的 icon 先用它（Lulu 11-21）
// 有了 Trippps 自己的 icon 就換掉。用法：faSVG(faClockRotateLeft, "my-class")
export function faSVG(def, cls = "") {
  const [w, h, , , path] = def.icon;
  const d = Array.isArray(path) ? path.join(" ") : path;
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
}
