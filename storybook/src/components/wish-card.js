import "../pattern.css";
import "../wiggle.css";
import "../pen-line.css";
import "../pen-brush.css";
import "./wish-card.css";
import { wireWiggle } from "../wiggle.js";
import { penMarkerHTML } from "../pen-line.js";
import { revealPens } from "../pen-reveal.js";
import { markPenLayers, drawPenBrush } from "../pen-brush.js";
import { avatarHTML } from "./avatar.js";
import { attractionPhotosHTML } from "./timeline.js";
import heartSticker from "../icons/general/icon_heart_sticker.svg?raw";
import heartDuo from "../icons/general/icon_heart_duotone.svg?raw";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** 頭像：有照片用 avatar；沒有照片先用名字的第一個字＋那個人的顏色（Figma 沒畫沒照片的樣子，待確認） */
function face(p, size) {
  if (p && p.src) return avatarHTML({ src: p.src, alt: p.name || "", size });
  return `<span class="ds-wface ds-wface--${size}" style="--face:${esc((p && p.color) || "var(--ds-sys-color-secondary)")}" title="${esc((p && p.name) || "")}" aria-hidden="true">${esc(((p && p.name) || "?").slice(0, 1))}</span>`;
}

/**
 * 愛心貼紙（Figma「sticker」162182:17965）：status＝0 顆（空心 duotone）／1／2／3 顆（sticker，疊著、斜斜的）
 * 從 0 變成 0 以上時用筆刷上色畫出來（Figma 註解）→ animate: true
 */
export function heartStickerHTML({ hearts = 0, animate = false } = {}) {
  if (!hearts) return `<span class="ds-hearts ds-hearts--0" aria-hidden="true">${heartDuo.replace("<svg", '<svg class="ds-hearts__h"')}</span>`;
  const one = markPenLayers(heartSticker);
  const list = [0, 1, 2].slice(0, hearts).map((i) => one.replace("<svg", `<svg class="ds-hearts__h ds-hearts__h--${i} ds-pen-brush${animate ? "" : " is-drawn"}"`));
  return `<span class="ds-hearts ds-hearts--${hearts}" aria-hidden="true">${list.reverse().join("")}</span>`;
}

/**
 * 按喜歡（Figma「likes」162182:14172）：貼紙＋「+3」＋誰按了（頭像最多 3 個）
 * count：人數；hearts：幾顆愛心（0–3，由用的人決定比例）；givers：[{ name, src, color }]
 * mine：我按過了沒；按了發出 ds-like（detail.key）
 */
export function likesHTML({ key = "", count = 0, hearts = 0, givers = [], mine = false, animate = false, label = "喜歡" } = {}) {
  return `<button type="button" class="ds-likes" data-like="${esc(key)}" aria-pressed="${mine}" aria-label="${esc(label)}（${count} 人）">
${heartStickerHTML({ hearts, animate })}
<span class="ds-likes__num"><span class="ds-likes__plus">+</span><span class="ds-likes__n">${esc(count)}</span>${givers.length ? `<span class="ds-likes__givers">${givers.slice(0, 3).map((g) => face(g, "sm")).join("")}</span>` : ""}</span>
</button>`;
}

/**
 * 許願卡（Figma「card/wishes」161934:9759）
 * title（最長一行，超過…）；meta（不可點擊）；photos（照片組，點了開照片預覽）；wiki（最多 2 行）
 * wisher：{ name, src, color }；note：留言（最多 1 行）；likes：likesHTML 的設定
 * 點卡片其他地方 → ds-wish-open（detail.key）；點照片 → ds-photos-open；點喜歡 → ds-like
 */
export function wishCardHTML({ key = "", title = "淺草寺", meta = ["日本，東京都", "景點"], photos = [], wiki = "", wisher = null, note = "", likes = {}, color = 5 } = {}) {
  const info = meta.filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join('<span aria-hidden="true">‧</span>');
  return `<article class="ds-wcard ds-pattern" data-key="${esc(key)}">
<div class="ds-wcard__head">
<h3 class="ds-wcard__title"><span class="ds-wcard__mark" data-pen="wish-${esc(key)}">${penMarkerHTML({ look: "title" })}<span>${esc(title)}</span></span></h3>
${info ? `<p class="ds-wcard__info">${info}</p>` : ""}
</div>
<div class="ds-wcard__body">
<div class="ds-wcard__media">${attractionPhotosHTML({ photos, key, label: "看「" + title + "」的照片" })}${likesHTML({ key, ...likes })}</div>
${wiki ? `<p class="ds-wcard__wiki">${esc(wiki)}</p>` : ""}
${wisher || note ? `<div class="ds-wcard__wish">
${wisher ? `<span class="ds-wcard__wisher">${face(wisher, "md")}<span>${esc(wisher.name || "")}</span></span>` : ""}
${note ? `<p class="ds-wcard__note">${esc(note)}<span class="ds-wiggle-line ds-wiggle--outline-300" aria-hidden="true"></span></p>` : ""}
</div>` : ""}
</div>
</article>`;
}

