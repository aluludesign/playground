// 搜尋清單：Figma「search list」（162537:17618）
import { searchItemHTML } from "../components/search-list.js";
import photo from "../images/sample-attraction.jpg";

const ITEM = { photo, name: "淺草寺", info: ["日本，東京都", "景點"] };
const USAGE = `import { searchItemHTML } from "./components/search-list.js";

el.innerHTML = searchItemHTML({
  photo: "…/asakusa.jpg",
  name: "淺草寺",
  info: ["日本，東京都", "景點"], // 中間自動用「‧」隔開
});`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

export default { title: "Components/搜尋清單 Search list" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>搜尋清單 Search list</h1>
<p class="lead">搜尋結果、推薦地點清單裡的一列：照片、名稱、一行資訊。滑鼠移上去會刷淡橘色，按下去淡橘色往外長一點。分頁籤 Segmented 的 sheet 範例就是用這個排成清單。</p>

<section class="tk"><h2>Property 1</h2>
<table><thead><tr><th>state</th><th>預覽</th><th>說明</th></tr></thead><tbody>
<tr><td class="nm">Default</td><td class="sl-cell">${searchItemHTML(ITEM)}</td><td class="al">沒有底</td></tr>
<tr><td class="nm">hover</td><td class="sl-cell">${searchItemHTML({ ...ITEM, state: "hover" })}</td><td class="al">往外 4 蓋一層 <code>opacity primary 50</code>（圓角 <code>radius/sm</code>）</td></tr>
<tr><td class="nm">pressed</td><td class="sl-cell">${searchItemHTML({ ...ITEM, state: "pressed" })}</td><td class="al">淡橘色再往外長到 6</td></tr>
<tr><td class="nm">focus</td><td class="sl-cell">${searchItemHTML({ ...ITEM, state: "focus" })}</td><td class="al">鍵盤操作（Tab）：hover 的淡橘色，外面留 <code>spacing/2xs</code> 再畫 <code>comp/focus-ring</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>清單</h2>
<div class="sl-list">${Array.from({ length: 4 }, () => searchItemHTML(ITEM)).join("")}</div>
</section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">照片</td><td>48・<code class="var">--ds-sys-radius-sm</code></td></tr>
<tr><td class="al">照片和文字／名稱和資訊</td><td><code class="var">--ds-sys-spacing-xl</code>／<code class="var">--ds-sys-spacing-xs</code></td></tr>
<tr><td class="al">名稱</td><td>Body/sm/semi-bold <code class="var">--ds-sys-color-text-100</code></td></tr>
<tr><td class="al">資訊</td><td>label/md/regular <code class="var">--ds-sys-color-text-200</code></td></tr>
<tr><td class="al">hover／pressed／focus 的底</td><td><code class="var">--ds-sys-color-opacity-opacity-primary-50</code>・<code class="var">--ds-sys-radius-sm</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre class="wg-code"><code>${esc(USAGE)}</code></pre></section>
<style>
.sl-cell { padding: 18px 16px; width: 310px; }
.sl-list { width: 310px; display: flex; flex-direction: column; gap: var(--ds-sys-spacing-2xl); padding: 16px 8px; }
.wg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    return el;
  },
};
