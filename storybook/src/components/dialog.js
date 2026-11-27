import "../pattern.css";
import "../pen-line.css";
import "./dialog.css";
import { wireWiggle } from "../wiggle.js";
import { drawPenLine, penMarkerHTML } from "../pen-line.js";
import { buttonHTML } from "./button.js";
import { markerButtonHTML } from "./marker-button.js";
import cross from "../icons/general/icon_cross_outlined.svg?raw";
import arrow from "../icons/material/arrow_forward.svg?raw";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const CROSS = cross.replace("<svg", '<svg class="ds-btn__icon" aria-hidden="true"');
let uid = 0;

/**
 * 對話框（Figma「dialogue」）
 * title：標題；description：標題下的說明（Show descriptions：給 "" 就不顯示）
 * close：右上角關閉鈕（Show close button）
 * cancel／confirm：下面兩顆按鈕的字（Show actions：兩個都給 "" 就整排不顯示；只給一個就只有那一顆）
 * content：中間的內容（HTML 字串，自由替換，例如 textAreaHTML()、sectionTitleHTML()＋fieldHTML()）
 * drawn：標題的螢光筆一開始就畫好（false＝打開時再由左往右畫出來）
 */
export function dialogHTML({
  title = "淺草寺",
  description = "",
  close = true,
  cancel = "取消",
  confirm = "送出許願",
  content = "",
  drawn = true,
  label = "",
} = {}) {
  const id = `ds-dialog-${++uid}`;
  const actions = cancel || confirm
    ? `<div class="ds-dialog__actions">${cancel ? buttonHTML({ label: cancel, color: "secondary", variant: "text", size: "md", leadingIcon: false }).replace('class="ds-btn', 'data-dialog="cancel" class="ds-btn') : ""}${confirm ? markerButtonHTML({ label: confirm, size: "lg" }).replace('class="ds-marker', 'data-dialog="confirm" class="ds-marker') : ""}</div>`
    : "";
  const mods = (close ? " ds-dialog--closable" : "") + (description ? " ds-dialog--has-desc" : "") + (actions ? " ds-dialog--has-actions" : "");
  return `<div class="ds-dialog${mods}" role="dialog" aria-modal="true" aria-labelledby="${id}-title"${description ? ` aria-describedby="${id}-desc"` : ""}${label ? ` aria-label="${esc(label)}"` : ""}>
<div class="ds-dialog__body ds-pattern ds-pattern--bright ds-wiggle-border"><div class="ds-dialog__inner">
<div class="ds-dialog__header"><div class="ds-dialog__title-row"><div class="ds-dialog__title" role="heading" aria-level="2" id="${id}-title">${penMarkerHTML({ drawn, color: "primary" })}<span class="ds-dialog__title-text">${esc(title)}</span></div>${close ? buttonHTML({ label: "關閉", color: "secondary", variant: "icon-outlined", size: "xs", icon: CROSS }).replace('class="ds-btn', 'data-dialog="close" class="ds-dialog__close ds-btn') : ""}</div>${description ? `<div class="ds-dialog__desc-wrap"><p class="ds-dialog__desc" id="${id}-desc">${esc(description)}</p></div>` : ""}</div>
<div class="ds-dialog__scroll">${content ? `<div class="ds-dialog__content">${content}</div>` : ""}</div>
${actions}
</div></div></div>`;
}

/** 段落標題（Figma「Section title」）；icon：前面放 arrow_forward */
export function sectionTitleHTML({ text = "淺草寺", icon = false, level = 3 } = {}) {
  return `<div class="ds-section-title" role="heading" aria-level="${level}">${icon ? `<span class="ds-section-title__icon" aria-hidden="true">${arrow}</span>` : ""}<span>${esc(text)}</span></div>`;
}

/** 一段＝標題＋裡面的東西（Figma「replace containt/contain section template」的 section） */
export function dialogSectionHTML({ title = "淺草寺", icon = false, content = "" } = {}) {
  return `<div class="ds-dialog-section">${sectionTitleHTML({ text: title, icon })}${content}</div>`;
}

/**
 * 按鈕的事件：關閉鈕、取消 → ds-dialog-close（detail.reason："close"｜"cancel"）；送出 → ds-dialog-confirm
 * 也幫外框畫抖動線。真的要不要關起來由用的人決定（例如改過內容就不能點外面關）。
 */
export function wireDialog(root = document) {
  root.querySelectorAll(".ds-dialog").forEach((d) => {
    if (d.dataset.wired) return;
    d.dataset.wired = "1";
    d.addEventListener("click", (e) => {
      const b = e.target.closest("[data-dialog]");
      if (!b || !d.contains(b)) return;
      const kind = b.dataset.dialog;
      if (kind === "confirm") d.dispatchEvent(new CustomEvent("ds-dialog-confirm", { bubbles: true }));
      else d.dispatchEvent(new CustomEvent("ds-dialog-close", { bubbles: true, detail: { reason: kind } }));
    });
    // 說明在原地淡出：內容往上捲多少，說明就讓出多少高度（上緣不動，從下往上收），同時變淡；捲回最上面再出現。
    // 讓出的高度不會超過「還能捲的距離的一半」，內容只多一點點時不會來回跳
    const scroll = d.querySelector(".ds-dialog__scroll");
    const wrap = d.querySelector(".ds-dialog__desc-wrap");
    if (scroll && wrap) {
      const fade = () => {
        const full = wrap.firstElementChild.offsetHeight;
        const c = Math.min(scroll.scrollTop, full);
        wrap.style.height = full - c + "px";
        wrap.style.setProperty("--dialog-desc-collapse", (c / full).toFixed(3));
      };
      scroll.addEventListener("scroll", fade, { passive: true });
      new ResizeObserver(fade).observe(wrap.firstElementChild);
    }
  });
  wireWiggle(root);
}

/**
 * 打開：把對話框放進一層蓋住整個畫面的 layer（置中、進場動態），標題的螢光筆接著畫出來
 * 回傳 layer；用 closeDialog(layer) 關起來
 */
export function openDialog(html, { parent = document.body } = {}) {
  const layer = document.createElement("div");
  layer.className = "ds-dialog-layer";
  layer.innerHTML = html;
  parent.appendChild(layer);
  wireDialog(layer);
  const pen = layer.querySelector(".ds-dialog__title .ds-pen-marker");
  if (pen && !pen.classList.contains("is-drawn")) setTimeout(() => drawPenLine(pen, true), 180);
  layer.querySelector("[data-dialog='close'], input, textarea, button")?.focus({ preventScroll: true });
  return layer;
}

export function closeDialog(layer) {
  if (!layer || layer.classList.contains("is-closing")) return;
  layer.classList.add("is-closing");
  const done = () => layer.remove();
  const d = layer.querySelector(".ds-dialog");
  if (!d || matchMedia("(prefers-reduced-motion: reduce)").matches) return done();
  d.addEventListener("animationend", done, { once: true });
  setTimeout(done, 400);
}
