// 頭像：Figma shared comps「avatar」（162273:13717）
import { avatarHTML } from "../components/avatar.js";
import photo from "../images/sample-avatar.jpg";

const USAGE = `import { avatarHTML } from "./components/avatar.js";

el.innerHTML = avatarHTML({ src: "…/me.jpg", alt: "佳瑜", size: "md" }); // size: lg | md | sm`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

export default { title: "Components/頭像 Avatar" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>頭像 Avatar</h1>
<p class="lead">旅伴的圓形大頭照，裡面描一圈細細的淺色框。</p>

<section class="tk"><h2>Property 1</h2>
<table><thead><tr><th>size</th><th>預覽</th><th>token</th></tr></thead><tbody>
<tr><td class="nm">lg</td><td class="av-cell">${avatarHTML({ src: photo, size: "lg" })}</td><td><code class="var">--ds-comp-avatar-size-lg</code>（35）</td></tr>
<tr><td class="nm">md</td><td class="av-cell">${avatarHTML({ src: photo })}</td><td><code class="var">--ds-comp-avatar-size-md</code>（icon/md，24）</td></tr>
<tr><td class="nm">sm</td><td class="av-cell">${avatarHTML({ src: photo, size: "sm" })}</td><td><code class="var">--ds-comp-avatar-size-sm</code>（18）</td></tr>
</tbody></table></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">細框（畫在內側）</td><td><code class="var">--ds-comp-avatar-border</code>・<code class="var">--ds-sys-color-outline-50</code></td></tr>
<tr><td class="al">大小</td><td><code class="var">--ds-comp-avatar-size-lg</code>／<code class="var">-md</code>／<code class="var">-sm</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre class="wg-code"><code>${esc(USAGE)}</code></pre></section>
<style>
.av-cell { padding: 14px 16px; line-height: 0; }
.wg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    return el;
  },
};
