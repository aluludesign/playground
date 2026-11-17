import "../pattern.css";
import "./bottom-nav.css";
import { wireWiggle } from "../wiggle.js";

const raw = import.meta.glob("../icons/general/*.svg", { query: "?raw", import: "default", eager: true });
const svgOf = (file) => raw[`../icons/general/${file}.svg`] || "";

// Figma bottom nav/main 裡的 5 格（icon 名稱照 Figma，含原本的拼字；第 2 格是「許願」）
export const DEFAULT_ITEMS = [
  { key: "plan", label: "行程", icon: "icon_calender_sticker" },
  { key: "wish", label: "許願", icon: "icon_start_heart_duotone" },
  { key: "transport", label: "交通", icon: "icon_flight_duotone" },
  { key: "spend", label: "花費", icon: "icon_peoploe_plus_duotone" },
  { key: "split", label: "分帳", icon: "icon_circle_triangel_down_duotone" },
];

function iconHTML(file) {
  const svg = svgOf(file);
  const m = svg.match(/<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/);
  const [w, h] = m ? [m[1], m[2]] : [24, 24];
  return `<span class="ds-bottom-nav__icon" style="--w:${w};--h:${h}" aria-hidden="true">${svg}</span>`;
}

/** items: [{ key, label, icon }]；active: 目前這頁的 key */
export function bottomNavHTML({ items = DEFAULT_ITEMS, active = "plan", label = "主要導覽" } = {}) {
  return `<nav class="ds-bottom-nav ds-pattern ds-pattern--primary-soft ds-wiggle-border ds-wiggle--outline-50" aria-label="${label}">
${items
  .map(
    (it) => `<button type="button" class="ds-bottom-nav__item${it.key === active ? " is-active" : ""}" data-key="${it.key}"${it.key === active ? ' aria-current="page"' : ""} aria-label="${it.label}">
  <span class="ds-bottom-nav__circle ds-pattern ds-pattern--tertiary">${iconHTML(it.icon)}<span class="ds-bottom-nav__label">${it.label}</span></span>
</button>`,
  )
  .join("")}
</nav>`;
}

/** 點一格就切成 active；畫外框的抖動線 */
export function wireBottomNav(root) {
  root.querySelectorAll(".ds-bottom-nav").forEach((nav) => {
    nav.addEventListener("click", (e) => {
      const btn = e.target.closest(".ds-bottom-nav__item");
      if (!btn) return;
      nav.querySelectorAll(".ds-bottom-nav__item").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        on ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current");
      });
    });
  });
  wireWiggle(root);
}
