// 分頁籤：Figma section 162537:17529（segmented、segmented/item）
import { segmentedHTML, segmentedItemHTML, wireSegmented } from "../components/segmented.js";
import { irisButtonHTML, wireIris } from "../components/iris-button.js";

const USAGE = `import { segmentedHTML, wireSegmented } from "./components/segmented.js";

el.innerHTML = segmentedHTML({
  selected: "none",
  items: [
    { key: "none", label: "不選地點" },
    { key: "any", label: "不指定地點" },
  ],
  // trailing: irisButtonHTML({ size: "sm", label: "許願" }), // Figma 裡藏著的那顆，要用再放
});
wireSegmented(el); // 點一格（或左右鍵）切換、畫抖動線
el.addEventListener("ds-segmented-select", (e) => console.log(e.detail.key));`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const one = (opts) => `<div class="ds-segmented sg-bare" role="tablist">${segmentedItemHTML({ key: "a", label: "不選地點", ...opts })}</div>`;

export default { title: "Components/分頁籤 Segmented" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>分頁籤 Segmented</h1>
<p class="lead">一排像資料夾標籤的頁籤，左上小圓角、右上大圓角、下面是方的。沒選的是淡橘格子底；選中的換成米白格子底、字變深，字底下有一條手繪的橘色抖動線。點點看，也可以用鍵盤左右鍵切換。</p>

<section class="tk"><h2>segmented</h2>
<div class="sg-stage">${segmentedHTML({ selected: "none" })}</div>
<p class="note">Figma 裡頁籤後面還藏了一顆 Dynamic Iris（「許願」，預設不顯示）。要用的話放進 <code>trailing</code>：</p>
<div class="sg-stage">${segmentedHTML({ selected: "any", trailing: irisButtonHTML({ size: "sm", label: "許願" }) })}</div>
</section>

<section class="tk"><h2>segmented/item</h2>
<table><thead><tr><th>Property 1</th><th>預覽</th><th>說明</th></tr></thead><tbody>
<tr><td class="nm">Default</td><td class="sg-cell">${one({})}</td><td class="al"><code>bg pattern/primary-soft</code>，文字 <code>text 200</code></td></tr>
<tr><td class="nm">hover</td><td class="sg-cell">${one({ state: "hover" })}</td><td class="al">滑鼠移上去：底換成 <code>bg pattern/surface</code>，再蓋一層 <code>opacity primary 50</code></td></tr>
<tr><td class="nm">focus</td><td class="sg-cell">${one({ state: "focus" })}</td><td class="al">鍵盤操作（Tab）：外面留 <code>spacing/2xs</code>，再畫 <code>comp/focus-ring</code> 的框</td></tr>
<tr><td class="nm">Active</td><td class="sg-cell">${one({ selected: true })}</td><td class="al"><code>bg pattern/surface</code>，文字 <code>text 100</code>，字底下 <code>primary</code> 的抖動線（<code>border/md</code>）</td></tr>
</tbody></table>
</section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">圓角</td><td>左上 <code class="var">--ds-comp-segmented-radius-top-left</code>・右上 <code class="var">--ds-comp-segmented-radius-top-right</code>・下面 0</td></tr>
<tr><td class="al">頁籤之間</td><td><code class="var">--ds-sys-spacing-2xl</code></td></tr>
<tr><td class="al">整排左右</td><td>左 <code class="var">--ds-sys-spacing-xl</code>・右 <code class="var">--ds-sys-spacing-4xl</code></td></tr>
<tr><td class="al">一格的內距</td><td>上 <code class="var">--ds-sys-spacing-xl</code>・左右 <code class="var">--ds-sys-spacing-2xl</code>・下 <code class="var">--ds-sys-spacing-lg</code></td></tr>
<tr><td class="al">文字</td><td>Body/sm/semi-bold <code class="var">--ds-sys-font-size-body-sm</code>・<code class="var">--ds-sys-color-text-200</code>／選中 <code class="var">--ds-sys-color-text-100</code></td></tr>
<tr><td class="al">底紋</td><td><code class="var">ds-pattern--primary-soft</code>／hover、選中 <code class="var">ds-pattern--surface</code></td></tr>
<tr><td class="al">hover 蓋的那層</td><td><code class="var">--ds-sys-color-opacity-opacity-primary-50</code></td></tr>
<tr><td class="al">抖動線</td><td><code class="var">--ds-sys-color-primary</code>・<code class="var">--ds-sys-border-md</code>，比文字左右各長 <code class="var">--ds-sys-spacing-sm</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre class="wg-code"><code>${esc(USAGE)}</code></pre></section>
<style>
.sg-stage { padding: 24px 0 0; border-bottom: 1px solid #eee5e1; max-width: 420px; }
.sg-cell { padding: 16px 12px; }
.sg-bare { padding: 0; }
.wg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    requestAnimationFrame(() => {
      wireSegmented(el);
      wireIris(el);
    });
    return el;
  },
};