/**
 * 許願牆（Figma「wishes board scroll up」162182:13188）：卡片排成好幾欄的瀑布牆，比畫面寬，**整面牆一起**左右滑
 * cards：wishCardHTML 的設定陣列；cols：幾欄（預設照張數算：每欄最多 2 張，最多上下兩排）
 */
export function wishBoardHTML({ cards = [], cols = 0, empty = "還沒有人許願。" } = {}) {
  if (!cards.length) return `<div class="ds-wboard ds-wboard--empty"><p>${esc(empty)}</p></div>`;
  // 最多上下兩排（Figma 說明：每欄最多 2 張），欄數跟著卡片數變多，整面牆左右滑
  const n = cols || Math.max(1, Math.ceil(cards.length / 2));
  const col = Array.from({ length: n }, () => []);
  cards.forEach((c, i) => col[i % n].push(wishCardHTML(c)));
  return `<div class="ds-wboard"><div class="ds-wboard__wall">${col.map((c) => `<div class="ds-wboard__col">${c.join("")}</div>`).join("")}</div></div>`;
}

/**
 * 從 0 變成 0 以上的愛心（heartStickerHTML animate: true）：筆刷上色畫出來。
 * 許願牆（wireWishCards）和細節卡（wireAttractionCard）都會叫；沒叫到的話愛心會停在只有描邊、沒有填色的樣子。
 */
export function drawNewHearts(root = document) {
  root.querySelectorAll(".ds-hearts__h.ds-pen-brush:not(.is-drawn)").forEach((h) => {
    if (h.dataset.penQueued) return;
    h.dataset.penQueued = "1";
    requestAnimationFrame(() => drawPenBrush(h, true));
  });
}

/**
 * 只有「喜歡」那一塊變了（按讚、取消讚、伺服器回來）：就地換掉那幾顆 .ds-likes，其他節點（照片 <img>）一個都不動，
 * 照片才不會重新載入、閃一下（Lulu 11-22）。oldHTML／newHTML 是整塊容器前後兩次的 HTML；
 * 除了喜歡以外還有別的地方不一樣就回 false，交給呼叫的人整塊重畫。
 */
const LIKES_RE = /<button type="button" class="ds-likes"[\s\S]*?<\/button>/g;
export function patchLikes(root, oldHTML, newHTML) {
  if (!root || !oldHTML || !newHTML) return false;
  const strip = (h) => h.replace(LIKES_RE, "\u0000");
  if (strip(oldHTML) !== strip(newHTML)) return false;
  const olds = oldHTML.match(LIKES_RE) || [];
  const news = newHTML.match(LIKES_RE) || [];
  const els = root.querySelectorAll(".ds-likes");
  if (els.length !== news.length || olds.length !== news.length) return false;
  news.forEach((h, i) => { if (h !== olds[i]) els[i].outerHTML = h; });
  drawNewHearts(root);
  return true;
}

export function wireWishCards(root = document) {
  root.querySelectorAll(".ds-wboard, .ds-wcard").forEach((b) => {
    if (b.dataset.wired || b.closest(".ds-wboard") !== b && b.closest(".ds-wboard")) return;
    b.dataset.wired = "1";
    b.addEventListener("click", (e) => {
      const like = e.target.closest("[data-like]");
      if (like) return like.dispatchEvent(new CustomEvent("ds-like", { bubbles: true, detail: { key: like.dataset.like } }));
      const ph = e.target.closest(".ds-photos[data-key]");
      if (ph) return ph.dispatchEvent(new CustomEvent("ds-photos-open", { bubbles: true, detail: { key: ph.dataset.key } }));
      const card = e.target.closest(".ds-wcard");
      if (card) card.dispatchEvent(new CustomEvent("ds-wish-open", { bubbles: true, detail: { key: card.dataset.key } }));
    });
  });
  drawNewHearts(root);
  wireWiggle(root);
  revealPens(root);
}
