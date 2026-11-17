// 底部導覽：Figma section 162510:14932（bottom nav/main、bottom nav/items）
import { bottomNavHTML, wireBottomNav, DEFAULT_ITEMS } from "../components/bottom-nav.js";

const USAGE = `import { bottomNavHTML, wireBottomNav } from "./components/bottom-nav.js";

el.innerHTML = bottomNavHTML({
  active: "plan",
  items: [
    { key: "plan", label: "行程", icon: "calender" },
    { key: "transport", label: "交通", icon: "flight" },
    …
  ],
});
wireBottomNav(el); // 點一格切 active、畫抖動外框`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

export default { title: "Components/底部導覽 Bottom nav" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>底部導覽 Bottom nav</h1>
<p class="lead">App 底部的主要導覽。外框是 <code>bg pattern/primary-soft</code>＋抖動外框，每一格是一顆 <code>bg pattern/tertiary</code> 的圓。<br>
目前這頁（active）icon 從 duotone 換成 sticker、放大到 <code>comp/bottom nav/active-icon</code>、文字藏起來；放大後一支看不見的筆照著每一塊上色的形狀描出來再填色。點點看。</p>

<section class="tk"><h2>bottom nav/main</h2>
<div class="bn-stage">${bottomNavHTML({ active: "plan" })}</div>
</section>

<section class="tk"><h2>bottom nav/items</h2>
<table><thead><tr><th>Property 1</th><th>預覽</th><th>說明</th></tr></thead><tbody>
<tr><td class="nm">default</td><td class="bn-cell">${bottomNavHTML({ items: [DEFAULT_ITEMS[0]], active: "" }).replace('class="ds-bottom-nav ', 'class="ds-bottom-nav bn-bare ')}</td><td class="al">duotone icon <code>sys/icon/md</code>（24）＋ caption/sm/regular</td></tr>
<tr><td class="nm">active</td><td class="bn-cell">${bottomNavHTML({ items: [DEFAULT_ITEMS[0]], active: "plan" }).replace('class="ds-bottom-nav ', 'class="ds-bottom-nav bn-bare ')}</td><td class="al">sticker icon <code>comp/bottom nav/active-icon</code>（32），文字隱藏</td></tr>
</tbody></table>
<p class="note">鍵盤操作時（Tab）會出現和按鈕一樣的 Focus ring。</p>
</section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">外框底紋</td><td><code class="var">ds-pattern--primary-soft</code></td></tr>
<tr><td class="al">外框線</td><td><code class="var">--ds-sys-color-outline-50</code>・抖動 wiggle 0.3・<code class="var">--ds-sys-border-xs</code></td></tr>
<tr><td class="al">外框陰影</td><td><code class="var">--ds-elevation-surface-soft</code></td></tr>
<tr><td class="al">外框圓角</td><td><code class="var">--ds-comp-bottom-nav-radius</code></td></tr>
<tr><td class="al">外框內距／間距</td><td><code class="var">--ds-sys-spacing-xs</code>／<code class="var">--ds-sys-spacing-2xl</code></td></tr>
<tr><td class="al">圓的底紋</td><td><code class="var">ds-pattern--tertiary</code></td></tr>
<tr><td class="al">圓的框</td><td><code class="var">--ds-sys-border-md</code> <code class="var">--ds-sys-color-outline-50</code></td></tr>
<tr><td class="al">圓的陰影</td><td><code class="var">--ds-elevation-component-md</code></td></tr>
<tr><td class="al">icon</td><td><code class="var">--ds-sys-icon-md</code>／active <code class="var">--ds-comp-bottom-nav-active-icon</code></td></tr>
<tr><td class="al">文字</td><td><code class="var">--ds-sys-font-size-label-xs</code> <code class="var">--ds-sys-color-text-100</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre class="wg-code"><code>${esc(USAGE)}</code></pre></section>
<style>
.bn-stage { padding: 32px 16px; }
.bn-cell { padding: 16px 12px; }
.bn-bare { padding: 0; gap: 0; box-shadow: none; background: none; }
.bn-bare::before, .bn-bare > .ds-wiggle__svg { display: none; }
.wg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    requestAnimationFrame(() => wireBottomNav(el));
    return el;
  },
};
