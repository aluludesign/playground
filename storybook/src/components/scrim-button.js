import "./scrim-button.css";

// 疊在地圖、照片上的圓鈕：Figma「Scrim」（162254:14112）
// 圖示用 icons/general 的 outlined 那一組，顏色改成跟著按鈕（Figma 綁 text inverse 100／on primary）
const raw = import.meta.glob("../icons/general/*_outlined.svg", { query: "?raw", import: "default", eager: true });
const iconSVG = (name) =>
  (raw[`../icons/general/icon_${name}_outlined.svg`] || "")
    .replace(/fill="#[0-9a-f]{3,8}"/gi, 'fill="currentColor"')
    .replace("<svg", '<svg class="ds-scrim-btn__icon" aria-hidden="true"');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * icon：icons/general 裡的名字（例：「calender」→ icon_calender_outlined.svg）
 * color：「scrim」（黑底 80%）｜「primary」
 * size：「lg」32｜「md」24｜「sm」16｜「xs」12（11-20 Lulu 改名：原本的 md→lg、sm→md）
 * label：給讀螢幕的人聽的名字（按鈕上沒有字）
 * pressed：有開關狀態的按鈕給 true／false（例：地圖上「開關其他日子的行程」），沒有就不給
 */
export function scrimButtonHTML({ icon = "calender", color = "scrim", size = "lg", label = "", pressed, disabled = false, state } = {}) {
  const cls = ["ds-scrim-btn", `ds-scrim-btn--${color}`, `ds-scrim-btn--${size}`, state ? `is-${state}` : ""].filter(Boolean).join(" ");
  const pr = pressed === undefined ? "" : ` aria-pressed="${!!pressed}"`;
  return `<button type="button" class="${cls}" aria-label="${esc(label)}"${pr}${disabled ? " disabled" : ""}>${iconSVG(icon)}</button>`;
}
