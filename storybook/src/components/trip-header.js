import "../pattern.css";
import "../wiggle.css";
import "./divider.css";
import "./trip-header.css";
import { wireWiggle } from "../wiggle.js";
import triangle from "../icons/general/icon_triangel_down_duotone.svg?raw";
import people from "../icons/general/icon_peoploe_plus_sticker.svg?raw";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const svg = (raw, cls) => raw.replace("<svg", `<svg class="${cls}" aria-hidden="true"`);

/**
 * 頂列（Figma「Header」Property 1=floating，161877:13701）
 * title：團名；ended 時前面加「回味中 - 」
 * meta：副標那一排，例：["東京", "2026/10/28-11/05", "8 Days", "5☻"]，中間自動放「‧」
 * switchable：團名旁邊有 ▼、可以點（有別團可以切）
 * peopleLabel：右邊人頭鈕給讀螢幕的人聽的名字（一般團員＝「看成員名單」）；空字串就不放這顆
 *
 * 點團名發出 ds-header-title、點人頭發出 ds-header-people（都會冒泡）
 */
export function tripHeaderHTML({ title = "東京 PA PA 造 Happy Birithday", meta = ["東京", "2026/10/28-11/05", "8 Days", "5☻"], ended = false, switchable = true, expanded = false, peopleLabel = "看成員名單" } = {}) {
  const name = (ended ? "回味中 - " : "") + title;
  const head = switchable
    ? `<button type="button" class="ds-trip-header__title" aria-haspopup="menu" aria-expanded="${expanded}"><span class="ds-trip-header__name">${esc(name)}</span>${svg(triangle, "ds-trip-header__caret")}</button>`
    : `<div class="ds-trip-header__title" role="heading" aria-level="1"><span class="ds-trip-header__name">${esc(name)}</span></div>`;
  const sub = meta
    .filter((m) => m !== "" && m != null)
    .map((m) => `<span>${esc(m)}</span>`)
    .join('<span class="ds-trip-header__dot" aria-hidden="true">‧</span>');
  const btn = peopleLabel ? `<button type="button" class="ds-trip-header__people" aria-label="${esc(peopleLabel)}">${svg(people, "ds-trip-header__people-icon")}</button>` : "";
  return `<header class="ds-trip-header ds-pattern">
<div class="ds-trip-header__main">
<div class="ds-trip-header__row"><div class="ds-trip-header__titlebox">${head}<div class="ds-divider ds-divider--primary ds-wiggle-line" aria-hidden="true"></div></div>${btn}</div>
<p class="ds-trip-header__meta">${sub}</p>
</div>
</header>`;
}

/** 接上點擊事件、畫團名底下的抖動線 */
export function wireTripHeader(root = document) {
  root.querySelectorAll(".ds-trip-header").forEach((h) => {
    if (h.dataset.wired) return;
    h.dataset.wired = "1";
    h.addEventListener("click", (e) => {
      if (e.target.closest("button.ds-trip-header__title")) h.dispatchEvent(new CustomEvent("ds-header-title", { bubbles: true }));
      else if (e.target.closest(".ds-trip-header__people")) h.dispatchEvent(new CustomEvent("ds-header-people", { bubbles: true }));
    });
  });
  wireWiggle(root);
}
