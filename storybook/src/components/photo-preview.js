import "./button.css";
import "./photo-preview.css";
import { buttonHTML } from "./button.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// Figma arrow_back_ios／arrow_forward_ios（Material），跟著文字顏色
const BACK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.51 3.87 15.73 2.1 5.84 12l9.9 9.9 1.77-1.77L9.38 12l8.13-8.13Z"/></svg>`;
const NEXT = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.23 20.23 8 22l10-10L8 2 6.23 3.77 14.46 12l-8.23 8.23Z"/></svg>`;
const CROSS = `<svg class="ds-btn__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"/></svg>`;

/**
 * 照片預覽（Figma 161747:16541）：整頁蓋在畫面上，背景模糊
 * photos：[{ src, thumb }]（thumb 不給就用 src）；at：現在是第幾張
 * title：名稱；credit／creditURL：出處（例：「照片:維基共享資源」，點了開那一頁）
 * 左右箭頭、點縮圖換張 → 發出 ds-photo-at（detail.index）；✕ → ds-photo-close
 */
export function photoPreviewHTML({ photos = [], at = 0, title = "", credit = "", creditURL = "" } = {}) {
  const list = photos.filter((p) => p && p.src);
  const cur = list[at] || list[0] || { src: "" };
  const thumbs = list.length > 1
    ? `<div class="ds-photo__slot">
<button type="button" class="ds-photo__nav" data-step="-1" aria-label="上一張"${at <= 0 ? " disabled" : ""}>${BACK}</button>
<div class="ds-photo__thumbs">${list.map((p, i) => `<button type="button" class="ds-photo__thumb${i === at ? " is-on" : ""}" data-index="${i}" aria-label="第 ${i + 1} 張"${i === at ? ' aria-current="true"' : ""}><img src="${esc(p.thumb || p.src)}" alt="" loading="lazy"></button>`).join("")}</div>
<button type="button" class="ds-photo__nav" data-step="1" aria-label="下一張"${at >= list.length - 1 ? " disabled" : ""}>${NEXT}</button>
</div>`
    : "";
  const cr = credit ? (creditURL ? `<a class="ds-photo__credit" href="${esc(creditURL)}" target="_blank" rel="noopener">${esc(credit)}</a>` : `<span class="ds-photo__credit">${esc(credit)}</span>`) : "";
  return `<div class="ds-photo" role="dialog" aria-modal="true" aria-label="${esc(title || "照片")}">
<div class="ds-photo__content">
<img class="ds-photo__big" src="${esc(cur.src)}" alt="${esc(title)}">
${title ? `<h2 class="ds-photo__title">${esc(title)}</h2>` : ""}
${thumbs}
<div class="ds-photo__info">${cr}${buttonHTML({ label: "關閉", variant: "icon", size: "sm", icon: CROSS }).replace("<button ", '<button data-close="1" ')}</div>
</div>
</div>`;
}

export function wirePhotoPreview(root, { count = 0 } = {}) {
  const box = root.querySelector(".ds-photo");
  if (!box || box.dataset.wired) return;
  box.dataset.wired = "1";
  box.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]") || e.target === box) return box.dispatchEvent(new CustomEvent("ds-photo-close", { bubbles: true }));
    const t = e.target.closest(".ds-photo__thumb");
    if (t) return box.dispatchEvent(new CustomEvent("ds-photo-at", { bubbles: true, detail: { index: +t.dataset.index } }));
    const n = e.target.closest(".ds-photo__nav");
    if (n && !n.disabled) {
      const cur = box.querySelector(".ds-photo__thumb.is-on");
      const i = (cur ? +cur.dataset.index : 0) + +n.dataset.step;
      box.dispatchEvent(new CustomEvent("ds-photo-at", { bubbles: true, detail: { index: Math.max(0, Math.min((count || 99) - 1, i)) } }));
    }
  });
}
