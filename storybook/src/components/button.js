import "./button.css";

// Figma 的 add（161119:8832），改成吃 currentColor，顏色跟著文字走
export const ADD = `<svg class="ds-btn__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * 產生 Button 的 HTML（對應 Figma「Button」的屬性）。
 * color:   "primary" | "secondary" | "tertiary" | "error" | "white"
 * variant: "filled" | "outlined" | "text" | "icon" | "icon-outlined"
 * size:    "md" | "sm" | "xs"
 * state:   只給文件頁固定顯示用（"hover" | "focus" | "pressed"）
 * icon / trailingIconSvg：換 icon 時傳 svg 字串（記得加 class="ds-btn__icon"）
 */
export function buttonHTML({
  label = "記一筆",
  color = "primary",
  variant = "filled",
  size = "md",
  leadingIcon = true,
  trailingIcon = false,
  icon = ADD,
  trailingIconSvg = ADD,
  disabled = false,
  state,
} = {}) {
  const cls = ["ds-btn"];
  if (color !== "primary") cls.push("ds-btn--" + color);
  if (variant !== "filled") cls.push("ds-btn--" + variant);
  if (size !== "md" && size !== "default") cls.push("ds-btn--" + size);
  if (state) cls.push("is-" + state);
  const iconOnly = variant === "icon" || variant === "icon-outlined";
  const inner = iconOnly
    ? icon
    : `${leadingIcon ? icon : ""}<span class="ds-btn__label">${esc(label)}</span>${trailingIcon ? trailingIconSvg : ""}`;
  return `<button type="button" class="${cls.join(" ")}"${disabled ? " disabled" : ""}${iconOnly ? ` aria-label="${esc(label)}"` : ""}>${inner}</button>`;
}
