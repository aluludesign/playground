import "../pattern.css";
import "./bottom-nav.css";
import { wireWiggle } from "../wiggle.js";
import { markPenLayers, preparePenBrush, drawPenBrush } from "../pen-brush.js";

const raw = import.meta.glob("../icons/general/*.svg", { query: "?raw", import: "default", eager: true });
const svgOf = (file) => raw[`../icons/general/${file}.svg`] || "";

// Figma bottom nav/main 裡的 5 格（icon 名稱照 Figma，含原本的拼字）
// default 用 duotone、active 用 sticker（Figma bottom nav/items）
export const DEFAULT_ITEMS = [
  { key: "plan", label: "行程", icon: "calender" },
  { key: "wish", label: "許願", icon: "start_heart" },
  { key: "transport", label: "交通", icon: "flight" },
  { key: "spend", label: "花費", icon: "peoploe_plus" },
  { key: "split", label: "分帳", icon: "circle_triangel_down" },
];

function styled(name, style, cls) {
  let svg = svgOf(`icon_${name}_${style}`);
  const m = svg.match(/<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/);
  const [w, h] = m ? [+m[1], +m[2]] : [24, 24];
  // sticker 的上色由一支看不見的筆畫出來（pen-brush：遮罩在 wireBottomNav 量好大小後才加上）
  if (style === "sticker") svg = markPenLayers(svg);
  // duotone 的白底（第一塊 fill="white"）標起來：切到 active 時白底先退，只留線稿疊在 sticker 上面等筆畫
  if (style === "duotone") svg = svg.replace(/<path(?=[^>]*fill="white")/i, '<path class="ds-bottom-nav__base"');
  return svg.replace("<svg", `<svg class="${cls}" style="--w:${w};--h:${h}"`);
}

function iconHTML(name, active) {
  return `<span class="ds-bottom-nav__icon" aria-hidden="true">${styled(name, "duotone", "is-default-style")}${styled(name, "sticker", `is-active-style ds-pen-brush${active ? " is-drawn" : ""}`)}</span>`;
}

/** items: [{ key, label, icon }]；active: 目前這頁的 key */
export function bottomNavHTML({ items = DEFAULT_ITEMS, active = "plan", label = "主要導覽" } = {}) {
  return `<nav class="ds-bottom-nav ds-pattern ds-pattern--primary-soft ds-wiggle-border ds-wiggle--outline-50" aria-label="${label}">
${items
  .map(
    (it) => `<button type="button" class="ds-bottom-nav__item${it.key === active ? " is-active" : ""}" data-key="${it.key}"${it.key === active ? ' aria-current="page"' : ""} aria-label="${it.label}">
  <span class="ds-bottom-nav__circle ds-pattern ds-pattern--tertiary" aria-hidden="true"></span>${iconHTML(it.icon, it.key === active)}<span class="ds-bottom-nav__label">${it.label}</span>
</button>`,
  )
  .join("")}
</nav>`;
}

/** 點一格就切成 active；畫外框的抖動線 */
export function wireBottomNav(root) {
  root.querySelectorAll(".ds-bottom-nav").forEach((nav) => {
    // default 的縮放比例 = icon/md ÷ active-icon（兩個都是 token）
    const cs = getComputedStyle(nav);
    const md = parseFloat(cs.getPropertyValue("--ds-sys-icon-md"));
    const lg = parseFloat(cs.getPropertyValue("--ds-comp-bottom-nav-active-icon"));
    if (md && lg) nav.style.setProperty("--nav-scale", String(md / lg));
    nav.querySelectorAll(".is-active-style").forEach((sticker) => {
      preparePenBrush(sticker);
      // duotone 等筆刷上色畫到 70% 才淡出：開始畫 + 70% ×（最後一塊開始的時間 + 掃一塊的時間）
      const sc = getComputedStyle(sticker);
      const sec = (name, d) => {
        const v = sc.getPropertyValue(name).trim();
        const n = parseFloat(v);
        return Number.isFinite(n) ? (v.endsWith("ms") ? n / 1000 : n) : d;
      };
      const layers = sticker.querySelectorAll(".ds-pen-brush__layer").length;
      const total = Math.max(0, layers - 1) * sec("--pen-gap", 0.07) + sec("--pen-draw", 0.3);
      const item = sticker.closest(".ds-bottom-nav__item");
      if (item && layers) item.style.setProperty("--nav-duo-delay", `${(sec("--pen-start", 0.2) + total * 0.7).toFixed(3)}s`);
    });
    nav.addEventListener("click", (e) => {
      const btn = e.target.closest(".ds-bottom-nav__item");
      if (!btn) return;
      nav.querySelectorAll(".ds-bottom-nav__item").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        on ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current");
        const sticker = b.querySelector(".is-active-style");
        if (sticker) drawPenBrush(sticker, on);
      });
    });
  });
  wireWiggle(root);
}
