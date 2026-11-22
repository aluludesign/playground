import "./location-pin.css";
import "./divider.css";
import { dividerDotHTML } from "./divider.js";
import { BADGE_BG, DOT_MARK, FOCUS_RING, PIN_S, PIN_L } from "./location-pin-shapes.js";

// Figma「home」（161193:10356）
export const HOME = "M6.66634 13.3333V9.33333H9.33301V13.3333H12.6663V8H14.6663L7.99967 2L1.33301 8H3.33301V13.3333H6.66634Z";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * badge（Figma pin/draw）
 * number：號碼；color：1–14，對應 sys/color/customs/custom N（預設 8，照 Figma Default）
 * state：「default」|「dot」|「not-on-map」|「focus」|「primary」|「icon」；size：「sm」(28) |「lg」(51)
 *   primary：搜尋結果的點（Figma 162214:35999）—— 塗鴉底 primary 80%、號碼 on primary
 *   icon：搜尋時這一團設定的城市（Figma 162205:34156 pin/draw Property 1=icon）—— 塗鴉底 secondary、中間白色房子 16，沒有號碼
 */
export function pinBadgeHTML({ number = 1, color = 8, state = "default", size = "sm" } = {}) {
  const cls = ["ds-pin-badge"];
  if (size === "lg") cls.push("ds-pin-badge--lg");
  if (state !== "default") cls.push("ds-pin-badge--" + state);
  const style = state === "default" || state === "focus" ? ` style="--pin-color:var(--ds-sys-color-customs-custom-${color})"` : "";
  const ring = state === "focus" ? `<svg class="ds-pin-badge__ring" viewBox="0 0 36 36" aria-hidden="true"><path d="${FOCUS_RING}"/></svg>` : "";
  const inner = state === "dot"
    ? `<svg class="ds-pin-badge__dot" viewBox="0 0 10 10" aria-hidden="true"><path d="${DOT_MARK}"/></svg>`
    : state === "icon"
      ? `<svg class="ds-pin-badge__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="${HOME}"/></svg>`
      : `<span class="ds-pin-badge__num">${esc(number)}</span>`;
  return `<span class="${cls.join(" ")}"${style}>${ring}<svg class="ds-pin-badge__bg" viewBox="0 0 25.15 24.95" preserveAspectRatio="none" aria-hidden="true"><path d="${BADGE_BG}"/></svg>${inner}</span>`;
}

/** label：白色膠囊名字；focus = 粗體（Figma Property 1=focuse） */
export function pinLabelHTML({ text = "name", focus = false } = {}) {
  return `<span class="ds-pin-label${focus ? " ds-pin-label--focus" : ""}">${esc(text)}</span>`;
}

/** pin：白色水滴 + badge。size「sm」(pin/focuse_s) |「lg」(pin/focuse_l) */
export function pinHTML({ size = "sm", ...badge } = {}) {
  const shape = size === "lg"
    ? `<svg class="ds-pin__shape" viewBox="0 0 56 68" aria-hidden="true"><path transform="translate(${PIN_L.bodyAt})" d="${PIN_L.body}"/></svg>`
    : `<svg class="ds-pin__shape" viewBox="0 0 32 36" aria-hidden="true"><path transform="translate(${PIN_S.bodyAt})" d="${PIN_S.body}"/><path transform="translate(${PIN_S.edgeAt})" d="${PIN_S.edge}"/></svg>`;
  return `<span class="ds-pin${size === "lg" ? " ds-pin--lg" : ""}">${shape}${pinBadgeHTML({ ...badge, size })}</span>`;
}

/** pin set：名字在上、pin 在下（sm 一般字、lg 粗體字） */
export function pinSetHTML({ size = "sm", label = "name", ...badge } = {}) {
  return `<span class="ds-pin-set">${pinLabelHTML({ text: label, focus: size === "lg" })}${pinHTML({ size, ...badge })}</span>`;
}

/**
 * pin_timeline：行程時間軸那一欄
 * type：「empty」（只有點點線）|「badge」|「time」（Figma w/time）|「text」
 * dotTop／dotBottom：上下的點點線（Figma 的 dot line top／bottom）
 * badge：badge 的設定（同 pinBadgeHTML）；time：時間；text：文字（例如 Day end）
 */
export function pinTimelineHTML({ type = "badge", dotTop = true, dotBottom = true, badge = {}, time = "08:00", text = "Day end" } = {}) {
  const b = pinBadgeHTML(badge);
  let inner = "";
  if (type === "empty") inner = dividerDotHTML({ height: 27 });
  else if (type === "badge") inner = `${b}${dotBottom ? dividerDotHTML({ height: 11 }) : ""}`;
  else if (type === "time") inner = `${dotTop ? dividerDotHTML({ height: 9 }) : ""}<span class="ds-pin-timeline__top">${b}<span class="ds-pin-timeline__text">${esc(time)}</span></span>${dotBottom ? dividerDotHTML({ height: 9 }) : ""}`;
  else inner = `<span class="ds-pin-timeline__top"><span class="ds-pin-timeline__text">${esc(text)}</span></span>`;
  return `<span class="ds-pin-timeline ds-pin-timeline--${type}">${inner}</span>`;
}
