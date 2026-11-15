import { page, ALL } from "../render.js";

export default { title: "說明" };

const n = (c) => ALL.filter((t) => t.collection === c).length;

export const 關於這份文件 = () =>
  page(`<h1>Trippps Design System</h1>
<p class="lead">這裡放 Trippps 的設計變數和元件。變數來自 Figma，分三層：</p>
<section class="tk"><table><tbody>
<tr><td class="nm">Foundations</td><td>原始的值：色票、間距刻度、圓角刻度、字級…（${n("Foundations")} 個）。元件不直接用這一層。</td></tr>
<tr><td class="nm">Style</td><td>用途角色：primary、surface、spacing/md、radius/lg…，每個都指向一個 Foundations（${n("Style")} 個）。</td></tr>
<tr><td class="nm">Comps</td><td>元件專用：按鈕圓角、輸入框高度、chip 高度…，每個都指向一個 Style（${n("Comps")} 個）。</td></tr>
</tbody></table>
<p class="note">目前只收 <b>Retro</b> 模式。每張表的「指向」欄是 Figma 裡的綁定；預覽是用 CSS 變數一路串下去畫的，所以預覽對了就代表三層有接好。</p>
</section>`);
