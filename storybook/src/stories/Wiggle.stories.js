// 抖動線條樣式：Figma 的 Dynamic stroke（line-style，node 162498:12772）
import { wireWiggle } from "../wiggle.js";

const LINES = [
  { cls: "", figma: "Property 1=Default", token: "ds/sys/color/outline 50" },
  { cls: "ds-wiggle--outline-100", figma: "Property 1=Variant2", token: "ds/sys/color/outline 100" },
  { cls: "ds-wiggle--outline-200", figma: "Property 1=Variant3", token: "ds/sys/color/outline 200" },
  { cls: "ds-wiggle--outline-300", figma: "Property 1=Variant4", token: "ds/sys/color/outline 300" },
];

const USAGE = `<!-- 分隔線（預設 outline 50） -->
<div class="ds-wiggle-line ds-wiggle--outline-200"></div>

<!-- 外框（預設 outline 300；圓角照元素自己的 border-radius） -->
<div class="ds-wiggle-border" style="border-radius: var(--ds-sys-radius-xs)">…</div>

<script type="module">
  import { wireWiggle } from "./wiggle.js";
  wireWiggle(); // 畫線；尺寸變了會自己重畫
</script>`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

export default { title: "Style/線條樣式" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>線條樣式（抖動線）</h1>
<p class="lead">對應 Figma 的 Dynamic stroke，之後很多外框會用這種手繪感的抖動線。<br>
Figma 的三個數字照搬：frequency（多密）、wiggle（抖多大）、smoothen（多圓滑）。CSS 本身畫不出這種線，所以由 <code>src/wiggle.js</code> 照這三個數字畫一條平滑的 SVG 線疊上去；抖法每個元素固定，不會一縮放就換一條。</p>

<section class="tk"><h2>分隔線</h2>
<p class="note">Figma「line-style」：frequency 10 · wiggle 1.5 · smoothen 0.5 · 線寬 border/xs</p>
<table class="wg-table"><thead><tr><th>Figma</th><th>預覽</th><th>顏色</th><th>class</th></tr></thead><tbody>
${LINES.map(
  (l) => `<tr><td class="nm">${l.figma}</td><td><div class="ds-wiggle-line ${l.cls}" style="width:326px"></div></td><td><code>${l.token}</code></td><td><code class="var">ds-wiggle-line${l.cls ? " " + l.cls : ""}</code></td></tr>`,
).join("")}
</tbody></table></section>

<section class="tk"><h2>外框</h2>
<p class="note">照 Figma「menu」的外框：frequency 10 · wiggle 0.3 · smoothen 0.5 · outline 300 · 圓角 radius/xs · 線畫在邊框正中間</p>
<div class="ds-wiggle-border wg-menu">
  <div class="wg-item">北海道 8 日孝親之旅</div>
  <div class="wg-item is-on">東京 PA PA 造 Happy Birithday</div>
  <div class="wg-item">京都 春季櫻花漫遊</div>
</div>
</section>

<section class="tk"><h2>各種形狀</h2>
<p class="note">線是量元素自己的大小和圓角畫的，不是一張固定的圖：尺寸變了會重畫，四個角各自的圓角（膠囊、圓形、只有上面圓角）都照 CSS 的 border-radius。</p>
<div class="wg-shapes">
  <div class="ds-wiggle-border wg-s" style="width:160px;height:96px;border-radius:var(--ds-sys-radius-lg)">卡片</div>
  <div class="ds-wiggle-border wg-s" style="width:120px;height:40px;border-radius:var(--ds-sys-radius-full)">膠囊</div>
  <div class="ds-wiggle-border wg-s" style="width:64px;height:64px;border-radius:50%">圓</div>
  <div class="ds-wiggle-border wg-s" style="width:160px;height:72px;border-radius:var(--ds-sys-radius-lg) var(--ds-sys-radius-lg) 0 0">只有上面圓角</div>
  <div class="ds-wiggle-border wg-s wg-grow" style="height:48px;border-radius:var(--ds-sys-radius-xs)">跟著寬度變（拉視窗看看）</div>
</div>
</section>

<section class="tk"><h2>調整</h2>
<p class="note">要不同的抖法就在元素上覆寫變數：<code>--wiggle-frequency</code>、<code>--wiggle-amount</code>（= Figma wiggle）、<code>--wiggle-smoothen</code>、<code>--wiggle-width</code>、<code>--wiggle-color</code>。</p>
<pre class="wg-code"><code>${esc(USAGE)}</code></pre>
</section>
<style>
.wg-table td { padding: 14px 12px; vertical-align: middle; }
.wg-menu { width: 306px; border-radius: var(--ds-sys-radius-xs); background: var(--ds-sys-color-surface-bright); box-shadow: var(--ds-elevation-surface-soft); display: flex; flex-direction: column; gap: var(--ds-sys-spacing-2xs); margin: 8px 0 24px; }
.wg-item { padding: var(--ds-sys-spacing-sm) var(--ds-sys-spacing-xl); font: 400 14px/24px var(--ds-sys-font-family-label); color: var(--ds-sys-color-text-100); }
.wg-item.is-on { background: var(--ds-sys-color-opacity-opacity-primary-100); }
.wg-shapes { display: flex; flex-wrap: wrap; gap: 24px; align-items: center; padding: 8px 4px 16px; }
.wg-s { display: flex; align-items: center; justify-content: center; font: 400 13px var(--ds-sys-font-family-label); color: var(--ds-sys-color-text-100); background: var(--ds-sys-color-surface-bright); }
.wg-grow { flex: 1 1 260px; }
.wg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    requestAnimationFrame(() => wireWiggle(el));
    return el;
  },
};
