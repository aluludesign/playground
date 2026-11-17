import "../pattern.css";
import "./bottom-nav.css";
import { wireWiggle } from "../wiggle.js";

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
  if (style === "sticker") {
    // 上色層＝半透明的筆刷形狀（白底、深棕線稿不動：線稿沒有 opacity，或是 opacity ≥ 0.5 的深棕，例如飛機）。
    // 每一塊由一支看不見的筆從左上往右下畫出來（遮罩在 wireBottomNav 量好大小後才加上）。
    svg = svg.replace(/<(path|rect)(\s+opacity="([\d.]+)")([^>]*?)(\s*\/?)>/g, (all, tag, opAttr, op, rest, close) => {
      if (/#652D15/i.test(rest) && +op >= 0.5) return all;
      const color = (rest.match(/\s(?:fill|stroke)="(#[0-9a-f]{3,8})"/i) || [])[1] || "currentColor";
      return `<${tag} class="ds-bottom-nav__pen" style="--pen:${color}"${opAttr}${rest}${close}>`;
    });
  }
  return svg.replace("<svg", `<svg class="${cls}" style="--w:${w};--h:${h}"`);
}

function iconHTML(name) {
  return `<span class="ds-bottom-nav__icon" aria-hidden="true">${styled(name, "duotone", "is-default-style")}${styled(name, "sticker", "is-active-style")}</span>`;
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

const NS = "http://www.w3.org/2000/svg";
let maskId = 0;

/** 幫 sticker 的每一塊上色加一個「從左上掃到右下」的遮罩，並照位置排好先後（左上的先畫） */
function preparePen(svg) {
  if (svg.dataset.pen) return;
  const pens = [...svg.querySelectorAll(".ds-bottom-nav__pen")];
  const boxes = pens.map((p) => p.getBBox());
  if (!boxes.some((b) => b.width)) return; // 還沒排版好，下次再量
  svg.dataset.pen = "1";
  let defs = svg.querySelector("defs");
  if (!defs) defs = svg.insertBefore(document.createElementNS(NS, "defs"), svg.firstChild);
  const gid = `ds-nav-sweep-g-${++maskId}`;
  // 斜向漸層：左上半邊白（看得到）、右下半邊透明，中間一小段柔邊像筆刷邊緣
  defs.insertAdjacentHTML(
    "beforeend",
    `<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset=".44" stop-color="#fff"/><stop offset=".56" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
  );
  const order = pens.map((p, k) => k).sort((a, b) => boxes[a].x + boxes[a].y - (boxes[b].x + boxes[b].y));
  order.forEach((k, i) => {
    const b = boxes[k], pad = 2;
    const x = b.x - pad, y = b.y - pad, w = b.width + pad * 2, h = b.height + pad * 2;
    const id = `ds-nav-sweep-${++maskId}`;
    defs.insertAdjacentHTML(
      "beforeend",
      `<mask id="${id}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}"><rect class="ds-bottom-nav__sweep" x="${x - w}" y="${y - h}" width="${w * 2}" height="${h * 2}" fill="url(#${gid})" style="--i:${i};--sx:${w}px;--sy:${h}px"/></mask>`,
    );
    pens[k].setAttribute("mask", `url(#${id})`);
    pens[k].style.setProperty("--i", i);
  });
}

/** 點一格就切成 active；畫外框的抖動線 */
export function wireBottomNav(root) {
  root.querySelectorAll(".ds-bottom-nav").forEach((nav) => {
    // default 的縮放比例 = icon/md ÷ active-icon（兩個都是 token）
    const cs = getComputedStyle(nav);
    const md = parseFloat(cs.getPropertyValue("--ds-sys-icon-md"));
    const lg = parseFloat(cs.getPropertyValue("--ds-comp-bottom-nav-active-icon"));
    if (md && lg) nav.style.setProperty("--nav-scale", String(md / lg));
    nav.querySelectorAll(".is-active-style").forEach(preparePen);
    nav.addEventListener("click", (e) => {
      const btn = e.target.closest(".ds-bottom-nav__item");
      if (!btn) return;
      nav.querySelectorAll(".is-active-style").forEach(preparePen);
      nav.querySelectorAll(".ds-bottom-nav__item").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        on ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current");
      });
    });
  });
  wireWiggle(root);
}
