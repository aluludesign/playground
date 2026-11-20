// 多行輸入框：Figma shared comps「text area」（162250:10394）
import { textAreaHTML, wireTextArea } from "../components/text-area.js";
import avatar from "../images/sample-avatar.jpg";

const USAGE = `import { textAreaHTML, wireTextArea } from "./components/text-area.js";

el.innerHTML = textAreaHTML({
  label: "有什麼想說的？",
  placeholder: "許願卡上的留言",
  avatar: me.photo,          // Show Leading icon（頭像）；給 "" 就不顯示
  photos: [],                // Show photos：已經放的照片
  photoButton: "+照片",       // Show photo button；給 "" 就不顯示
  cancel: "取消",             // Show cancel；給 "" 就不顯示（任何 state 都可以有或沒有）
  submit: "送出許願",
});
wireTextArea(el); // 聚焦／有字換樣子、跟著字變高、✕ 清除、選照片、畫抖動線
el.addEventListener("ds-text-area-submit", (e) => save(e.detail.value, e.detail.files));
el.addEventListener("ds-text-area-cancel", close);`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const LONG = "晴空塔門票晴空塔門票晴空塔門票晴空塔門票晴空塔門票";
const P3 = [avatar, avatar, avatar];

export default { title: "Components/多行輸入框 Text area" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>多行輸入框 Text area</h1>
<p class="lead">寫一段話、可以附照片的輸入框（例如許願卡上的留言）。前面是自己的頭像，內容框跟著字變高，底下一列放照片；最下面是取消和送出。底線、打字游標、清除 ✕ 的規則跟文字輸入框一樣。</p>

<section class="tk"><h2>試試看</h2>
<div class="ta-try">${textAreaHTML({ avatar })}</div>
<p class="note">點進去打字（會跟著字變高）、按「+照片」選照片、按照片右上角的 ✕ 刪掉、按 ✕ 清掉字。</p></section>

<section class="tk"><h2>state</h2>
<table><thead><tr><th>state</th><th>預覽</th><th>說明</th></tr></thead><tbody>
<tr><td class="nm">default</td><td class="ta-cell">${textAreaHTML({ avatar })}</td><td class="al">空的、沒聚焦：細底線（outline 200）</td></tr>
<tr><td class="nm">focused_pre typing</td><td class="ta-cell">${textAreaHTML({ avatar, photos: P3, state: "focused" })}</td><td class="al">聚焦、還沒打字：打字游標在最前面（手機叫出鍵盤）；細底線淡掉、粗底線由左往右畫出來；還沒有字，所以沒有 ✕</td></tr>
<tr><td class="nm">focused_typing</td><td class="ta-cell">${textAreaHTML({ avatar, photos: P3, value: LONG, state: "focused" })}</td><td class="al">聚焦、打字中：內容框跟著字變高；有字了，出現清除 ✕</td></tr>
<tr><td class="nm">filled w/o focused</td><td class="ta-cell">${textAreaHTML({ avatar, photos: P3, value: LONG })}</td><td class="al">有字、離開了：底線變回細的</td></tr>
</tbody></table>
<p class="note">兩個 focused 沒有真的聚焦，打字游標是畫上去的。</p></section>

<section class="tk"><h2>Show Leading icon／photos／photo button／Trailing icon／cancel</h2>
<table><thead><tr><th></th><th>預覽</th></tr></thead><tbody>
<tr><td class="nm">沒有頭像</td><td class="ta-cell">${textAreaHTML({})}</td></tr>
<tr><td class="nm">沒有「+照片」</td><td class="ta-cell">${textAreaHTML({ avatar, photoButton: "" })}</td></tr>
<tr><td class="nm">沒有「取消」</td><td class="ta-cell">${textAreaHTML({ avatar, cancel: "" })}</td></tr>
<tr><td class="nm">沒有 ✕</td><td class="ta-cell">${textAreaHTML({ avatar, value: LONG, trailingIcon: false })}</td></tr>
</tbody></table></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">標籤</td><td>label/sm（源泉圓體 B、字距 5%）<code class="var">--ds-sys-color-text-100</code></td></tr>
<tr><td class="al">頭像</td><td>頭像 Avatar，大小 <code class="var">--ds-comp-text-area-avatar</code>（icon/lg＝28）</td></tr>
<tr><td class="al">內容框</td><td>底色 <code class="var">--ds-sys-color-opacity-opacity-primary-50</code>；內距上 2xs、右 5xl、下 <code class="var">--ds-comp-field-height</code>（120）</td></tr>
<tr><td class="al">字</td><td>手寫 body/lg（20/22、字距 5%）<code class="var">--ds-sys-color-text-100</code>；提示字 <code class="var">--ds-sys-color-text-200</code></td></tr>
<tr><td class="al">照片列</td><td>「+照片」馬克筆按鈕 secondary・md；照片縮圖 32（radius/sm、outline 50 細框），右上角 Scrim xs 圓鈕；間距 2xl／xl</td></tr>
<tr><td class="al">✕</td><td><code class="var">--ds-comp-text-field-icon-sm</code></td></tr>
<tr><td class="al">底線</td><td>跟文字輸入框共用 <code class="var">--ds-comp-text-field-line-*</code></td></tr>
<tr><td class="al">動作列</td><td>靠右、間距 md；取消（可以拿掉）Button Secondary・Text・md；送出 馬克筆按鈕 Primary・lg</td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre class="wg-code"><code>${esc(USAGE)}</code></pre></section>
<style>
.ta-try { width: 310px; padding: 8px 0; }
.ta-cell { padding: 14px 16px; }
.ta-cell .ds-text-area { width: 310px; }
.wg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    requestAnimationFrame(() => wireTextArea(el));
    return el;
  },
};
