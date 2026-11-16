import { irisButtonHTML, wireIris } from "../components/iris-button.js";

const SIZES = [
  { key: "lg", label: "lg" },
  { key: "default", label: "Default" },
  { key: "sm", label: "Small" },
];
const STATES = [
  { key: "", label: "Enabled" },
  { key: "hover", label: "Hovered" },
  { key: "focus", label: "Focused" },
  { key: "pressed", label: "Pressed" },
  { key: "disabled", label: "Disabled" },
];

const USAGE = `<button type="button" class="ds-iris-btn">            <!-- 尺寸：加 ds-iris-btn--sm 或 ds-iris-btn--lg -->
  <span class="ds-iris-btn__layer">
    <span class="ds-iris-btn__flash"></span>                <!-- 閃動白光 -->
    <svg class="ds-iris-btn__icon" viewBox="0 0 24 24">…</svg>
    <span class="ds-iris-btn__label">Make wishes</span>
  </span>
</button>`;

function page(...parts) {
  const el = document.createElement("div");
  el.className = "tk-page";
  el.innerHTML = parts.join("");
  wireIris(el);
  return el;
}

export default {
  title: "Components/AI 按鈕 Dynamic Iris",
};

export const 全部狀態 = {
  render: () =>
    page(
      `<h1>AI 按鈕（Dynamic Iris）</h1>
<p class="lead">許願用的 AI 按鈕。外框、尺寸、文字、陰影和各狀態照 Figma「Dynamic Iris」；內層的漸層與動態照 demo 的「⚡ 動態虹光 + 閃動白光」——<br>
虹光跟著滑鼠、捲動（手機上是傾斜）流動，白光每 3.2 秒滑過一次，點下去金屬會凹一下、亮一下。<br>
下面 Hovered／Focused／Pressed 是固定顯示的樣子；實際的按鈕直接移上去、按 Tab、按住就會看到。</p>
<section class="tk">
<table class="iris-matrix"><thead><tr><th></th>${STATES.map((s) => `<th>${s.label}</th>`).join("")}</tr></thead>
<tbody>${SIZES.map(
        (z) =>
          `<tr><th>${z.label}</th>${STATES.map(
            (s) =>
              `<td>${irisButtonHTML({ size: z.key, state: s.key && s.key !== "disabled" ? s.key : undefined, disabled: s.key === "disabled" })}</td>`,
          ).join("")}</tr>`,
      ).join("")}</tbody></table>
</section>
<section class="tk"><h2>實際操作</h2>
<p class="note">這一排是真的按鈕：移上去、按住、用 Tab 移到上面看看。</p>
<div class="iris-row">${SIZES.map((z) => irisButtonHTML({ size: z.key })).join("")}${irisButtonHTML({ disabled: true })}</div>
</section>
<section class="tk"><h2>只有 icon／只有文字</h2>
<div class="iris-row">${irisButtonHTML({ showText: false })}${irisButtonHTML({ leadingIcon: false })}${irisButtonHTML({ size: "sm", showText: false })}</div>
</section>
<section class="tk"><h2>用法</h2>
<p class="note">CSS 在 <code>src/components/iris-button.css</code>；虹光流動要載 <code>src/components/sheen.js</code> 的 <code>startSheen()</code>（沒載也能用，光會停在正中間）。</p>
<pre class="iris-code"><code>${USAGE.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</code></pre>
</section>
<style>
.iris-matrix { border-collapse: collapse; }
.iris-matrix th { font-size: 12px; color: #6b5f59; font-weight: 600; padding: 8px 12px; text-align: left; }
.iris-matrix td { padding: 18px 16px; vertical-align: middle; }
.iris-row { display: flex; flex-wrap: wrap; gap: 20px; align-items: center; padding: 12px 0; }
.iris-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`,
    ),
};

export const 試玩 = {
  args: { label: "Make wishes", size: "default", leadingIcon: true, showText: true, disabled: false },
  argTypes: {
    label: { name: "文字", control: "text" },
    size: { name: "尺寸", control: "inline-radio", options: ["sm", "default", "lg"] },
    leadingIcon: { name: "前方 icon", control: "boolean" },
    showText: { name: "顯示文字", control: "boolean" },
    disabled: { name: "停用", control: "boolean" },
  },
  parameters: { controls: { disable: false } },
  render: (args) => page(`<div class="iris-row" style="padding:40px">${irisButtonHTML(args)}</div><style>.iris-row{display:flex;gap:20px;align-items:center}</style>`),
};
