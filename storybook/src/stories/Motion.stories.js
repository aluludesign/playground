// 動態：一支看不見的筆畫出來的兩種效果（筆畫線、筆刷上色）
import { penLineSVG, drawPenLine } from "../pen-line.js";
import { markPenLayers, drawPenBrush } from "../pen-brush.js";

const raw = import.meta.glob("../icons/general/*_sticker.svg", { query: "?raw", import: "default", eager: true });
const sticker = (name) => markPenLayers(raw[`../icons/general/icon_${name}_sticker.svg`] || "").replace("<svg", '<svg class="ds-pen-brush is-drawn mo-sticker"');

const LINE_USAGE = `import { penLineSVG, drawPenLine } from "./pen-line.js";

// 放在要畫線的那一欄裡（那一欄要 position: relative），線會跟它等寬
label.insertAdjacentHTML("beforeend", penLineSVG({ drawn: false }));
drawPenLine(label.querySelector(".ds-pen-line"), true);  // 由左往右畫出來
drawPenLine(label.querySelector(".ds-pen-line"), false); // 收起來`;

const BRUSH_USAGE = `import { markPenLayers, drawPenBrush } from "./pen-brush.js";

// sticker SVG 字串先標出上色層，svg 加上 ds-pen-brush
el.innerHTML = markPenLayers(stickerSvg).replace("<svg", '<svg class="ds-pen-brush"');
drawPenBrush(el.querySelector("svg"), true);  // 從左上往右下一塊一塊畫出來
drawPenBrush(el.querySelector("svg"), false); // 收起來`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

export default { title: "Style/動態 Motion" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>動態 Motion</h1>
<p class="lead">Trippps 的手繪感也放在「東西怎麼出現」上：很多地方像有一支看不見的筆，當下把它畫出來。這裡收集這類共用的動態規則，元件直接套用。</p>

<section class="tk"><h2>筆畫線 pen line</h2>
<p class="note">一條手繪的抖動線，出現時由左往右畫出來；收起來時直接消失，不倒著擦。形狀照 Figma <code>divider/wiggle</code>（Dynamic stroke frequency 10・wiggle 1.5・smoothen 0.5）畫出來的那條，長度跟放它的那一欄等寬，所以會跟著字變長變短，線寬不變。<br>用在：分頁籤 Segmented 選到的那一格。</p>
<div class="mo-lines">
  <span class="mo-label">熱門地點${penLineSVG({ drawn: true })}</span>
  <span class="mo-label">不指定地點${penLineSVG({ drawn: true })}</span>
  <span class="mo-label">北海道 8 日孝親之旅${penLineSVG({ drawn: true })}</span>
</div>
<button type="button" class="mo-replay" data-replay="line">再畫一次</button>
<table><thead><tr><th>變數</th><th>預設</th><th>說明</th></tr></thead><tbody>
<tr><td><code class="var">--pen-line-color</code></td><td><code>primary</code></td><td class="al">線的顏色</td></tr>
<tr><td><code class="var">--pen-line-width</code></td><td><code>border/md</code></td><td class="al">線寬</td></tr>
<tr><td><code class="var">--pen-line-duration</code></td><td>.35s</td><td class="al">畫完一條要多久</td></tr>
<tr><td><code class="var">--pen-line-delay</code></td><td>0</td><td class="al">晚多久才開始畫</td></tr>
</tbody></table>
<pre class="wg-code"><code>${esc(LINE_USAGE)}</code></pre>
</section>

<section class="tk"><h2>筆刷上色 pen brush</h2>
<p class="note">sticker 的上色模仿筆刷塗鴉，所以出現時由一支看不見的筆畫出來：一塊接一塊（左上的先），每一塊從左上往右下掃出來，先出描邊、緊跟著填色，最後描邊收掉，停下來的樣子跟原本的 sticker 一模一樣。白底和深棕線稿不動。<br>用在：底部導覽 Bottom nav 切到的那一格（icon 先放大，<code>--pen-start</code> 0.2s 後接著畫）。</p>
<div class="mo-stickers">${["calender", "start_heart", "flight", "peoploe_plus", "circle_triangel_down"].map((n) => `<span class="mo-sticker-box">${sticker(n)}</span>`).join("")}</div>
<button type="button" class="mo-replay" data-replay="brush">再畫一次</button>
<table><thead><tr><th>變數</th><th>預設</th><th>說明</th></tr></thead><tbody>
<tr><td><code class="var">--pen-start</code></td><td>0</td><td class="al">晚多久才開始畫</td></tr>
<tr><td><code class="var">--pen-draw</code></td><td>.3s</td><td class="al">掃過一塊要多久</td></tr>
<tr><td><code class="var">--pen-gap</code></td><td>.07s</td><td class="al">下一塊晚多久開始</td></tr>
</tbody></table>
<pre class="wg-code"><code>${esc(BRUSH_USAGE)}</code></pre>
</section>
<style>
.mo-lines { display: flex; flex-wrap: wrap; gap: 32px; padding: 16px 4px 12px; }
.mo-label { position: relative; display: inline-flex; padding: 0 var(--ds-sys-spacing-sm); font: 500 var(--ds-sys-font-size-body-sm)/1 var(--ds-sys-font-family-body); letter-spacing: .05em; color: var(--ds-sys-color-text-100); }
.mo-label > .ds-pen-line { position: absolute; left: -1px; width: calc(100% + 2px); top: calc(100% - 5px); height: 5px; }
.mo-label > span { position: relative; }
.mo-stickers { display: flex; gap: 24px; padding: 16px 4px 12px; }
.mo-sticker-box { width: 56px; height: 56px; display: grid; place-items: center; }
.mo-sticker { width: 48px; height: 48px; overflow: visible; }
.mo-replay { margin: 4px 0 16px; padding: 6px 14px; border: 1px solid #d9cdc8; border-radius: 999px; background: #fff; font: 13px "Noto Sans TC", sans-serif; color: #2a2421; cursor: pointer; }
.wg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    const replay = (sel, draw) => {
      const els = [...el.querySelectorAll(sel)];
      els.forEach((s) => draw(s, false));
      els.forEach((s) => getComputedStyle(s).opacity);
      requestAnimationFrame(() => els.forEach((s) => draw(s, true)));
    };
    el.addEventListener("click", (e) => {
      const b = e.target.closest(".mo-replay");
      if (!b) return;
      if (b.dataset.replay === "line") replay(".ds-pen-line", drawPenLine);
      else replay(".mo-sticker", drawPenBrush);
    });
    return el;
  },
};
