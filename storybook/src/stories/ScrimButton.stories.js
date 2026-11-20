// Scrim 圓鈕：Figma「Scrim」（162254:14112）
import { scrimButtonHTML } from "../components/scrim-button.js";

const USAGE = `import { scrimButtonHTML } from "./components/scrim-button.js";

el.innerHTML = scrimButtonHTML({
  icon: "calender",   // icons/general 的名字，用 outlined 那一組
  color: "scrim",     // scrim（黑底 80%）／primary
  size: "md",         // md 32／sm 24／xs 12
  label: "開關其他日子的行程",
  pressed: false,     // 有開關狀態才給
});`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const STATES = ["enabled", "hovered", "focused", "pressed", "disabled"];
const row = (color) =>
  ["md", "sm", "xs"]
    .map(
      (size) => `<tr><td class="nm">${color}／${size}</td>${STATES.map(
        (st) => `<td style="padding:16px">${scrimButtonHTML({ color, size, label: "開關其他日子的行程", state: st === "enabled" ? undefined : st, disabled: st === "disabled" })}</td>`,
      ).join("")}</tr>`,
    )
    .join("");

export default { title: "Components/Scrim 圓鈕" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>Scrim 圓鈕</h1>
<p class="lead">疊在地圖、照片上的小圓鈕，只有圖示。例：行程頁地圖右上角的日曆鈕（開關其他日子的行程）、景點照片右上角。</p>

<section class="tk"><h2>Color × Size × State</h2>
<table><thead><tr><th></th>${STATES.map((s) => `<th>${s}</th>`).join("")}</tr></thead><tbody>
${row("scrim")}${row("primary")}
</tbody></table>
<p class="note">滑鼠移上去、Tab 到它、按住，看得到真的 hover／focus／pressed。</p></section>

<section class="tk"><h2>疊在地圖上</h2>
<div style="position:relative;height:120px;border-radius:8px;background:linear-gradient(135deg,#d9e4d0,#b9cdb0 40%,#e8e2d2);">
<div style="position:absolute;top:16px;right:16px">${scrimButtonHTML({ label: "開關其他日子的行程", pressed: false })}</div>
<div style="position:absolute;top:16px;right:64px">${scrimButtonHTML({ color: "primary", label: "開關其他日子的行程", pressed: true })}</div>
</div></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">底色</td><td>scrim：<code class="var">--ds-sys-color-scrim</code>（整顆 80%）；primary：<code class="var">--ds-sys-color-primary</code></td></tr>
<tr><td class="al">圖示</td><td>scrim：<code class="var">--ds-sys-color-text-inverse-100</code>；primary：<code class="var">--ds-sys-color-on-primary</code></td></tr>
<tr><td class="al">圓角</td><td><code class="var">--ds-comp-chip-radius</code></td></tr>
<tr><td class="al">State layer</td><td><code class="var">--ds-sys-color-on-primary</code>，hover 8%、focus／pressed 10%</td></tr>
<tr><td class="al">陰影</td><td>平常 <code class="var">--ds-elevation-component-sm</code>，hover <code class="var">--ds-elevation-component-md</code></td></tr>
<tr><td class="al">Focus ring</td><td><code class="var">--ds-comp-focus-ring-color</code>・<code class="var">--ds-comp-focus-ring-border</code>，離外緣 2px</td></tr>
<tr><td class="al">Disabled</td><td>底 <code class="var">--ds-sys-color-disable-container</code>、圖示 <code class="var">--ds-sys-color-on-disable</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre><code>${esc(USAGE)}</code></pre></section>`;
    return el;
  },
};
