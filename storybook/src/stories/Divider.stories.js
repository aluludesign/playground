// 分隔線：Figma shared comps「divider」（162565:18843）
import { dividerWiggleHTML, dividerDotHTML, wireDivider } from "../components/divider.js";

const USAGE = `import { dividerWiggleHTML, dividerDotHTML, wireDivider } from "./components/divider.js";

// 橫的抖動線：寬度跟著外面那層
el.innerHTML = dividerWiggleHTML({ color: "outline-200" }); // "outline-200" | "primary" | "outline-100"
wireDivider(el); // 畫線；尺寸變了會自己重畫

// 直的點點線（height 不給就是 9）
box.innerHTML = dividerDotHTML({ height: 24 });`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

export default { title: "Components/分隔線 Divider" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>分隔線 Divider</h1>
<p class="lead">兩種分隔線：橫的手繪抖動線，和直的點點線。</p>

<section class="tk"><h2>divider/wiggle</h2>
<p class="note">抖法照線條樣式的「分隔線」（frequency、wiggle、smoothen 都是 <code class="var">sys/wiggle/*</code> token），寬度跟著外面那層。</p>
<table><thead><tr><th>Property 1</th><th>預覽</th><th>顏色</th></tr></thead><tbody>
<tr><td class="nm">outline 200</td><td class="dv-cell">${dividerWiggleHTML()}</td><td><code class="var">--ds-comp-divider-color-strong</code></td></tr>
<tr><td class="nm">primary</td><td class="dv-cell">${dividerWiggleHTML({ color: "primary" })}</td><td><code class="var">--ds-comp-divider-color-primary</code></td></tr>
<tr><td class="nm">outline 100</td><td class="dv-cell">${dividerWiggleHTML({ color: "outline-100" })}</td><td><code class="var">--ds-sys-color-outline-100</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>divider/dot</h2>
<p class="note">直的，高 9；每一點是圓頭的短線（dash 1、gap 5）。跟 Figma 一樣會自動調整間距，讓頭尾都剛好一點，所以 9 高是 3 點；可以給 <code>height</code> 換高度。</p>
<table><thead><tr><th></th><th>預覽</th></tr></thead><tbody>
<tr><td class="nm">單獨</td><td class="dv-cell dv-dot">${dividerDotHTML()}</td></tr>
<tr><td class="nm">height: 24</td><td class="dv-cell dv-dot">${dividerDotHTML({ height: 24 })}</td></tr>
</tbody></table></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">抖動線線寬</td><td><code class="var">--ds-comp-divider-size</code></td></tr>
<tr><td class="al">點點線線寬</td><td><code class="var">--ds-comp-divider-dot-size</code></td></tr>
<tr><td class="al">抖法</td><td><code class="var">--ds-sys-wiggle-frequency</code>・<code class="var">--ds-sys-wiggle-amount-line</code>・<code class="var">--ds-sys-wiggle-smoothen</code></td></tr>
<tr><td class="al">顏色</td><td><code class="var">--ds-comp-divider-color-strong</code>（outline 200、點點線）／<code class="var">--ds-comp-divider-color-primary</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre class="wg-code"><code>${esc(USAGE)}</code></pre></section>
<style>
.dv-cell { padding: 14px 16px; width: 326px; }
.dv-dot { line-height: 0; }
.wg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    requestAnimationFrame(() => wireDivider(el));
    return el;
  },
};
