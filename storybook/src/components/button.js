import "./button.css";
import { faLocationDot } from "@fortawesome/free-solid-svg-icons/faLocationDot";
import { faSVG } from "../fa.js";

// Figma 的 add（161119:8832），改成吃 currentColor，顏色跟著文字走
export const ADD = `<svg class="ds-btn__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>`;

// 重新定位（Figma map control 162672:41289 的 place）：舊的 Font Awesome location-dot，留著相容
export const PLACE = faSVG(faLocationDot, "ds-btn__icon");
// 回到原點（Figma map control 162672:41289 第三顆，Lulu 11-22 改成房子）：Figma「home」161193:10356，填色 secondary
export const HOME = `<svg class="ds-btn__icon" viewBox="0 0 16 16" aria-hidden="true"><path style="fill:var(--ds-sys-color-secondary)" d="M6.66634 13.3333V9.33333H9.33301V13.3333H12.6663V8H14.6663L7.99967 2L1.33301 8H3.33301V13.3333H6.66634Z"/></svg>`;

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
