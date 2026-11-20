// 可上下拉的面板：Figma「bottom sheet」（162236:14235）
import { bottomSheetHTML, wireBottomSheet } from "../components/bottom-sheet.js";

const USAGE = `import { bottomSheetHTML, wireBottomSheet } from "./components/bottom-sheet.js";

box.innerHTML = bottomSheetHTML({ content: "…日期列、時間軸…", label: "行程" });
const sheet = wireBottomSheet(box.querySelector(".ds-sheet"), {
  snaps: [186, 450, 707],     // 露出來的高度：最低（只剩日期列）、預設、最高（頂列下面）
  at: 1,                      // 一開始停在第幾段
  scroller: ".my-timeline",   // 拉到最高後在這裡面滑是捲它
});
box.addEventListener("ds-sheet-snap", (e) => e.detail.index);
sheet.snapTo(2);`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const filler = Array.from({ length: 30 }, (_, i) => `<p style="margin:0;padding:12px 24px;border-bottom:1px solid var(--ds-sys-color-outline-100)">第 ${i + 1} 列</p>`).join("");

export default { title: "Components/面板 Bottom sheet" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>面板 Bottom sheet</h1>
<p class="lead">疊在地圖上、可以上下拉的面板。按住面板任何地方上下拉，放手停在最近的一段（最低／預設／最高）；甩得快就往那個方向跳一段。拉到最高之後，在裡面上下滑是捲內容，捲到頂再往下拉才收面板。只點把手：一段一段往上，到頂再回最低。</p>

<section class="tk"><h2>試拉看看（390×844）</h2>
<div id="sheet-demo" style="position:relative;width:390px;height:844px;overflow:hidden;border-radius:12px;background:linear-gradient(160deg,#dfe7d6,#c5d4bb 50%,#ebe5d6)">
${bottomSheetHTML({ content: `<div class="demo-scroll" style="flex:1;overflow:auto">${filler}</div>` })}
</div>
<p class="note" id="sheet-now">停在：第 1 段</p></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">底</td><td><code class="var">--ds-sys-color-surface</code>＋bg pattern、<code class="var">--ds-elevation-surface-soft</code>、上兩角 <code class="var">--ds-sys-radius-sm</code></td></tr>
<tr><td class="al">header</td><td>高 40；內距上 <code class="var">--ds-sys-spacing-2xl</code>、左右下 <code class="var">--ds-sys-spacing-4xl</code></td></tr>
<tr><td class="al">Handle</td><td>寬 24、線寬 <code class="var">--ds-sys-border-xl</code>、圓頭；顏色 <code class="var">--ds-foun-color-share-black-neutral-700</code>（Figma 沒綁 sys 色）</td></tr>
<tr><td class="al">放手的動態</td><td>320ms、ease-tactile（跟 Dynamic Iris 同一條）；prefers-reduced-motion 時直接到位</td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre><code>${esc(USAGE)}</code></pre></section>`;
    requestAnimationFrame(() => {
      const s = el.querySelector("#sheet-demo .ds-sheet");
      wireBottomSheet(s, { snaps: [186, 450, 707], at: 1, scroller: ".demo-scroll" });
      el.addEventListener("ds-sheet-snap", (e) => (el.querySelector("#sheet-now").textContent = "停在：第 " + e.detail.index + " 段（" + e.detail.height + "px）"));
    });
    return el;
  },
};
