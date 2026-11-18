// 選單：Figma section 162524:13250（menu、menu_item）
import { menuHTML, wireMenu } from "../components/menu.js";

const USAGE = `import { menuHTML, wireMenu } from "./components/menu.js";

el.innerHTML = menuHTML({
  selected: "tokyo",
  items: [
    { key: "hokkaido", label: "北海道 8 日孝親之旅" },
    { key: "tokyo", label: "東京 PA PA 造 Happy Birithday" },
  ],
});
wireMenu(el); // 點一列就選它、畫抖動外框
el.addEventListener("ds-menu-select", (e) => console.log(e.detail.key));`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const one = (label, selected) => menuHTML({ items: [{ key: "a", label }], selected: selected ? "a" : "" }).replace('class="ds-menu ', 'class="ds-menu mn-bare ');

export default { title: "Components/選單 Menu" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>選單 Menu</h1>
<p class="lead">點了才出現的一串選項，例如切換旅程。外框是 <code>bg pattern/bright</code>＋抖動外框；選中的那一列換底色、後面出現打勾。<br>
寬度照最長那一列的字寬（每列都留著打勾的位置，切換選項時寬度不會變），最寬到畫面左右各留 16；一列文字最多三行，超過用「…」。點點看。</p>

<section class="tk"><h2>menu</h2>
<div class="mn-stage">${menuHTML({ selected: "tokyo" })}</div>
</section>

<section class="tk"><h2>menu_item</h2>
<table><thead><tr><th>state</th><th>預覽</th><th>說明</th></tr></thead><tbody>
<tr><td class="nm">default</td><td class="mn-cell">${one("東京 PA PA 造 Happy Bir", false)}</td><td class="al">沒有底色、沒有 icon</td></tr>
<tr><td class="nm">hover</td><td class="mn-cell">${one("東京 PA PA 造 Happy Bir", false).replace('class="ds-menu__item"', 'class="ds-menu__item mn-hover"')}</td><td class="al">滑鼠移上去：刷 <code>opacity primary 50</code>，沒有 icon</td></tr>
<tr><td class="nm">selected</td><td class="mn-cell">${one("東京 PA PA 造 Happy Bir", true)}</td><td class="al">底色 <code>opacity primary 100</code>＋ check_line duotone <code>comp/menu/icon</code>（28）</td></tr>
</tbody></table>
<p class="note">鍵盤操作時（Tab）會出現 Focus ring。</p>
</section>

<section class="tk"><h2>很長的文字</h2>
<p class="note">超過畫面寬度就換行，最多三行。下面是手機寬 375 的樣子（左右各留 16，最寬 343）。</p>
<div class="mn-stage mn-phone">${menuHTML({
      selected: "long",
      items: [
        { key: "short", label: "大阪 3 日" },
        { key: "long", label: "沖繩 跟著海風慢慢走的十二天十一夜家族大旅行（含石垣島、宮古島、竹富島、西表島，還有很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多的行程）" },
      ],
    })}</div>
</section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">外框底紋</td><td><code class="var">ds-pattern--bright</code></td></tr>
<tr><td class="al">外框線</td><td><code class="var">--ds-sys-color-outline-300</code>・抖動 wiggle 0.3・<code class="var">--ds-sys-border-xs</code></td></tr>
<tr><td class="al">外框陰影</td><td><code class="var">--ds-elevation-surface-soft</code></td></tr>
<tr><td class="al">外框圓角</td><td><code class="var">--ds-comp-menu-radius</code></td></tr>
<tr><td class="al">最大寬度</td><td>畫面寬 − 2 × <code class="var">--ds-sys-spacing-2xl</code></td></tr>
<tr><td class="al">列與列間距</td><td><code class="var">--ds-sys-spacing-2xs</code></td></tr>
<tr><td class="al">一列的內距／間距</td><td><code class="var">--ds-sys-spacing-sm</code> <code class="var">--ds-sys-spacing-xl</code>／<code class="var">--ds-sys-spacing-md</code></td></tr>
<tr><td class="al">文字</td><td>Body/sm/semi-bold <code class="var">--ds-sys-font-size-body-sm</code> <code class="var">--ds-sys-color-text-100</code></td></tr>
<tr><td class="al">hover 底色</td><td><code class="var">--ds-sys-color-opacity-opacity-primary-50</code></td></tr>
<tr><td class="al">selected 底色</td><td><code class="var">--ds-sys-color-opacity-opacity-primary-100</code></td></tr>
<tr><td class="al">icon</td><td><code class="var">--ds-comp-menu-icon</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre class="wg-code"><code>${esc(USAGE)}</code></pre></section>
<style>
.mn-stage { padding: 24px 16px; }
.mn-phone { width: 375px; box-sizing: border-box; --menu-max-width: calc(375px - 2 * var(--ds-sys-spacing-2xl)); background: #f6f2f0; border-radius: 12px; }
.mn-hover { background: var(--ds-sys-color-opacity-opacity-primary-50); }
.mn-cell { padding: 16px 12px; }
.mn-bare { box-shadow: none; background: none; width: 278px; }
.mn-bare::before, .mn-bare > .ds-wiggle__svg { display: none; }
.wg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    requestAnimationFrame(() => wireMenu(el));
    return el;
  },
};
