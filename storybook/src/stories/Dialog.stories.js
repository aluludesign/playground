// 對話框：Figma「dialogue」（162768:53321，section 162776:15212）
import { closeDialog, dialogHTML, dialogSectionHTML, openDialog, sectionTitleHTML, wireDialog } from "../components/dialog.js";
import { fieldHTML, wireField } from "../components/field.js";
import { textAreaHTML, wireTextArea } from "../components/text-area.js";
import avatar from "../images/sample-avatar.jpg";

const USAGE = `import { dialogHTML, dialogSectionHTML, openDialog, closeDialog } from "./components/dialog.js";
import { fieldHTML, wireField } from "./components/field.js";

const layer = openDialog(dialogHTML({
  title: "淺草寺",
  description: "",           // Show descriptions：給字才顯示
  close: true,               // Show close button
  cancel: "取消",            // Show actions：cancel、confirm 都給 "" 就整排不顯示
  confirm: "送出",
  content: dialogSectionHTML({ title: "淺草寺", content: fieldHTML({ label: "項目" }) }),
}));
wireField(layer);
layer.addEventListener("ds-dialog-close", (e) => closeDialog(layer));   // e.detail.reason："close"｜"cancel"
layer.addEventListener("ds-dialog-confirm", () => { /* 送出 */ closeDialog(layer); });`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

const WISH = () => textAreaHTML({ avatar, cancel: "", submit: "" });
const WISH_FILLED = () =>
  textAreaHTML({ avatar, cancel: "", submit: "", value: "晴空塔門票晴空塔門票晴空塔門票晴空塔門票晴空塔門票", photos: [avatar, avatar, avatar] });
const fields = () => fieldHTML({ label: "項目", state: "focused" }) + fieldHTML({ label: "項目", state: "focused" });
const SECTIONS = () => `<div class="ds-dialog-sections">${dialogSectionHTML({ title: "淺草寺", content: fields() })}${dialogSectionHTML({ title: "淺草寺", content: fields() })}</div>`;

