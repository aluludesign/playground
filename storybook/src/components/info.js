import "../wiggle.css";
import "./button.css";
import "./info.css";
import { wireWiggle } from "../wiggle.js";
import { buttonHTML } from "./button.js";
import down from "../icons/general/icon_triangel_down_duotone.svg?raw";
import up from "../icons/general/icon_triangel_up_duotone.svg?raw";

// Figma Action/info（161193:10387）：16 格裡畫 13.33 的圓
const INFO = `<svg class="ds-info__icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.333C4.32 1.333 1.333 4.32 1.333 8S4.32 14.667 8 14.667 14.667 11.68 14.667 8 11.68 1.333 8 1.333ZM8.667 11.333H7.333V7.333H8.667V11.333ZM8.667 6H7.333V4.667H8.667V6Z"/></svg>`;
// 箭頭跟著文字顏色（Figma 綁 on tertiary container）
const arrow = (svg) => svg.replace(/fill="#652D15"/gi, 'fill="currentColor"').replace("<svg", '<svg aria-hidden="true"');
const DOWN = arrow(down);
const UP = arrow(up);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// **重點字** → 粗體
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

/**
 * 提示（Figma shared comps「info」）
 * text：說明，用 **兩個星號** 包起來的字會變粗體（Figma 的 label/md/semi-bold）
 * expanded：false = collapse（一行，超過用…）／true = expend
 * type：「info」（淡藍）｜「default」（中性：surface 底、outline 300 框、text 100、按鈕 Secondary、寬度跟著內容）
 * leadingIcon / collapseIcon / button：對應 Figma 的 Show leading icon／Show collapse icon／Show btn
 * buttonLabel：按鈕文字（預設「不再提醒」）
 */
export function infoHTML({
  text = "直接許願**淺草寺**，願望地圖上不會出現地點指標",
  expanded = false,
  type = "info",
  leadingIcon = true,
  collapseIcon = true,
  button = true,
  buttonLabel = "不再提醒",
} = {}) {
  const toggle = collapseIcon
    ? `<button type="button" class="ds-info__toggle" aria-expanded="${expanded}" aria-label="${expanded ? "收合" : "展開"}">${expanded ? UP : DOWN}</button>`
    : "";
  const btn = button
    ? buttonHTML({ label: buttonLabel, color: type === "default" ? "secondary" : "tertiary", variant: "text", size: "xs", leadingIcon: false }).replace('class="ds-btn', 'class="ds-info__btn ds-btn')
    : "";
  return `<div class="ds-info${type === "default" ? " ds-info--default" : ""}${expanded ? " is-expanded" : ""}" role="note"><span class="ds-info__bg" aria-hidden="true"></span><div class="ds-info__body ds-wiggle-border">${leadingIcon ? INFO : ""}<p class="ds-info__text">${rich(text)}</p>${toggle}${btn}</div></div>`;
}

/** 點箭頭展開／收合（發出 ds-info-toggle）；點按鈕發出 ds-info-dismiss（要不要關掉由外面決定）；畫抖動外框 */
export function wireInfo(root = document) {
  root.querySelectorAll(".ds-info").forEach((info) => {
    if (info.dataset.wired) return;
    info.dataset.wired = "1";
    info.addEventListener("click", (e) => {
      const t = e.target.closest(".ds-info__toggle");
      if (t) {
        const open = !info.classList.contains("is-expanded");
        info.classList.toggle("is-expanded", open);
        t.setAttribute("aria-expanded", String(open));
        t.setAttribute("aria-label", open ? "收合" : "展開");
        t.innerHTML = (open ? UP : DOWN);
        info.dispatchEvent(new CustomEvent("ds-info-toggle", { bubbles: true, detail: { expanded: open } }));
        return;
      }
      if (e.target.closest(".ds-info__btn")) info.dispatchEvent(new CustomEvent("ds-info-dismiss", { bubbles: true }));
    });
  });
  wireWiggle(root);
}
