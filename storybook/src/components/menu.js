import "../pattern.css";
import "./menu.css";
import { wireWiggle } from "../wiggle.js";
import check from "../icons/general/icon_check_line_duotone.svg?raw";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Figma menu 裡的範例
export const DEFAULT_ITEMS = [
  { key: "hokkaido", label: "北海道 8 日孝親之旅" },
  { key: "tokyo", label: "東京 PA PA 造 Happy Birithday" },
  { key: "kyoto", label: "京都 春季櫻花漫遊" },
];

/** items: [{ key, label }]；selected: 選中那一列的 key */
export function menuHTML({ items = DEFAULT_ITEMS, selected = "", label = "選單" } = {}) {
  return `<div class="ds-menu ds-pattern ds-pattern--bright ds-wiggle-border">
<ul class="ds-menu__list" role="menu" aria-label="${esc(label)}">
${items
  .map(
    (it) => `<li role="none"><button type="button" class="ds-menu__item" role="menuitemradio" data-key="${esc(it.key)}" aria-checked="${it.key === selected}" title="${esc(it.label)}">
  <span class="ds-menu__text">${esc(it.label)}</span><span class="ds-menu__check" aria-hidden="true">${check}</span>
</button></li>`,
  )
  .join("")}
</ul>
</div>`;
}

/** 點一列就選它（發出 ds-menu-select 事件，detail.key），並畫抖動外框 */
export function wireMenu(root = document) {
  root.querySelectorAll(".ds-menu").forEach((menu) => {
    if (menu.dataset.wired) return;
    menu.dataset.wired = "1";
    menu.addEventListener("click", (e) => {
      const btn = e.target.closest(".ds-menu__item");
      if (!btn) return;
      menu.querySelectorAll(".ds-menu__item").forEach((b) => b.setAttribute("aria-checked", String(b === btn)));
      menu.dispatchEvent(new CustomEvent("ds-menu-select", { bubbles: true, detail: { key: btn.dataset.key } }));
    });
  });
  wireWiggle(root);
}
