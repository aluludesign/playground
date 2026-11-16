import "./iris-button.css";
import { startSheen, pressFlash } from "./sheen.js";

// Figma 的 auto_awesome（161119:4210），改成吃 currentColor，顏色跟著文字走
export const AUTO_AWESOME = `<svg class="ds-iris-btn__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 9L20.25 6.25L23 5L20.25 3.75L19 1L17.75 3.75L15 5L17.75 6.25L19 9Z"/><path d="M19 15L17.75 17.75L15 19L17.75 20.25L19 23L20.25 20.25L23 19L20.25 17.75L19 15Z"/><path d="M11.5 9.5L9 4L6.5 9.5L1 12L6.5 14.5L9 20L11.5 14.5L17 12L11.5 9.5ZM9.99 12.99L9 15.17L8.01 12.99L5.83 12L8.01 11.01L9 8.83L9.99 11.01L12.17 12L9.99 12.99Z"/></svg>`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * 產生 Dynamic Iris 按鈕的 HTML。
 * size: "sm" | "default" | "lg"；state: 只給文件頁固定顯示用（"hover" | "pressed" | "focus"）
 */
export function irisButtonHTML({ label = "Make wishes", size = "default", leadingIcon = true, showText = true, disabled = false, state } = {}) {
  const cls = ["ds-iris-btn"];
  if (size === "sm") cls.push("ds-iris-btn--sm");
  if (size === "lg") cls.push("ds-iris-btn--lg");
  if (state) cls.push("is-" + state);
  return `<button type="button" class="${cls.join(" ")}"${disabled ? " disabled" : ""}${!showText ? ` aria-label="${esc(label)}"` : ""}><span class="ds-iris-btn__surface"><span class="ds-iris-btn__flash"></span></span><span class="ds-iris-btn__layer">${leadingIcon ? AUTO_AWESOME : ""}${showText ? `<span class="ds-iris-btn__label">${esc(label)}</span>` : ""}</span></button>`;
}

/** 讓頁面上的虹光開始流動，並幫 .ds-iris-btn 接上點擊回饋 */
export function wireIris(container) {
  startSheen();
  container.addEventListener("click", (e) => {
    const b = e.target.closest(".ds-iris-btn");
    if (b && !b.disabled && !b.classList.contains("is-disabled")) pressFlash(b);
  });
}
