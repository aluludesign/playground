import "../wiggle.css";
import "../pen-line.css";
import "./divider.css";
import "./location-pin.css";
import "./timeline.css";
import { wireWiggle } from "../wiggle.js";
import { penMarkerHTML } from "../pen-line.js";
import { pinTimelineHTML } from "./location-pin.js";
import { dividerDotHTML } from "./divider.js";
import down from "../icons/general/icon_triangel_down_duotone.svg?raw";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * 疊在一起的景點照片（Figma「attraction photos」162093:14097 ＋ attraction photos/variants 162067:10813）
 * photos：照片網址（最多畫 3 張，第一張在最上面）；沒有照片就不畫
 * 點了發出 ds-photos-open（detail.key）—— Figma：點景點照片組開照片預覽
 */
export function attractionPhotosHTML({ photos = [], key = "", label = "看照片" } = {}) {
  const list = photos.filter(Boolean).slice(0, 3);
  if (!list.length) return `<span class="ds-photos ds-photos--empty" aria-hidden="true"></span>`;
  const imgs = list
    .map((src, i) => `<img class="ds-photos__img ds-photos__img--${list.length}-${i}" src="${esc(src)}" alt="" loading="lazy">`)
    .reverse()
    .join("");
  return `<button type="button" class="ds-photos" data-key="${esc(key)}" aria-label="${esc(label)}">${imgs}</button>`;
}

/**
 * 行程小卡（Figma「schedule/detail」162075:10954）：名稱（螢光筆）、地區‧類別、維基摘要（最多 2 行）、許願留言泡泡
 * align：「left」（卡在時間軸右邊，泡泡尖角朝左）｜「right」
 * color：那天的顏色（1–14），螢光筆用它
 * 引用時點整塊開當日細節 → 發出 ds-stop-open（detail.key）
 */
export function scheduleDetailHTML({ key = "", title = "淺草寺", meta = ["日本，東京都", "景點"], wiki = "", note = "", align = "left", color = 5 } = {}) {
  const info = meta.filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join('<span aria-hidden="true">‧</span>');
  return `<button type="button" class="ds-stop ds-stop--${align}" data-key="${esc(key)}">
<span class="ds-stop__title"><span class="ds-stop__mark">${penMarkerHTML({ drawn: true, color: `custom ${color}` })}<span>${esc(title)}</span></span></span>
${info ? `<span class="ds-stop__info">${info}</span>` : ""}
${wiki ? `<span class="ds-stop__wiki">${esc(wiki)}</span>` : ""}
${note ? `<span class="ds-stop__note"><span class="ds-stop__note-text">${esc(note)}</span><span class="ds-wiggle-line ds-wiggle--outline-200" aria-hidden="true"></span><span class="ds-stop__tail" aria-hidden="true"></span></span>` : ""}
</button>`;
}

/**
 * 整條時間軸（Figma slot/schedule 裡的 timeline：pin_timeline「Scheduled」→ ▼ → timeline set × N → 「Day end」）
 * items：[{ key, n, time, color, title, meta, wiki, note, photos }]；照片和小卡左右交替
 * start／end：頭尾那兩個字
 */
export function timelineHTML({ items = [], start = "Scheduled", end = "Day end", empty = "這天還沒有行程。" } = {}) {
  const rows = items
    .map((it, i) => {
      const left = i % 2 === 0; // 第 1 個：照片在左、小卡在右（Figma photos+command）
      const pin = pinTimelineHTML({ type: "time", time: it.time || "", badge: { number: it.n ?? i + 1, color: it.color || 5 }, dotTop: true, dotBottom: true });
      const photos = attractionPhotosHTML({ photos: it.photos || [], key: it.key, label: "看「" + (it.title || "") + "」的照片" });
      const card = scheduleDetailHTML({ ...it, align: left ? "left" : "right" });
      return `<div class="ds-tl__set">
<div class="ds-tl__point">${left ? `<div class="ds-tl__side ds-tl__side--photos">${photos}</div>` : `<div class="ds-tl__side ds-tl__side--card">${card}</div>`}<div class="ds-tl__pin">${pin}</div>${left ? `<div class="ds-tl__side ds-tl__side--card">${card}</div>` : `<div class="ds-tl__side ds-tl__side--photos">${photos}</div>`}</div>
<div class="ds-tl__line">${dividerDotHTML({ height: 30 })}</div>
</div>`;
    })
    .join("");
  return `<div class="ds-tl">
<div class="ds-tl__cap">${pinTimelineHTML({ type: "text", text: start })}</div>
<div class="ds-tl__caret" aria-hidden="true">${down.replace("<svg", '<svg class="ds-tl__caret-icon"')}</div>
${items.length ? rows : `<p class="ds-tl__empty">${esc(empty)}</p>`}
<div class="ds-tl__cap">${pinTimelineHTML({ type: "text", text: end })}</div>
</div>`;
}

/** 點小卡 → ds-stop-open；點照片 → ds-photos-open（detail.key）；畫抖動線 */
export function wireTimeline(root = document) {
  root.querySelectorAll(".ds-tl").forEach((tl) => {
    if (tl.dataset.wired) return;
    tl.dataset.wired = "1";
    tl.addEventListener("click", (e) => {
      const p = e.target.closest(".ds-photos[data-key]");
      if (p) return tl.dispatchEvent(new CustomEvent("ds-photos-open", { bubbles: true, detail: { key: p.dataset.key } }));
      const s = e.target.closest(".ds-stop[data-key]");
      if (s) tl.dispatchEvent(new CustomEvent("ds-stop-open", { bubbles: true, detail: { key: s.dataset.key } }));
    });
  });
  wireWiggle(root);
}
