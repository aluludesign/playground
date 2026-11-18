import "../pattern.css";
import "./segmented.css";

// Active 底下那條線：照 Figma divider/wiggle（Dynamic stroke frequency 10・wiggle 1.5・smoothen 0.5）實際畫出來的形狀，
// 79 寬時跟 Figma 一模一樣；文字長短不同時只橫向伸縮，線寬不變
const LINE = `<svg class="ds-segmented__line" viewBox="-1 -3.5 81 5" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0L10.05 .08C16.68 .13 21.7 0 25 -.33L35 -1.3C38.3 -1.62 41.66 -1.81 45 -1.86L55 -2.01C58.35 -2.06 61.6 -2.13 64.75 -2.21L74.25 -2.45C77.5 -2.53 79 -2.3 79 -1.92L79 -1.28L78.9 0" vector-effect="non-scaling-stroke"/></svg>`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Figma segmented 裡的範例
export const DEFAULT_ITEMS = [
  { key: "none", label: "不選地點" },
  { key: "any", label: "不指定地點" },
];

/** 一格頁籤。Default 是淡橘格（primary-soft），選中換成 surface */
export function segmentedItemHTML({ key = "", label = "", selected = false, state } = {}) {
  const pattern = selected ? "ds-pattern--surface" : "ds-pattern--primary-soft";
  return `<button type="button" role="tab" class="ds-segmented__item ds-pattern ${pattern}${state ? " is-" + state : ""}" data-key="${esc(key)}" aria-selected="${selected}" tabindex="${selected ? 0 : -1}"><span class="ds-segmented__label">${LINE}<span class="ds-segmented__text">${esc(label)}</span></span></button>`;
}

/** items: [{ key, label }]；selected: 選中的 key；trailing: 放在最右邊的 HTML（例如 Dynamic Iris），預設沒有 */
export function segmentedHTML({ items = DEFAULT_ITEMS, selected = items[0]?.key, label = "分頁", trailing = "" } = {}) {
  return `<div class="ds-segmented" role="tablist" aria-label="${esc(label)}">${items
    .map((it) => segmentedItemHTML({ ...it, selected: it.key === selected }))
    .join("")}${trailing ? `<span class="ds-segmented__trailing">${trailing}</span>` : ""}</div>`;
}

function select(root, btn) {
  root.querySelectorAll(".ds-segmented__item").forEach((b) => {
    const on = b === btn;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
    b.classList.toggle("ds-pattern--surface", on);
    b.classList.toggle("ds-pattern--primary-soft", !on);
  });
  root.dispatchEvent(new CustomEvent("ds-segmented-select", { bubbles: true, detail: { key: btn.dataset.key } }));
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
