// 分類圓章：花費每一筆的分類（Lulu 11-24）
import { categoryBadgeHTML, CATEGORIES } from "../components/category-badge.js";

export default { title: "Components/分類圓章 Category badge" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>分類圓章 Category badge</h1>
<p class="lead">實心圓是分類的 custom 色（跟分類佔比長條同一組），icon 填 text inverse 100。icon 先用 Font Awesome。icon 預設 16，可以用 <code>--cat-icon</code> 改成跟旁邊文字一樣大；圓＝icon 四邊各多 6。</p>
<section class="tk"><table><thead><tr><th>key</th><th>分類</th><th>預覽</th><th>顏色</th></tr></thead><tbody>
${Object.entries(CATEGORIES).map(([k, c]) => `<tr><td class="nm">${k}</td><td>${c.name}</td><td style="padding:10px 16px">${categoryBadgeHTML({ key: k })}</td><td>${c.color}</td></tr>`).join("")}
</tbody></table></section>
<section class="tk"><h2>用法</h2><pre><code>import { categoryBadgeHTML } from "./components/category-badge.js";
el.innerHTML = categoryBadgeHTML({ key: "food" });</code></pre></section>`;
    return el;
  },
};
