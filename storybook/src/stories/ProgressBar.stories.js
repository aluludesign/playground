// 長條圖：Figma「progress bar」「progress item」（162714:50264）
import { progressBarHTML, progressItemHTML } from "../components/progress-bar.js";

const USAGE = `import { progressBarHTML } from "./components/progress-bar.js";

el.innerHTML = progressBarHTML({
  label: "分類佔比",
  items: [
    { value: 61100, color: "custom 8", label: "交通" },
    { value: 1218, color: "custom 1", label: "餐飲" },
  ],
});`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const COLORS = ["primary", "secondary", "tertiary", "disable", ...Array.from({ length: 14 }, (_, i) => "custom " + (i + 1))];

export default { title: "Components/長條圖 Progress bar" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>長條圖 Progress bar</h1>
<p class="lead">一段一段的紙膠帶接起來，寬度照數值的比例分。用在花費頁的分類佔比。</p>

<section class="tk"><h2>progress bar</h2>
<p class="note">Figma 的範例：五段，寬 310。</p>
<div class="pb-cell">${progressBarHTML({ label: "範例", items: [
      { value: 62, color: "custom 7" }, { value: 88, color: "custom 8" }, { value: 79, color: "custom 1" },
      { value: 58, color: "custom 4" }, { value: 23, color: "custom 14" }] })}</div></section>

<section class="tk"><h2>progress item：color</h2>
<p class="note">左邊撕開的毛邊 4、右邊毛邊 5 加一小塊陰影（<code class="var">--ds-sys-color-opacity-opacity-primary-150</code>），整段不透明度 .88、高 17。</p>
<table><thead><tr><th>color</th><th>預覽</th><th>token</th></tr></thead><tbody>
${COLORS.map((c) => `<tr><td class="nm">${c}</td><td class="pb-one"><div class="ds-progress">${progressItemHTML({ color: c })}</div></td><td><code class="var">${c.startsWith("custom") ? "--ds-sys-color-customs-custom-" + c.slice(7) : c === "disable" ? "--ds-sys-color-disabled" : "--ds-sys-color-" + c}</code></td></tr>`).join("")}
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre class="wg-code"><code>${esc(USAGE)}</code></pre></section>
<style>
.pb-cell { width: 310px; padding: 14px 16px; }
.pb-one { width: 88px; padding: 10px 16px; }
.pb-one .ds-progress { width: 88px; }
.wg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    return el;
  },
};
