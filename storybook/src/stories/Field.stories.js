// 外框輸入框：Figma「input」section（162734:51591）的 Text field（162736:15206）、Text area（162736:15574）
import { fieldHTML, wireField } from "../components/field.js";

const USAGE = `import { fieldHTML, wireField } from "./components/field.js";

el.innerHTML = fieldHTML({
  multiline: false,          // true＝Text area（多行，高 120）
  label: "項目",             // Show title；給 "" 就不顯示
  placeholder: "例如：一蘭拉麵",
  value: "",
  supporting: "",            // Supporting text；給字才顯示
  leadingIcon: false,        // Leading icon（放大鏡；要換就傳 svg 字串）
  trailingIcon: false,       // Trailing icon（清除 ✕）
  error: false,
  disabled: false,
});
wireField(el); // 對焦、有字時換樣子（標題浮上去）、✕ 清除`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

const STATES = [
  ["Enabled", {}],
  ["Hovered", { state: "hover" }],
  ["Focused", { state: "focused" }],
  ["Disabled", { disabled: true }],
];

const grid = (multiline) => {
  const base = multiline
    ? { multiline, label: "備註", placeholder: "例如：記得帶現金", value: "想看繪馬，順便求一個御守。記得帶現金。" }
    : { multiline, label: "項目", placeholder: "例如：一蘭拉麵", value: "晴空塔門票" };
  const errText = multiline ? "最多 200 字" : "請輸入正確的金額";
  const rows = [
    ["Empty", false],
    ["Empty · Error", true],
    ["Filled", false],
    ["Filled · Error", true],
  ];
  return `<table class="fd-grid"><thead><tr><th></th>${STATES.map(([s]) => `<th>${s}</th>`).join("")}</tr></thead><tbody>
${rows
  .map(([name, err], i) => {
    const filled = i >= 2;
    return `<tr><td class="nm">${name}</td>${STATES.map(([s, o]) =>
      s === "Disabled" && err
        ? "<td></td>"
        : `<td class="fd-cell">${fieldHTML({ ...base, ...o, value: filled ? base.value : "", error: err, supporting: err ? errText : "" })}</td>`,
    ).join("")}</tr>`;
  })
  .join("")}
</tbody></table>`;
};

export default { title: "Components/外框輸入框 Field" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>外框輸入框 Field</h1>
<p class="lead">團主視角用的輸入框（Material 3 outlined）：淺色底、圓角外框。空的時候標題躺在框裡；點進去或有字時，標題浮到框線上，框變成主色的粗線。有單行（Text field）和多行（Text area）兩種。</p>

<section class="tk"><h2>試試看</h2>
<p class="note">點進去打字、按 ✕ 清除。</p>
<div class="fd-try">
${fieldHTML({ label: "項目", placeholder: "例如：一蘭拉麵" })}
${fieldHTML({ label: "地點", placeholder: "搜尋地點", leadingIcon: true, trailingIcon: true, supporting: "輔助說明" })}
${fieldHTML({ multiline: true, label: "備註", placeholder: "例如：記得帶現金" })}
</div></section>

<section class="tk"><h2>Text field（單行）</h2>
<p class="note">最小高 56。Hovered 框線變深（text 100）；Focused 主色、3px；Error 紅色，右邊換成錯誤 icon、說明文字也變紅；Disabled 灰色。</p>
${grid(false)}</section>

<section class="tk"><h2>Text area（多行）</h2>
<p class="note">高 120，文字靠上、自動換行，超過就在框裡捲動。其他跟單行一樣。</p>
${grid(true)}</section>

<section class="tk"><h2>選配</h2>
<table><tbody>
<tr><td class="nm">Leading icon</td><td class="fd-cell">${fieldHTML({ label: "地點", leadingIcon: true })}</td></tr>
<tr><td class="nm">Trailing icon</td><td class="fd-cell">${fieldHTML({ label: "項目", value: "晴空塔門票", trailingIcon: true })}</td></tr>
<tr><td class="nm">Supporting text</td><td class="fd-cell">${fieldHTML({ label: "項目", supporting: "輔助說明" })}</td></tr>
<tr><td class="nm">沒有標題</td><td class="fd-cell">${fieldHTML({ label: "", placeholder: "例如：一蘭拉麵" })}</td></tr>
</tbody></table></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th><th>指到</th></tr></thead><tbody>
<tr><td class="al">圓角（16）</td><td><code class="var">--ds-comp-field-radius</code></td><td><code class="var">sys/radius/lg</code></td></tr>
<tr><td class="al">單行最小高（56）</td><td><code class="var">--ds-comp-field-height</code></td><td><code class="var">sys/height/2xl</code></td></tr>
<tr><td class="al">多行高（120）</td><td><code class="var">--ds-comp-field-area-height</code></td><td><code class="var">sys/height/3xl</code></td></tr>
<tr><td class="al">對焦框線（3）</td><td><code class="var">--ds-comp-field-focus-outline-width</code></td><td><code class="var">sys/border/lg</code></td></tr>
<tr><td class="al">icon（24）</td><td><code class="var">--ds-comp-field-icon</code></td><td><code class="var">sys/icon/md</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre class="fd-code"><code>${esc(USAGE)}</code></pre></section>
<style>
.fd-try { display: grid; gap: 20px; max-width: 320px; padding-top: 8px; }
.fd-grid td, .fd-grid th { vertical-align: top; }
.fd-cell { padding: 14px 12px; width: 240px; }
.fd-cell .ds-field { width: 240px; }
.fd-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    requestAnimationFrame(() => wireField(el));
    return el;
  },
};
