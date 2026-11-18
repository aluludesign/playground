// 分頁籤：Figma section 162537:17529（segmented、segmented/item）
import { segmentedHTML, segmentedItemHTML, segmentedSheetHTML, wireSegmented } from "../components/segmented.js";
import photo from "../images/sample-attraction.jpg";

const USAGE = `import { segmentedHTML, wireSegmented } from "./components/segmented.js";

el.innerHTML = segmentedHTML({
  selected: "none",
  items: [
    { key: "none", label: "不選地點" },
    { key: "any", label: "不指定地點" },
  ],
});
wireSegmented(el); // 點一格（或左右鍵）切換
el.addEventListener("ds-segmented-select", (e) => console.log(e.detail.key));

// 帶內容的那張（segmented sheet）：content 放什麼都可以，切頁籤時自己換
el.innerHTML = segmentedSheetHTML({
  selected: "hot",
  items: [{ key: "hot", label: "熱門地點" }, { key: "any", label: "不指定地點" }],
  content: placesHTML,
});
wireSegmented(el);
el.addEventListener("ds-segmented-select", (e) => {
  el.querySelector(".ds-segmented-sheet__content").innerHTML = contentFor(e.detail.key);
});`;

// Figma segmented sheet 裡的範例清單（wish/recommands → search list）
const PLACE = () => `<div class="sg-place"><img class="sg-place__photo" src="${photo}" alt=""><div class="sg-place__text"><div class="sg-place__name">淺草寺</div><div class="sg-place__info"><span>日本，東京都</span><span class="sg-place__dot">‧</span><span>景點</span></div></div></div>`;
const PLACES = Array.from({ length: 9 }, PLACE).join("");

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const one = (opts) => `<div class="ds-segmented sg-bare" role="tablist">${segmentedItemHTML({ key: "a", label: "不選地點", ...opts })}</div>`;

export default { title: "Components/分頁籤 Segmented" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>分頁籤 Segmented</h1>
<p class="lead">一排像資料夾標籤的頁籤，左上小圓角、右上大圓角、下面是方的。沒選的是淡橘格子底；選中的換成米白格子底、字變深，字底下一支看不見的筆由左往右畫出一條手繪的橘色抖動線（長度跟字那一欄一樣寬）。點點看，也可以用鍵盤左右鍵切換。</p>

<section class="tk"><h2>segmented</h2>
<div class="sg-stage">${segmentedHTML({ selected: "none" })}</div>
</section>

<section class="tk"><h2>segmented sheet</h2>
<p class="note">上面一排頁籤、下面一張放內容的底。內容可以自由替換（Figma 寫的 containt replaced）：清單、表單、地圖都可以放，超出的部分裁掉。下面用 Figma 裡的熱門地點清單當例子，滑鼠移到某一列會刷淡橘色。</p>
<div class="sg-sheet-stage">${segmentedSheetHTML({ selected: "hot", items: [{ key: "hot", label: "熱門地點" }, { key: "any", label: "不指定地點" }], content: PLACES })}</div>
</section>

<section class="tk"><h2>segmented/item</h2>
<table><thead><tr><th>Property 1</th><th>預覽</th><th>說明</th></tr></thead><tbody>
<tr><td class="nm">Default</td><td class="sg-cell">${one({})}</td><td class="al"><code>bg pattern/primary-soft</code>，文字 <code>text 200</code></td></tr>
<tr><td class="nm">hover</td><td class="sg-cell">${one({ state: "hover" })}</td><td class="al">滑鼠移上去：底換成 <code>bg pattern/surface</code>，再蓋一層 <code>opacity primary 50</code></td></tr>
<tr><td class="nm">focus</td><td class="sg-cell">${one({ state: "focus" })}</td><td class="al">鍵盤操作（Tab）：外面留 <code>spacing/2xs</code>，再畫 <code>comp/focus-ring</code> 的框</td></tr>
<tr><td class="nm">Active</td><td class="sg-cell">${one({ selected: true })}</td><td class="al"><code>bg pattern/surface</code>，文字 <code>text 100</code>，字底下 <code>primary</code> 的抖動線（<code>border/md</code>），選到時由左往右畫出來</td></tr>
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
<tr><td class="al">sheet 的底</td><td><code class="var">ds-pattern--surface</code>・四角 <code class="var">--ds-comp-segmented-sheet-radius</code></td></tr>
<tr><td class="al">sheet 內容區內距</td><td><code class="var">--ds-sys-spacing-4xl</code></td></tr>
<tr><td class="al">sheet 陰影</td><td>Elevation/surface/medium</td></tr>
<tr><td class="al">抖動線</td><td><code class="var">--ds-sys-color-primary</code>・<code class="var">--ds-sys-border-md</code>，比文字左右各長 <code class="var">--ds-sys-spacing-sm</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre class="wg-code"><code>${esc(USAGE)}</code></pre></section>
<style>
.sg-stage { padding: 24px 0 0; border-bottom: 1px solid #eee5e1; max-width: 420px; }
.sg-sheet-stage { padding: 16px 32px 40px; }
.sg-sheet-stage .ds-segmented-sheet { width: 358px; height: 599px; }
.sg-place { position: relative; display: flex; align-items: center; gap: var(--ds-sys-spacing-xl); flex: none; }
.sg-place::after { content: ""; position: absolute; inset: -4px; border-radius: var(--ds-sys-radius-sm); background: var(--ds-sys-color-opacity-opacity-primary-50); opacity: 0; pointer-events: none; }
@media (hover: hover) { .sg-place:hover::after { opacity: 1; } }
.sg-place__photo { width: 48px; height: 48px; flex: none; object-fit: cover; border-radius: var(--ds-sys-radius-sm); }
.sg-place__text { display: flex; flex-direction: column; gap: var(--ds-sys-spacing-xs); min-width: 0; }
.sg-place__name { font: 500 var(--ds-sys-font-size-body-sm)/1 var(--ds-sys-font-family-body); letter-spacing: .05em; color: var(--ds-sys-color-text-100); }
.sg-place__info { display: flex; gap: var(--ds-sys-spacing-xs); font: 400 var(--ds-sys-font-size-label-md)/18px var(--ds-sys-font-family-label); letter-spacing: .04em; color: var(--ds-sys-color-text-200); }
.sg-place__dot { width: 14px; font-size: 0; display: flex; align-items: center; justify-content: center; } /* 字型子集沒有「‧」，照 Figma 畫一顆 14 寬、置中的圓點 */
.sg-place__dot::before { content: ""; width: 3px; height: 3px; border-radius: 50%; background: currentColor; }
.sg-empty { margin: 0; font: 400 var(--ds-sys-font-size-label-md)/1.5 var(--ds-sys-font-family-label); color: var(--ds-sys-color-text-200); }
.sg-cell { padding: 16px 12px; }
.sg-bare { padding: 0; }
.wg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    requestAnimationFrame(() => wireSegmented(el));
    // 範例：切到「不指定地點」時換成一段說明，切回來再顯示清單
    el.addEventListener("ds-segmented-select", (e) => {
      const body = e.target.closest(".ds-segmented-sheet")?.querySelector(".ds-segmented-sheet__content");
      if (body) body.innerHTML = e.detail.key === "hot" ? PLACES : `<p class="sg-empty">這裡放「不指定地點」的內容</p>`;
    });
    return el;
  },
};
