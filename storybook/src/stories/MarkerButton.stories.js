// 馬克筆按鈕：Figma shared comps「btn」（162197:22140）
import { markerButtonHTML } from "../components/marker-button.js";

const SIZES = ["lg", "md", "sm"];
const USAGE = `import { markerButtonHTML } from "./components/marker-button.js";

el.innerHTML = markerButtonHTML({
  label: "送出許願",
  color: "primary",   // "primary" | "secondary"
  size: "lg",         // "lg" | "md" | "sm"
  trailingIcon: false, // 後面加往下的三角形
  disabled: false,     // disabled 一律灰色
});`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const row = (name, opts) => `<tr><td class="nm">${name}</td>${SIZES.map((size) => `<td class="mk-cell">${markerButtonHTML({ size, ...opts })}</td>`).join("")}</tr>`;

export default { title: "Components/馬克筆按鈕 Marker button" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>馬克筆按鈕 Marker button</h1>
<p class="lead">像用馬克筆塗出來的一條色塊：左右兩端是不規則的收筆，右端再疊一層較深的筆跡。每一塊都是 88% 的透明度，疊在一起的地方會比較深。</p>

<section class="tk"><h2>Primary</h2>
<table><thead><tr><th>state</th><th>lg</th><th>md</th><th>sm</th></tr></thead><tbody>
${row("default", { color: "primary" })}
${row("hover", { color: "primary", state: "hover" })}
${row("focus", { color: "primary", state: "focus" })}
</tbody></table></section>

<section class="tk"><h2>secondary</h2>
<table><thead><tr><th>state</th><th>lg</th><th>md</th><th>sm</th></tr></thead><tbody>
${row("default", { color: "secondary" })}
${row("hover", { color: "secondary", state: "hover" })}
${row("focus", { color: "secondary", state: "focus" })}
</tbody></table></section>

<section class="tk"><h2>disable（shared）</h2>
<p class="note">disabled 時不分顏色，一律是灰色（<code>on disable</code>）。</p>
<table><thead><tr><th>state</th><th>lg</th><th>md</th><th>sm</th></tr></thead><tbody>
${row("disable", { disabled: true })}
</tbody></table></section>

<section class="tk"><h2>Show Trailing icon／Show label</h2>
<table><thead><tr><th></th><th>lg</th><th>md</th><th>sm</th></tr></thead><tbody>
${row("trailing icon", { trailingIcon: true })}
${row("只有 icon", { trailingIcon: true, showLabel: false })}
</tbody></table></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">顏色</td><td><code class="var">--ds-sys-color-primary</code>／<code class="var">--ds-sys-color-secondary</code>／disabled <code class="var">--ds-sys-color-on-disable</code></td></tr>
<tr><td class="al">右端深色筆跡</td><td><code class="var">--ds-sys-color-opacity-opacity-primary-150</code>（disabled 用 on disable）</td></tr>
<tr><td class="al">每一塊的透明度</td><td><code class="var">--ds-comp-btn-marker-opacity</code></td></tr>
<tr><td class="al">字</td><td><code class="var">--ds-sys-color-on-primary</code>・lg Body/lg/extra-bold・md label/lg/regular・sm label/sm/regular</td></tr>
<tr><td class="al">hover</td><td>字疊 <code class="var">--ds-sys-color-opacity-opacity-primary-50</code></td></tr>
<tr><td class="al">內距</td><td>lg <code class="var">--ds-sys-spacing-sm</code>／<code class="var">--ds-sys-spacing-xs</code>・md <code class="var">--ds-sys-spacing-2xs</code>／<code class="var">--ds-sys-spacing-xs</code>・sm <code class="var">--ds-sys-spacing-2xs</code></td></tr>
<tr><td class="al">icon</td><td><code class="var">--ds-comp-btn-marker-icon</code>，和字間距 <code class="var">--ds-sys-spacing-md</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre class="wg-code"><code>${esc(USAGE)}</code></pre></section>
<style>
.mk-cell { padding: 14px 12px; }
.wg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    return el;
  },
};
