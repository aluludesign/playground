// 頂列：Figma「Header」Property 1=floating（161877:13701）
import { tripHeaderHTML, wireTripHeader } from "../components/trip-header.js";

const USAGE = `import { tripHeaderHTML, wireTripHeader } from "./components/trip-header.js";

el.innerHTML = tripHeaderHTML({
  title: "東京 PA PA 造 Happy Birithday",
  meta: ["東京", "2026/10/28-11/05", "8 Days", "5☻"], // 中間自動放「‧」
  ended: false,             // 結束了 → 團名前面加「回味中 - 」
  switchable: true,         // 有別團可以切 → 團名旁邊有 ▼、可以點
  peopleLabel: "看成員名單", // 右邊人頭鈕；空字串就不放
});
wireTripHeader(el);
el.addEventListener("ds-header-title", () => { /* 打開團名選單 */ });
el.addEventListener("ds-header-people", () => { /* 看成員名單 */ });`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const frame = (html) => `<div style="width:390px;background:#cfd8c4;padding-bottom:24px">${html}</div>`;

export default { title: "Components/頂列 Header" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>頂列 Header</h1>
<p class="lead">行程頁最上面那一條：團名（點了切換別團）、城市‧日期‧天數‧人數，右邊人頭鈕（一般團員是看成員名單）。浮在地圖上面，下面兩角圓。</p>

<section class="tk"><h2>樣子</h2>
<table><thead><tr><th></th><th>預覽（390 寬）</th></tr></thead><tbody>
<tr><td class="nm">一般</td><td>${frame(tripHeaderHTML())}</td></tr>
<tr><td class="nm">已結束</td><td>${frame(tripHeaderHTML({ ended: true }))}</td></tr>
<tr><td class="nm">選單打開</td><td>${frame(tripHeaderHTML({ expanded: true }))}</td></tr>
<tr><td class="nm">只有一團</td><td>${frame(tripHeaderHTML({ switchable: false }))}</td></tr>
<tr><td class="nm">團名很長</td><td>${frame(tripHeaderHTML({ title: "北海道 8 日孝親之旅＋函館夜景＋小樽運河慢慢走" }))}</td></tr>
</tbody></table></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">底</td><td><code class="var">--ds-sys-color-surface</code>＋bg pattern、<code class="var">--ds-elevation-surface-soft</code>、下兩角 <code class="var">--ds-sys-radius-sm</code></td></tr>
<tr><td class="al">內距</td><td>上下 <code class="var">--ds-sys-spacing-xl</code>、左右 <code class="var">--ds-sys-spacing-4xl</code></td></tr>
<tr><td class="al">團名</td><td>Headline/xs/semi-bold（<code class="var">--ds-sys-font-family-headline</code>・源泉圓體 H・<code class="var">--ds-sys-font-size-headline-xs</code>）、<code class="var">--ds-sys-color-text-100</code></td></tr>
<tr><td class="al">▼／人頭</td><td>triangel_down duotone <code class="var">--ds-sys-icon-lg</code>；peoploe_plus sticker <code class="var">--ds-sys-icon-xl</code></td></tr>
<tr><td class="al">團名底線</td><td>divider/wiggle outline 200</td></tr>
<tr><td class="al">副標</td><td>label/lg/hand-regular（<code class="var">--ds-sys-font-family-zhtw-handwriting-zhtw</code>）、<code class="var">--ds-sys-color-text-200</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre><code>${esc(USAGE)}</code></pre></section>`;
    requestAnimationFrame(() => wireTripHeader(el));
    return el;
  },
};