export default { title: "Components/對話框 Dialog" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>對話框 Dialog</h1>
<p class="lead">白底小格子、手繪外框的卡片，浮在畫面中間。上面是標題（底下一筆螢光筆）和說明，右上角關閉鈕；中間的內容可以自由替換；下面靠右是「取消」和馬克筆的送出鈕。</p>

<section class="tk"><h2>打開看看</h2>
<p class="note">內容太長時只有中間會捲動，標題、關閉鈕和下面的按鈕都固定不動；有說明的話，往上捲時說明在原地淡出、內容捲上來佔掉它的位置。打開時從下面浮上來、標題的螢光筆接著畫出來。按 ✕ 或「取消」關起來，「送出」也會關；還沒打字時點外面也會關，打過字就只能按按鈕。（後面那層半透明的黑只是這頁示範用，Figma 沒有畫。）</p>
<div class="dg-row"><button type="button" class="dg-open" data-k="wish">許願</button><button type="button" class="dg-open" data-k="form">表單</button></div></section>

<section class="tk"><h2>Figma 的三個例子</h2>
<div class="dg-wall">
<div class="dg-slot">${dialogHTML({ title: "淺草寺", description: "desicriptions", content: WISH() })}</div>
<div class="dg-slot">${dialogHTML({ title: "直接許願淺草寺", description: "不選地點也能許願，願望地圖上不會出現地點指標。", content: WISH_FILLED() })}</div>
<div class="dg-slot">${dialogHTML({ title: "淺草寺", description: "desicriptions", confirm: "送出", content: SECTIONS() })}</div>
</div></section>

<section class="tk"><h2>開關</h2>
<table><tbody>
<tr><td class="nm">沒有說明</td><td class="dg-cell">${dialogHTML({ title: "淺草寺", content: WISH() })}</td></tr>
<tr><td class="nm">沒有關閉鈕</td><td class="dg-cell">${dialogHTML({ title: "淺草寺", description: "desicriptions", close: false, content: WISH() })}</td></tr>
<tr><td class="nm">內容很長<br>（這裡限高 420，捲捲看）</td><td class="dg-cell">${dialogHTML({ title: "淺草寺", description: "不選地點也能許願，願望地圖上不會出現地點指標。", confirm: "送出", content: SECTIONS() }).replace('class="ds-dialog', 'style="--dialog-max-height:420px" class="ds-dialog')}</td></tr>
<tr><td class="nm">沒有按鈕</td><td class="dg-cell">${dialogHTML({ title: "淺草寺", description: "desicriptions", cancel: "", confirm: "", content: WISH() })}</td></tr>
</tbody></table></section>

<section class="tk"><h2>段落標題 Section title</h2>
<p class="note">表單裡分段用。一段＝標題＋輸入框，段和段、段裡面都隔 16。前面可以放箭頭。</p>
<table><tbody>
<tr><td class="nm">預設</td><td class="dg-cell">${sectionTitleHTML({ text: "淺草寺" })}</td></tr>
<tr><td class="nm">有箭頭</td><td class="dg-cell">${sectionTitleHTML({ text: "淺草寺", icon: true })}</td></tr>
<tr><td class="nm">內容範本</td><td class="dg-cell" style="width:310px">${SECTIONS()}</td></tr>
</tbody></table></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th><th>指到</th></tr></thead><tbody>
<tr><td class="al">圓角（4）</td><td><code class="var">--ds-comp-dialog-radius</code></td><td><code class="var">sys/radius/xs</code></td></tr>
<tr><td class="al">內距（24）</td><td><code class="var">--ds-comp-dialog-padding</code></td><td><code class="var">sys/spacing/4xl</code></td></tr>
<tr><td class="al">標題區／內容／按鈕間距（16）</td><td><code class="var">--ds-comp-dialog-gap</code></td><td><code class="var">sys/spacing/2xl</code></td></tr>
<tr><td class="al">標題和說明間距（8）</td><td><code class="var">--ds-comp-dialog-header-gap</code></td><td><code class="var">sys/spacing/md</code></td></tr>
<tr><td class="al">兩顆按鈕間距（8）</td><td><code class="var">--ds-comp-dialog-actions-gap</code></td><td><code class="var">sys/spacing/md</code></td></tr>
<tr><td class="al">底色</td><td><code class="var">--ds-comp-dialog-container</code></td><td><code class="var">sys/color/surface bright</code></td></tr>
<tr><td class="al">外框線</td><td><code class="var">--ds-comp-dialog-outline</code></td><td><code class="var">sys/color/outline 300</code></td></tr>
<tr><td class="al">段落標題 icon（16）</td><td><code class="var">--ds-comp-section-title-icon</code></td><td><code class="var">sys/icon/xs</code></td></tr>
<tr><td class="al">段落標題 icon 和字間距（2）</td><td><code class="var">--ds-comp-section-title-gap</code></td><td><code class="var">sys/spacing/2xs</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre class="dg-code"><code>${esc(USAGE)}</code></pre></section>
<style>
.dg-wall { display: flex; flex-wrap: wrap; gap: 32px; align-items: flex-start; padding: 8px 0 24px; }
.dg-slot { width: 358px; }
.dg-cell { padding: 16px 12px; width: 358px; }
.dg-row { display: flex; gap: 12px; }
.dg-open { padding: 8px 16px; border-radius: 8px; border: 1px solid #ccc; background: #fff; cursor: pointer; font: inherit; }
.ds-dialog-layer.dg-demo { background: color-mix(in srgb, var(--ds-sys-color-scrim) 40%, transparent); }
.ds-dialog-layer.dg-demo .ds-dialog { --dialog-max-width: 358px; }
.dg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    requestAnimationFrame(() => {
      wireDialog(el);
      wireField(el);
      wireTextArea(el);
    });
    el.querySelectorAll(".dg-open").forEach((b) =>
      b.addEventListener("click", () => {
        const html =
          b.dataset.k === "wish"
            ? dialogHTML({ title: "淺草寺", description: "有什麼想跟大家說的？", content: WISH(), drawn: false })
            : dialogHTML({ title: "淺草寺", confirm: "送出", content: `<div class="ds-dialog-sections">${dialogSectionHTML({ title: "淺草寺", content: fieldHTML({ label: "項目" }) + fieldHTML({ label: "金額" }) })}</div>`, drawn: false });
        const layer = openDialog(html);
        layer.classList.add("dg-demo");
        wireField(layer);
        wireTextArea(layer);
        layer.addEventListener("ds-dialog-close", () => closeDialog(layer));
        layer.addEventListener("ds-dialog-confirm", () => closeDialog(layer));
        // 沒改過：點外面就關；改過：只能按按鈕關
        let dirty = false;
        layer.addEventListener("input", () => (dirty = true));
        layer.addEventListener("click", (e) => { if (e.target === layer && !dirty) closeDialog(layer); });
      }),
    );
    return el;
  },
};
