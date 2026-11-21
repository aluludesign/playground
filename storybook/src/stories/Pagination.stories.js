// 分頁點點：Figma「pagination」（162114:15935），用在景點卡的照片
import { paginationHTML, setPaginationActive } from "../components/pagination.js";

const USAGE = `import { paginationHTML, setPaginationActive } from "./components/pagination.js";

el.innerHTML = paginationHTML({ count: 3, active: 0, label: "照片" });
// 照片滑到第 2 張
setPaginationActive(el.querySelector(".ds-pagination"), 1);`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

export default { title: "Components/分頁點點 Pagination" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>分頁點點 Pagination</h1>
<p class="lead">一排小圓點，告訴你現在看的是第幾張。現在這張是主色，其他是淺灰。用在景點卡的照片（照片最多 3 張）。</p>

<section class="tk"><h2>樣子</h2>
<table><thead><tr><th>張數</th><th>第 1 張</th><th>第 2 張</th><th>第 3 張</th></tr></thead><tbody>
${[1, 2, 3].map((n) => `<tr><td class="nm">${n} 張</td>${[0, 1, 2].map((a) => `<td class="pg-cell">${a < n ? paginationHTML({ count: n, active: a }) : ""}</td>`).join("")}</tr>`).join("")}
</tbody></table></section>

<section class="tk"><h2>點點按看看</h2>
<p class="note">按左右切換，現在那顆的顏色會換過去。</p>
<div class="pg-demo"><button type="button" data-d="-1">‹</button><span class="pg-slot">${paginationHTML({ count: 3, active: 0, label: "照片" })}</span><button type="button" data-d="1">›</button></div></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th><th>指到</th></tr></thead><tbody>
<tr><td class="al">點點大小（6）</td><td><code class="var">--ds-comp-pagination-dot-size</code></td><td><code class="var">sys/spacing/sm</code></td></tr>
<tr><td class="al">點點間距（4）</td><td><code class="var">--ds-comp-pagination-gap</code></td><td><code class="var">sys/spacing/xs</code></td></tr>
<tr><td class="al">現在這張</td><td><code class="var">--ds-comp-pagination-color-active</code></td><td><code class="var">sys/color/primary</code></td></tr>
<tr><td class="al">其他張</td><td><code class="var">--ds-comp-pagination-color-inactive</code></td><td><code class="var">sys/color/surf container low</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre class="pg-code"><code>${esc(USAGE)}</code></pre></section>
<style>
.pg-cell { padding: 14px 16px; }
.pg-demo { display: flex; align-items: center; gap: 16px; }
.pg-demo button { width: 32px; height: 32px; border-radius: 50%; border: 1px solid #ccc; background: #fff; cursor: pointer; font-size: 18px; }
.pg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    let i = 0;
    el.querySelectorAll(".pg-demo button").forEach((b) =>
      b.addEventListener("click", () => {
        i = (i + Number(b.dataset.d) + 3) % 3;
        setPaginationActive(el.querySelector(".pg-slot .ds-pagination"), i);
      }),
    );
    return el;
  },
};
