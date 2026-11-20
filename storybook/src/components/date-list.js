import "../wiggle.css";
import "../pen-line.css";
import "./date-list.css";
import { wireWiggle } from "../wiggle.js";
import { penMarkerHTML } from "../pen-line.js";

// 天氣圖示：icons/weather 的 color 那一組
const raw = import.meta.glob("../icons/weather/*_color.svg", { query: "?raw", import: "default", eager: true });
export const WEATHER_ICONS = Object.keys(raw).map((k) => k.replace(/^.*weather_|_color\.svg$/g, ""));
const wxIcon = (name) => (raw[`../icons/weather/weather_${name}_color.svg`] || "").replace("<svg", '<svg class="ds-date__wx-icon" aria-hidden="true"');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * 日期列的一格（Figma「date list」162271:11054）
 * state：「default」｜「active」（選到的那天）｜「past」（Figma pass by：過去的日子，沒有天氣）｜「status」（Figma coming soon：倒數／回味中，放在最前面）
 * key：點了之後 ds-date-select 帶回去的值（例：日期 2026-10-05）
 * day：「Day1」；week：「TUE」；date：「10/06」
 * color：那天的顏色（1–14，對應 customs/custom N；選到時整格鋪同一個顏色、淡一點）
 * weather：{ icon: "sun", lo: 24, hi: 29, rain: 30 }；查不到（太遠的日子）就不給，那一塊就空著
 * title／value：state=status 用，例：「正在倒數」「38 天」、「回味中」
 */
export function dateCardHTML({ state = "default", key = "", day = "Day1", week = "TUE", date = "10/06", color = 5, weather = null, title = "正在倒數", value = "38 天" } = {}) {
  const cls = ["ds-date", `ds-date--${state}`];
  const style = ` style="--date-color:var(--ds-sys-color-customs-custom-${color});--date-on:var(--ds-sys-color-customs-on-custom-${color})"`;
  if (state === "status") {
    return `<div class="${cls.join(" ")} ds-wiggle-border"${style}>
<div class="ds-date__head ds-wiggle-line ds-wiggle--outline-300"><span>${esc(title)}</span></div>
${value ? `<div class="ds-date__big"><span class="ds-date__mark">${penMarkerHTML({ drawn: true, color: "primary" })}<span>${esc(value)}</span></span></div>` : ""}
</div>`;
  }
  const wx = weather && state !== "past"
    ? `<div class="ds-date__wx">
<span class="ds-date__wx-row">${wxIcon(weather.icon || "sun")}<span>${esc(weather.lo)}°</span><span>-</span><span>${esc(weather.hi)}°</span></span>
${weather.rain != null ? `<span class="ds-date__wx-row">${wxIcon("drop")}<span>${esc(weather.rain)}%</span></span>` : ""}
</div>`
    : "";
  return `<button type="button" class="${cls.join(" ")} ds-wiggle-border" data-key="${esc(key)}" aria-pressed="${state === "active"}"${style}>
<span class="ds-date__head ds-wiggle-line ds-wiggle--outline-300"><span>${esc(day)}</span><b aria-hidden="true">‧</b><span>${esc(week)}</span></span>
<span class="ds-date__big"><span class="ds-date__mark">${penMarkerHTML({ drawn: true, color: state === "past" ? undefined : `custom ${color}` })}<span>${esc(date)}</span></span></span>
${wx}
</button>`;
}

/** 整排：cards 是 dateCardHTML 的設定陣列 */
export function dateListHTML({ cards = [], label = "選擇日期" } = {}) {
  return `<div class="ds-date-list" role="group" aria-label="${esc(label)}">${cards.map(dateCardHTML).join("")}</div>`;
}

/**
 * 點一格發出 ds-date-select（detail.key），畫抖動線；
 * center(list) 把選到的那格捲到正中間（Figma：選到的那一天會跑到正中間，跟下方的 Scheduled 對齊）
 */
export function wireDateList(root = document) {
  root.querySelectorAll(".ds-date-list").forEach((list) => {
    if (!list.dataset.wired) {
      list.dataset.wired = "1";
      list.addEventListener("click", (e) => {
        const b = e.target.closest("button.ds-date");
        if (b) list.dispatchEvent(new CustomEvent("ds-date-select", { bubbles: true, detail: { key: b.dataset.key } }));
      });
    }
  });
  wireWiggle(root);
}

export function centerDateList(list, smooth = true) {
  const cur = list && list.querySelector(".ds-date--active");
  if (!cur) return;
  const left = cur.offsetLeft - (list.clientWidth - cur.offsetWidth) / 2;
  list.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
}
