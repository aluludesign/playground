// 文字輸入框：Figma shared comps「text filed」（162240:23151）
import { textFieldHTML, wireTextField } from "../components/text-field.js";

const USAGE = `import { textFieldHTML, wireTextField } from "./components/text-field.js";

el.innerHTML = textFieldHTML({
  label: "許個願，想去東京哪? ",   // Show Floating label → floatingLabel: false 就不顯示
  placeholder: "東京鐵塔…等",
  value: "",
  leadingIcon: true,               // Show Leading icon（燈泡）
  trailingIcon: true,              // Show Trailing icon（清除 ✕，有字才出現）
  supporting: true,                // Show supporting text
  supportingText: "Supporting text",
  button: "強力搜",                // 說明列後面的馬克筆按鈕；不要就給 ""
});
wireTextField(el); // 聚焦／有字時換樣子、✕ 清除、畫抖動線
el.querySelector(".ds-text-field__btn").addEventListener("click", () => { /* 強力搜 */ });`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

export default { title: "Components/文字輸入框 Text field" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>文字輸入框 Text field</h1>
<p class="lead">上面一行標籤，中間是手寫字的輸入列（前面一顆燈泡、底下一條手繪抖動線），下面一行說明和馬克筆按鈕。點進去打字時，燈泡被一支看不見的筆塗上顏色、底線由左往右畫粗。</p>

<section class="tk"><h2>試試看</h2>
<div class="tf-try">${textFieldHTML()}</div>
<p class="note">點進去、打字、按 ✕ 清掉、點外面離開，四種 state 會自己切換。</p></section>

<section class="tk"><h2>state</h2>
<table><thead><tr><th>state</th><th>預覽</th><th>說明</th></tr></thead><tbody>
<tr><td class="nm">default</td><td class="tf-cell">${textFieldHTML()}</td><td class="al">空的、沒聚焦：燈泡 outlined、細底線（outline 200）、沒有 ✕</td></tr>
<tr><td class="nm">focused_pre typing</td><td class="tf-cell">${textFieldHTML({ state: "focused" })}</td><td class="al">聚焦、還沒打字：燈泡換 sticker、粗底線（outline 300、border/md）；還沒有字，所以沒有 ✕</td></tr>
<tr><td class="nm">focused_typing</td><td class="tf-cell">${textFieldHTML({ state: "focused", value: "Filled text" })}</td><td class="al">聚焦、打字中：有字了，出現清除 ✕</td></tr>
<tr><td class="nm">filled w/o focused</td><td class="tf-cell">${textFieldHTML({ value: "Filled text" })}</td><td class="al">有字、離開了：燈泡維持 sticker、底線變回細的</td></tr>
</tbody></table></section>

<section class="tk"><h2>Show Floating label／Leading icon／Trailing icon／supporting text</h2>
<table><thead><tr><th></th><th>預覽</th></tr></thead><tbody>
<tr><td class="nm">沒有標籤</td><td class="tf-cell">${textFieldHTML({ floatingLabel: false })}</td></tr>
<tr><td class="nm">沒有燈泡</td><td class="tf-cell">${textFieldHTML({ leadingIcon: false, value: "Filled text" })}</td></tr>
<tr><td class="nm">沒有 ✕</td><td class="tf-cell">${textFieldHTML({ trailingIcon: false, value: "Filled text" })}</td></tr>
<tr><td class="nm">沒有說明列</td><td class="tf-cell">${textFieldHTML({ supporting: false })}</td></tr>
<tr><td class="nm">說明列沒有按鈕</td><td class="tf-cell">${textFieldHTML({ button: "" })}</td></tr>
</tbody></table></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">標籤</td><td>label/sm（源泉圓體 B、字距 5%）、<code class="var">--ds-sys-color-text-100</code></td></tr>
<tr><td class="al">燈泡</td><td><code class="var">--ds-comp-text-field-icon-lg</code>（icon/lg）</td></tr>
<tr><td class="al">輸入列</td><td>高 48（Figma 固定，沒有 token）、上下內距和間距 <code class="var">--ds-sys-spacing-md</code></td></tr>
<tr><td class="al">內容框</td><td>底色 <code class="var">--ds-sys-color-surface-bright</code>、內距 2xs／xs</td></tr>
<tr><td class="al">字</td><td>手寫 body/lg（20/22、字距 5%）<code class="var">--ds-sys-color-text-100</code>；提示字 <code class="var">--ds-sys-color-text-200</code></td></tr>
<tr><td class="al">✕、↳</td><td><code class="var">--ds-comp-text-field-icon-sm</code>（icon/xs）</td></tr>
<tr><td class="al">底線</td><td><code class="var">--ds-comp-text-field-line-color</code>／<code class="var">-width</code>（outline 200、border/xs）；聚焦 <code class="var">--ds-comp-text-field-line-focus-color</code>／<code class="var">-focus-width</code>（outline 300、border/md）</td></tr>
<tr><td class="al">說明列</td><td>上內距 md、右內距 2xl、間距 xs；label/sm <code class="var">--ds-sys-color-text-200</code>；按鈕：馬克筆按鈕 Primary・sm</td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre class="wg-code"><code>${esc(USAGE)}</code></pre></section>
<style>
.tf-try { width: 290px; padding: 8px 0; }
.tf-cell { padding: 14px 16px; }
.tf-cell .ds-text-field { width: 290px; }
.wg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    requestAnimationFrame(() => wireTextField(el));
    return el;
  },
};
