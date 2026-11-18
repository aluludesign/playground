// 提示：Figma shared comps「info」（162201:23111）
import { infoHTML, wireInfo } from "../components/info.js";

const USAGE = `import { infoHTML, wireInfo } from "./components/info.js";

el.innerHTML = infoHTML({
  text: "直接許願**淺草寺**，願望地圖上不會出現地點指標", // **粗體**
  expanded: false,      // collapse／expend
  leadingIcon: true,    // Show leading icon
  collapseIcon: true,   // Show collapse icon
  button: true,         // Show btn
  buttonLabel: "不再提醒",
});
wireInfo(el); // 箭頭展開收合、畫抖動外框
el.addEventListener("ds-info-dismiss", () => { /* 不再提醒 */ });`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

export default { title: "Components/提示 Info" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>提示 Info</h1>
<p class="lead">告訴使用者一件事的淡藍提示條：前面 info icon，中間一段說明（重點字可以加粗），後面可以展開看全文，或按「不再提醒」。外框是手繪的抖動線，底色往右下錯開一點。</p>

<section class="tk"><h2>state</h2>
<table><thead><tr><th>state</th><th>預覽</th><th>說明</th></tr></thead><tbody>
<tr><td class="nm">collapse</td><td class="if-cell">${infoHTML()}</td><td class="al">說明只顯示一行，超過用「…」；箭頭朝下</td></tr>
<tr><td class="nm">expend</td><td class="if-cell">${infoHTML({ expanded: true })}</td><td class="al">說明全部展開；箭頭朝上</td></tr>
</tbody></table>
<p class="note">點箭頭可以切換（鍵盤 Tab 到箭頭會有 focus ring）。</p></section>

<section class="tk"><h2>Show leading icon／Show collapse icon／Show btn</h2>
<table><thead><tr><th></th><th>預覽</th></tr></thead><tbody>
<tr><td class="nm">沒有 leading icon</td><td class="if-cell">${infoHTML({ leadingIcon: false })}</td></tr>
<tr><td class="nm">沒有收合箭頭</td><td class="if-cell">${infoHTML({ collapseIcon: false, expanded: true })}</td></tr>
<tr><td class="nm">沒有按鈕</td><td class="if-cell">${infoHTML({ button: false })}</td></tr>
<tr><td class="nm">都沒有</td><td class="if-cell">${infoHTML({ leadingIcon: false, collapseIcon: false, button: false, expanded: true })}</td></tr>
</tbody></table></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">底色（往右下錯開）</td><td><code class="var">--ds-sys-color-tertiary-container</code></td></tr>
<tr><td class="al">外框</td><td>線條樣式「外框」<code class="var">ds-wiggle-border</code>，顏色 <code class="var">--ds-sys-color-tertiary</code></td></tr>
<tr><td class="al">圓角</td><td><code class="var">--ds-comp-info-radius</code></td></tr>
<tr><td class="al">icon</td><td><code class="var">--ds-comp-info-icon</code>（info 用 <code class="var">--ds-sys-color-tertiary</code>，箭頭用 on tertiary container）</td></tr>
<tr><td class="al">字</td><td><code class="var">--ds-sys-color-on-tertiary-container</code>・label/md/regular，重點字 label/md/semi-bold</td></tr>
<tr><td class="al">內距／間距</td><td>左 <code class="var">--ds-sys-spacing-3xl</code>、其他 <code class="var">--ds-sys-spacing-xl</code>；間距 <code class="var">--ds-sys-spacing-xl</code></td></tr>
<tr><td class="al">按鈕</td><td>Button Tertiary・Text・xs</td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre class="wg-code"><code>${esc(USAGE)}</code></pre></section>
<style>
.if-cell { padding: 14px 16px; }
.if-cell .ds-info { width: 310px; }
.wg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    requestAnimationFrame(() => wireInfo(el));
    return el;
  },
};
