// 動態：一支看不見的筆畫出來的兩種效果（筆畫線、筆刷上色）
import { penLineSVG, penMarkerHTML, drawPenLine, PEN_COLORS } from "../pen-line.js";
import { markPenLayers, drawPenBrush } from "../pen-brush.js";

const raw = import.meta.glob("../icons/general/*_sticker.svg", { query: "?raw", import: "default", eager: true });
const sticker = (name) => markPenLayers(raw[`../icons/general/icon_${name}_sticker.svg`] || "").replace("<svg", '<svg class="ds-pen-brush is-drawn mo-sticker"');

const LINE_USAGE = `import { penLineSVG, drawPenLine } from "./pen-line.js";

// 放在要畫線的那一欄裡（那一欄要 position: relative），線會跟它等寬
label.insertAdjacentHTML("beforeend", penLineSVG({ drawn: false }));
drawPenLine(label.querySelector(".ds-pen-line"), true);  // 由左往右畫出來
drawPenLine(label.querySelector(".ds-pen-line"), false); // 收起來

// 螢光筆：放在字前面（疊在字下面），一樣用 drawPenLine 畫出來
title.insertAdjacentHTML("afterbegin", penMarkerHTML({ look: "title" })); // look: "default" | "title"
drawPenLine(title.querySelector(".ds-pen-marker"), true);`;

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
<p class="note">一支看不見的筆由左往右畫出來，有兩種筆：細的抖動線，和粗的螢光筆（下面）。<br>細線：一條手繪的抖動線，出現時由左往右畫出來；收起來時直接消失，不倒著擦。形狀照 Figma <code>divider/wiggle</code>（Dynamic stroke frequency 10・wiggle 1.5・smoothen 0.5）畫出來的那條，長度跟放它的那一欄等寬，所以會跟著字變長變短，線寬不變。<br>用在：分頁籤 Segmented 選到的那一格。</p>
<div class="mo-lines">
  <span class="mo-label">熱門地點${penLineSVG({ drawn: true })}</span>
  <span class="mo-label">不指定地點${penLineSVG({ drawn: true })}</span>
  <span class="mo-label">北海道 8 日孝親之旅${penLineSVG({ drawn: true })}</span>
</div>
<h3 class="mo-sub">螢光筆 marker</h3>
<p class="note">同一個動態的第二種筆：字底下一筆粗的螢光筆（Figma <code>active_bg/line_lg</code>，線寬 10、Dynamic stroke 實際畫出來的形狀），尾巴筆停住的地方比較深、旁邊滴一小點。由左往右揭開，尾巴那團跟著筆一起出來；寬度跟著字。<br>用在：標題（Figma <code>title</code>：primary 64%、尾巴 shadow/lg）。</p>
<div class="mo-lines">
  <span class="mo-title">${penMarkerHTML({ drawn: true, look: "title" })}<span>淺草寺</span></span>
  <span class="mo-title">${penMarkerHTML({ drawn: true, look: "title" })}<span>北海道 8 日孝親之旅</span></span>
  <span class="mo-title">${penMarkerHTML({ drawn: true })}<span>淺草寺</span></span>
</div>
<p class="note">上面第三個是元件本身的顏色（<code class="var">--ds-comp-active-bg-line-color</code>，custom 5、opacity/3xl）。<br>字換成好幾行時，只有最後一行底下有線（線對齊那一欄的底部，寬度一樣跟著那一欄）：</p>
<div class="mo-lines">
  <span class="mo-title mo-title--multi">${penMarkerHTML({ drawn: true })}<span>淺草寺淺淺草寺淺草寺淺草寺淺淺草寺淺草寺</span></span>
