import "../pattern.css";
import "./segmented.css";
import { penLineSVG, drawPenLine } from "../pen-line.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Figma segmented 裡的範例
export const DEFAULT_ITEMS = [
  { key: "none", label: "不選地點" },
  { key: "any", label: "不指定地點" },
];

/** 一格頁籤。Default 是淡橘格（primary-soft），選中換成 surface */
export function segmentedItemHTML({ key = "", label = "", selected = false, state } = {}) {
  const pattern = selected ? "ds-pattern--surface" : "ds-pattern--primary-soft";
  return `<button type="button" role="tab" class="ds-segmented__item ds-pattern ${pattern}${state ? " is-" + state : ""}" data-key="${esc(key)}" aria-selected="${selected}" tabindex="${selected ? 0 : -1}"><span class="ds-segmented__label">${penLineSVG({ drawn: selected, cls: "ds-segmented__line" })}<span class="ds-segmented__text">${esc(label)}</span></span></button>`;
}

/** items: [{ key, label }]；selected: 選中的 key */
export function segmentedHTML({ items = DEFAULT_ITEMS, selected = items[0]?.key, label = "分頁" } = {}) {
  return `<div class="ds-segmented" role="tablist" aria-label="${esc(label)}">${items
    .map((it) => segmentedItemHTML({ ...it, selected: it.key === selected }))
    .join("")}</div>`;
}

function select(root, btn) {
  root.querySelectorAll(".ds-segmented__item").forEach((b) => {
    const on = b === btn;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
    b.classList.toggle("ds-pattern--surface", on);
    b.classList.toggle("ds-pattern--primary-soft", !on);
    const line = b.querySelector(".ds-pen-line");
    if (line) drawPenLine(line, on); // 選到的那格：筆由左往右把線畫出來
  });
  root.dispatchEvent(new CustomEvent("ds-segmented-select", { bubbles: true, detail: { key: btn.dataset.key } }));
}

/**
 * segmented sheet：上面一排頁籤、下面一張放內容的底（Figma「segmented sheet」）。
 * 內容可以自由替換（containt replaced）：content 傳任何 HTML；切頁籤時聽 ds-segmented-select 自己換內容。
 */
export function segmentedSheetHTML({ items = DEFAULT_ITEMS, selected = items[0]?.key, label = "分頁", content = "" } = {}) {
  return `<div class="ds-segmented-sheet">${segmentedHTML({ items, selected, label })}<div class="ds-segmented-sheet__body ds-pattern ds-pattern--surface" role="tabpanel"><div class="ds-segmented-sheet__content">${content}</div></div></div>`;
}

/** 點一格就選它（發出 ds-segmented-select，detail.key）；左右鍵切換 */
export function wireSegmented(container = document) {
  container.querySelectorAll(".ds-segmented").forEach((root) => {
    if (root.dataset.wired) return;
    root.dataset.wired = "1";
    root.addEventListener("click", (e) => {
      const btn = e.target.closest(".ds-segmented__item");
      if (btn) select(root, btn);
    });
    root.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const tabs = [...root.querySelectorAll(".ds-segmented__item")];
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      next.focus();
      select(root, next);
      e.preventDefault();
    });
  });
}
