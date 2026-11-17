import { buttonHTML } from "../components/button.js";

const COLORS = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "tertiary", label: "Tertiary" },
  { key: "error", label: "Error" },
  { key: "white", label: "White" },
];
// 列的順序照 Figma
const ROWS = [
  ["filled", "default", "Filled"],
  ["filled", "sm", "Filled／Small"],
  ["outlined", "default", "Outlined"],
  ["outlined", "sm", "Outlined／Small"],
  ["text", "default", "Text"],
  ["text", "sm", "Text／Small"],
  ["icon", "default", "Icon Filled"],
  ["icon", "sm", "Icon Filled／Small"],
  ["icon-outlined", "default", "Icon Outlined"],
  ["icon-outlined", "sm", "Icon Outlined／Small"],
  ["filled", "xs", "Filled／xs"],
  ["outlined", "xs", "Outlined／xs"],
  ["text", "xs", "Text／xs"],
  ["icon", "xs", "Icon Filled／xs"],
  ["icon-outlined", "xs", "Icon Outlined／xs"],
];
const STATES = [
  { key: "", label: "Enabled" },
  { key: "hover", label: "Hovered" },
  { key: "focus", label: "Focused" },
  { key: "pressed", label: "Pressed" },
  { key: "disabled", label: "Disabled" },
];

const USAGE = `<!-- 顏色 ds-btn--secondary／--tertiary／--error／--white（不加 = Primary）
     樣式 ds-btn--outlined／--text／--icon／--icon-outlined（不加 = Filled）
     尺寸 ds-btn--sm／--xs（不加 = Default） -->
<button type="button" class="ds-btn ds-btn--outlined ds-btn--sm">
  <svg class="ds-btn__icon" viewBox="0 0 24 24">…</svg>   <!-- Leading icon -->
  <span class="ds-btn__label">記一筆</span>
</button>

<!-- 只有 icon 的按鈕要寫 aria-label -->
<button type="button" class="ds-btn ds-btn--icon" aria-label="記一筆">
  <svg class="ds-btn__icon" viewBox="0 0 24 24">…</svg>
</button>`;

const STYLE = `<style>
.btn-panel { background: #c8c8c8; border-radius: 12px; padding: 8px 12px; overflow-x: auto; }
.btn-matrix { border-collapse: collapse; }
.btn-matrix th { font-size: 12px; color: #4a403b; font-weight: 600; padding: 8px 12px; text-align: left; white-space: nowrap; }
.btn-matrix td { padding: 10px 14px; vertical-align: middle; }
.btn-row { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; padding: 12px 0; }
.btn-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;

function page(html) {
  const el = document.createElement("div");
  el.className = "tk-page";
  el.innerHTML = html + STYLE;
  return el;
}

function matrix(color) {
  return `<div class="btn-panel"><table class="btn-matrix"><thead><tr><th></th>${STATES.map((s) => `<th>${s.label}</th>`).join("")}</tr></thead>
<tbody>${ROWS.map(
    ([variant, size, label]) =>
      `<tr><th>${label}</th>${STATES.map(
        (s) =>
          `<td>${buttonHTML({
            color,
            variant,
            size,
            state: s.key && s.key !== "disabled" ? s.key : undefined,
            disabled: s.key === "disabled",
          })}</td>`,
      ).join("")}</tr>`,
  ).join("")}</tbody></table></div>`;
}

export default {
  title: "Components/按鈕 Button",
};

export const 全部狀態 = {
  render: () =>
    page(`<h1>按鈕 Button</h1>
<p class="lead">一般按鈕。全部照 Figma「Button」：5 種顏色 × 5 種樣式 × 3 種尺寸 × 5 種狀態。<br>
Hovered／Focused／Pressed 蓋一層同色（8%／10%／10%），Filled 類 Hovered 另外加 Elevation/text/xs 陰影；Focused 外面多一圈 focus ring。<br>
下面 Hovered／Focused／Pressed 是固定顯示的樣子；底下「實際操作」那排是真的按鈕，可以移上去、按住、用 Tab 移到上面看看。灰底是為了看得到 White。</p>
${COLORS.map((c) => `<section class="tk"><h2>${c.label}</h2>${matrix(c.key)}</section>`).join("")}
<section class="tk"><h2>實際操作</h2>
<div class="btn-panel">${COLORS.map(
      (c) =>
        `<div class="btn-row">${["filled", "outlined", "text", "icon", "icon-outlined"].map((v) => buttonHTML({ color: c.key, variant: v })).join("")}</div>`,
    ).join("")}</div>
</section>
<section class="tk"><h2>Leading／Trailing icon</h2>
<div class="btn-row">${buttonHTML({})}${buttonHTML({ leadingIcon: false })}${buttonHTML({ leadingIcon: false, trailingIcon: true })}${buttonHTML({ trailingIcon: true })}</div>
</section>
<section class="tk"><h2>用法</h2>
<p class="note">CSS 在 <code>src/components/button.css</code>；也可以用 <code>src/components/button.js</code> 的 <code>buttonHTML()</code> 產生。</p>
<pre class="btn-code"><code>${USAGE.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch])}</code></pre>
</section>`),
};

export const 試玩 = {
  args: { label: "記一筆", color: "primary", variant: "filled", size: "default", leadingIcon: true, trailingIcon: false, disabled: false },
  argTypes: {
    label: { name: "文字", control: "text" },
    color: { name: "顏色", control: "inline-radio", options: COLORS.map((c) => c.key) },
    variant: { name: "樣式", control: "inline-radio", options: ["filled", "outlined", "text", "icon", "icon-outlined"] },
    size: { name: "尺寸", control: "inline-radio", options: ["default", "sm", "xs"] },
    leadingIcon: { name: "前方 icon", control: "boolean" },
    trailingIcon: { name: "後方 icon", control: "boolean" },
    disabled: { name: "停用", control: "boolean" },
  },
  parameters: { controls: { disable: false } },
  render: (args) => page(`<div class="btn-panel"><div class="btn-row" style="padding:40px">${buttonHTML(args)}</div></div>`),
};