</div>
<h3 class="mo-sub">可以用的顏色</h3>
<p class="note">筆畫線、螢光筆的線可以用 primary、secondary、tertiary 三個主色，和任何一個 custom（1–14，行程顏色）。螢光筆換顏色時，尾巴那團和小點不變。<br>程式：<code>penLineSVG({ color: "custom 3" })</code>、<code>penMarkerHTML({ color: "custom 3" })</code>，可以用的名稱在 <code>PEN_COLORS</code>。</p>
<table class="mo-colors"><thead><tr><th>顏色 token</th><th>筆畫線</th><th>螢光筆</th></tr></thead><tbody>
${PEN_COLORS.map((c) => `<tr><td><code class="var">${c.startsWith("custom") ? "customs/" + c : c}</code></td><td><span class="mo-label">熱門地點${penLineSVG({ drawn: true, color: c })}</span></td><td><span class="mo-title">${penMarkerHTML({ drawn: true, color: c })}<span>淺草寺</span></span></td></tr>`).join("")}
</tbody></table>
<button type="button" class="mo-replay" data-replay="line">再畫一次</button>
<table><thead><tr><th>變數</th><th>預設</th><th>說明</th></tr></thead><tbody>
<tr><td><code class="var">--pen-line-color</code></td><td><code>primary</code></td><td class="al">線的顏色（primary、secondary、tertiary、custom 1–14）</td></tr>
<tr><td><code class="var">--pen-line-width</code></td><td><code>border/md</code></td><td class="al">線寬</td></tr>
<tr><td><code class="var">--pen-line-duration</code></td><td>.35s</td><td class="al">畫完一條要多久</td></tr>
<tr><td><code class="var">--pen-line-delay</code></td><td>0</td><td class="al">晚多久才開始畫</td></tr>
<tr><td><code class="var">--pen-marker-color</code></td><td><code>comp/active bg/line/color</code></td><td class="al">螢光筆的顏色（primary、secondary、tertiary、custom 1–14；標題：primary）</td></tr>
<tr><td><code class="var">--pen-marker-opacity</code></td><td><code>opacity/3xl</code></td><td class="al">螢光筆的透明度（標題：opacity/xl）</td></tr>
<tr><td><code class="var">--pen-marker-end</code></td><td><code>opacity primary 50</code></td><td class="al">尾巴那團的顏色（標題：shadow/lg）</td></tr>
<tr><td><code class="var">--pen-marker-bottom</code></td><td>3.5px</td><td class="al">螢光筆中心離那一欄底部多遠（好幾行時就在最後一行底下）</td></tr>
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
<tr><td><code class="var">--pen-fill</code></td><td>.45</td><td class="al">筆掃到幾成時顏色開始浮出來（越小越早；底部導覽用 .1：畫的速度不變，只是顏色更早浮出來）</td></tr>
</tbody></table>
<pre class="wg-code"><code>${esc(BRUSH_USAGE)}</code></pre>
</section>
<style>
.mo-lines { display: flex; flex-wrap: wrap; gap: 32px; padding: 16px 4px 12px; }
.mo-label { position: relative; display: inline-flex; padding: 0 var(--ds-sys-spacing-sm); font: 500 var(--ds-sys-font-size-body-sm)/1 var(--ds-sys-font-family-body); letter-spacing: .05em; color: var(--ds-sys-color-text-100); }
.mo-label > .ds-pen-line { position: absolute; left: -1px; width: calc(100% + 2px); top: calc(100% - 5px); height: 5px; }
.mo-label > span { position: relative; }
.mo-colors td { padding-top: 10px; padding-bottom: 10px; }
.mo-colors .mo-label, .mo-colors .mo-title { margin: 0 8px; }
.mo-sub { margin: 20px 0 4px; font-size: 15px; }
.mo-title { position: relative; display: inline-block; font: 400 var(--ds-sys-font-size-body-lg)/22px var(--ds-sys-font-family-zhtw-handwriting-zhtw); letter-spacing: .05em; color: var(--ds-sys-color-text-100); white-space: nowrap; }
.mo-title > span:last-child { position: relative; }
.mo-title--multi { width: 310px; white-space: normal; font: var(--ds-sys-font-weight-extra-bold) var(--ds-sys-font-size-headline-xs)/normal var(--ds-sys-font-family-headline); letter-spacing: .05em; --pen-marker-bottom: 2.4px; }
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
      if (b.dataset.replay === "line") replay(".ds-pen-line, .ds-pen-marker", drawPenLine);
      else replay(".mo-sticker", drawPenBrush);
    });
    return el;
  },
};
