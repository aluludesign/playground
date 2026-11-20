import "../pattern.css";
import "./button.css";
import "./search-frame.css";
import { buttonHTML } from "./button.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const CROSS = `<svg class="ds-btn__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"/></svg>`;

/**
 * 搜尋框（Figma「search frame」162245:10045）：許願頁那顆按鈕按下去變成這個
 * title：「想去東京哪?」（強力搜時「強力搜，再搜一次」）；content：裡面放 text field（textFieldHTML）
 * closeLabel：右上角 ✕（Button Secondary・Icon Outlined・xs）；按了發出 ds-search-close
 */
export function searchFrameHTML({ title = "想去東京哪? ", content = "", closeLabel = "關閉" } = {}) {
  return `<section class="ds-search-frame ds-pattern" aria-label="${esc(title)}">
<div class="ds-search-frame__head"><h2 class="ds-search-frame__title">${esc(title)}</h2>${buttonHTML({ label: closeLabel, color: "secondary", variant: "icon-outlined", size: "xs", icon: CROSS }).replace("<button ", '<button data-close="1" ')}</div>
<div class="ds-search-frame__body">${content}</div>
</section>`;
}

export function wireSearchFrame(root = document) {
  root.querySelectorAll(".ds-search-frame").forEach((f) => {
    if (f.dataset.wired) return;
    f.dataset.wired = "1";
    f.querySelector("[data-close]").addEventListener("click", () => f.dispatchEvent(new CustomEvent("ds-search-close", { bubbles: true })));
  });
}
