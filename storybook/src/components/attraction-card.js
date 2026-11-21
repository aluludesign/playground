import "../pattern.css";
import "../wiggle.css";
import "../pen-line.css";
import "./attraction-card.css";
import { wireWiggle } from "../wiggle.js";
import { penMarkerHTML } from "../pen-line.js";
import { revealPens } from "../pen-reveal.js";
import { scrimButtonHTML } from "./scrim-button.js";
import { likesHTML } from "./wish-card.js";
import arrow from "../icons/general/icon_subdirectory_arrow_right_outlined.svg?raw";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const tint = (svg, cls) => svg.replace(/fill="#[0-9a-f]{3,8}"/gi, 'fill="currentColor"').replace("<svg", `<svg class="${cls}" aria-hidden="true"`);
// Figma open_in_new（161119:10482，Material 的那一顆）
const openNew = `<svg viewBox="0 0 24 24"><path fill="#652D15" d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7ZM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7Z"/></svg>`;
const isURL = (v) => /^https?:\/\/\S+$/i.test(String(v || ""));

/**
 * 當日細節卡片（Figma「attraction card」162182:18508）
 * photos：照片網址，最多 6 張（含團員上傳的），可左右滑；下面的圓點是第幾張
 * title：名稱（標題螢光筆）；meta：["日本，東京都", "景點"]；mapURL：點地點那一行開 Google 地圖
 * info：[{ label: "類別", value: "宗教場所…" }, { label: "網站", value: "https://…" }]
 *       值是網址的會變成連結（一律底線＋primary）；沒有的那一列就不給
 * wisher／note：許願人和留言（有人許願有留言才有）
 * likes：likesHTML 的設定（Figma 標題右邊的喜歡；行程的卡沒有就不給）
 * footer：卡片最下面再接的東西（Figma 搜尋結果那張：留言框 command text area）
 * color：標題螢光筆的顏色（Figma active_bg/line_lg，custom 1–14，預設 5；行程用那天的顏色，跟時間軸同一個）
 * closeLabel：右上角 ✕ 的名字；不給就不放
 * 點 ✕ 發出 ds-card-close；點照片發出 ds-card-photo（detail.index）
 */
export function attractionCardHTML({ photos = [], title = "淺草寺", meta = ["日本，東京都", "景點"], mapURL = "", info = [], wisher = "", note = "", likes = null, footer = "", color = 5, closeLabel = "關閉" } = {}) {
  const pics = photos.filter(Boolean).slice(0, 6);
  const gallery = pics.length
    ? `<div class="ds-acard__photos">
<div class="ds-acard__track">${pics.map((src, i) => `<button type="button" class="ds-acard__photo" data-index="${i}" aria-label="看第 ${i + 1} 張照片"><img src="${esc(src)}" alt="" loading="${i ? "lazy" : "eager"}"></button>`).join("")}</div>
${closeLabel ? `<div class="ds-acard__close">${scrimButtonHTML({ icon: "cross", size: "md", label: closeLabel })}</div>` : ""}
${pics.length > 1 ? `<div class="ds-acard__dots" aria-hidden="true">${pics.map((_, i) => `<span${i ? "" : ' class="is-on"'}></span>`).join("")}</div>` : '<div class="ds-acard__dots" aria-hidden="true"></div>'}
</div>`
    : closeLabel ? `<div class="ds-acard__close ds-acard__close--bare">${scrimButtonHTML({ icon: "cross", size: "md", label: closeLabel })}</div>` : "";
  const where = meta.filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join('<span aria-hidden="true">‧</span>');
  const loc = mapURL
    ? `<a class="ds-acard__loc" href="${esc(mapURL)}" target="_blank" rel="noopener">${where}${tint(openNew, "ds-acard__loc-icon")}</a>`
    : where ? `<span class="ds-acard__loc">${where}</span>` : "";
  const rows = info
    .filter((r) => r && r.value)
    .map((r) => `<li><span>${esc(r.label)}：</span>${isURL(r.value) ? `<a href="${esc(r.value)}" target="_blank" rel="noopener">${esc(r.value.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a>` : esc(r.value)}</li>`)
    .join("");
  const wish = note || wisher
    ? `<div class="ds-acard__wish">
${wisher ? `<span class="ds-acard__wisher">${tint(arrow, "ds-acard__wisher-icon")}${esc(wisher)}</span>` : ""}
${note ? `<p class="ds-acard__note">${esc(note)}<span class="ds-wiggle-line ds-wiggle--outline-200" aria-hidden="true"></span></p>` : ""}
</div>`
    : "";
  return `<article class="ds-acard ds-pattern">
${gallery}
<div class="ds-acard__body">
<div class="ds-acard__top">
${likes ? `<div class="ds-acard__likes">${likesHTML(likes)}</div>` : ""}
<h2 class="ds-acard__title"><span class="ds-acard__mark" data-pen="card-${esc(title)}">${penMarkerHTML({ color: `custom ${color}` })}<span>${esc(title)}</span></span></h2>
${loc}
</div>
${rows ? `<ul class="ds-acard__info">${rows}</ul>` : ""}
${wish}
</div>
${footer ? `<div class="ds-acard__footer">${footer}</div>` : ""}
</article>`;
}

/** 照片滑動時換圓點；✕ → ds-card-close；點照片 → ds-card-photo */
export function wireAttractionCard(root = document) {
  root.querySelectorAll(".ds-acard").forEach((card) => {
    if (card.dataset.wired) return;
    card.dataset.wired = "1";
    const track = card.querySelector(".ds-acard__track");
    const dots = card.querySelectorAll(".ds-acard__dots span");
    if (track && dots.length) {
      track.addEventListener("scroll", () => {
        const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        dots.forEach((d, k) => d.classList.toggle("is-on", k === i));
      }, { passive: true });
    }
    card.addEventListener("click", (e) => {
      if (e.target.closest(".ds-acard__close")) return card.dispatchEvent(new CustomEvent("ds-card-close", { bubbles: true }));
      const like = e.target.closest("[data-like]");
      if (like) return like.dispatchEvent(new CustomEvent("ds-like", { bubbles: true, detail: { key: like.dataset.like } }));
      const p = e.target.closest(".ds-acard__photo");
      if (p) card.dispatchEvent(new CustomEvent("ds-card-photo", { bubbles: true, detail: { index: +p.dataset.index } }));
    });
  });
  wireWiggle(root);
  revealPens(root);
}
