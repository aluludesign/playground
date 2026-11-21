import "../wiggle.css";
import "../pen-line.css";
import "./divider.css";
import "./location-pin.css";
import "./timeline.css";
import { wireWiggle } from "../wiggle.js";
import { penMarkerHTML } from "../pen-line.js";
import { revealPens } from "../pen-reveal.js";
import { pinTimelineHTML } from "./location-pin.js";
import down from "../icons/general/icon_triangel_down_duotone.svg?raw";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * 疊在一起的景點照片（Figma「attraction photos」162093:14097 ＋ attraction photos/variants 162067:10813）
 * photos：照片網址（最多畫 3 張，第一張在最上面）；沒有照片就不畫
 * 疊法照 Figma variants 隨機挑（同張數兩種），用 key（沒有就用第一張網址）算，重畫不會換；variant：文件頁用，指定 Figma 的 variants 編號 1–6
 * 點了發出 ds-photos-open（detail.key）—— Figma：點景點照片組開照片預覽
 */
// Figma attraction photos/variants（162067:10813）：每種張數有兩種疊法，隨機挑一種。
// 每張：[中心離盒子中心的 x, y（px）, Figma 的旋轉角度（逆時針為正）]，由下往上排（最後一張在最上面）
const PHOTO_VARIANTS = {
  3: [
    [[6, 1, -5], [0, -5, 0], [-6, 2, 5]], // variants=1
    [[-6, -2, 5], [0, -1, 0], [7, 3, -5]], // variants=2
  ],
  2: [
    [[3, 0, -5], [-2, 0, 5]], // variants=6
    [[3, -1, 0], [-3, 2, 0]], // variants=5
  ],
  1: [
    [[0, 0, 5]], // variants=4
    [[0, 0, -5]], // variants=3
  ],
};
// 同一個項目每次重畫都挑到同一種（用 key，沒有就用第一張照片的網址算）
const hashOf = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

// Figma 的 variants 編號 → [張數, 第幾種]（只給文件頁固定顯示用）
const VARIANT_NO = { 1: [3, 0], 2: [3, 1], 6: [2, 0], 5: [2, 1], 4: [1, 0], 3: [1, 1] };

export function attractionPhotosHTML({ photos = [], key = "", label = "看照片", variant } = {}) {
  const list = photos.filter(Boolean).slice(0, 3);
  if (!list.length) return `<span class="ds-photos ds-photos--empty" aria-hidden="true"></span>`;
  const options = PHOTO_VARIANTS[list.length];
  const fixed = VARIANT_NO[variant];
  const layout = fixed && fixed[0] === list.length ? options[fixed[1]] : options[hashOf(String(key || list[0])) % options.length];
  // 第一張在最上面 → 由下往上畫時倒過來
  const imgs = list
    .slice()
    .reverse()
    .map((src, i) => {
      const [x, y, r] = layout[i];
      // Figma 逆時針為正，CSS rotate() 順時針為正 → 取負號
      return `<img class="ds-photos__img" src="${esc(src)}" alt="" loading="lazy" style="transform:translate(${x}px,${y}px) rotate(${-r}deg)">`;
    })
    .join("");
  return `<button type="button" class="ds-photos" data-key="${esc(key)}" aria-label="${esc(label)}"><span class="ds-photos__stack">${imgs}</span></button>`;
}

/**
 * 行程小卡（Figma「schedule/detail」162075:10954）：名稱（螢光筆）、地區‧類別、維基摘要（最多 2 行）、許願留言泡泡
 * align：「left」（卡在時間軸右邊，泡泡尖角在泡泡右上角外面）｜「right」（尖角在左上角外面）—— Figma dialogue/ind
 * color：那天的顏色（1–14）—— 只給時間軸的號碼用；小卡標題螢光筆照 Figma 實際的 stroke：primary 64%、尾巴 shadow/lg（= look "title"）
 * 引用時點整塊開當日細節 → 發出 ds-stop-open（detail.key）
 */
export function scheduleDetailHTML({ key = "", title = "淺草寺", meta = ["日本，東京都", "景點"], wiki = "", note = "", align = "left", color = 5 } = {}) {
  const info = meta.filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join('<span aria-hidden="true">‧</span>');
  return `<button type="button" class="ds-stop ds-stop--${align}" data-key="${esc(key)}">
<span class="ds-stop__title"><span class="ds-stop__mark" data-pen="stop-${esc(key)}-${esc(title)}">${penMarkerHTML({ look: "title" })}<span>${esc(title)}</span></span></span>
${info ? `<span class="ds-stop__info">${info}</span>` : ""}
${wiki ? `<span class="ds-stop__wiki">${esc(wiki)}</span>` : ""}
${note ? `<span class="ds-stop__note"><span class="ds-stop__note-text">${esc(note)}</span><span class="ds-wiggle-line ds-wiggle--outline-300" aria-hidden="true"></span><span class="ds-stop__tail" aria-hidden="true"></span></span>` : ""}
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
      const pin = pinTimelineHTML({ type: "time", time: it.time || "", badge: { number: it.n ?? i + 1, color: it.color || 5 }, dotTop: false, dotBottom: false });
      const photos = attractionPhotosHTML({ photos: it.photos || [], key: it.key, label: "看「" + (it.title || "") + "」的照片" });
      const card = scheduleDetailHTML({ ...it, align: left ? "left" : "right" });
      return `<div class="ds-tl__set">
<div class="ds-tl__point">${left ? `<div class="ds-tl__side ds-tl__side--photos">${photos}</div>` : `<div class="ds-tl__side ds-tl__side--card">${card}</div>`}<div class="ds-tl__pin">${pin}</div>${left ? `<div class="ds-tl__side ds-tl__side--card">${card}</div>` : `<div class="ds-tl__side ds-tl__side--photos">${photos}</div>`}</div>
<div class="ds-tl__line" aria-hidden="true"></div>
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
  revealPens(root);
}
