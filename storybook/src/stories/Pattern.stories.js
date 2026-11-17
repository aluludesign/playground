// 背景圖樣：Figma「bg-patterns」（node 162505:12797）
import "../pattern.css";

const P = [
  { k: "primary-soft", fig: "bg_style/primary-soft", desc: "淡橘底＋橘格" },
  { k: "tertiary", fig: "bg_style/tertiary", desc: "藍底＋藍粗格" },
  { k: "bright", fig: "bg_style/bright", desc: "白底＋橘格" },
  { k: "surface", fig: "bg_style/surface", desc: "米白底＋深棕格" },
  { k: "rainbow", fig: "bg_style/rainbow", desc: "彩虹漸層＋深棕格", bg: "白 ＋ Gradient/iris" },
  { k: "primary", fig: "bg_style/primary", desc: "橘底＋深棕格" },
];

const USAGE = `<!-- 卡片 -->
<div class="ds-pattern ds-pattern--primary-soft" style="border-radius: var(--ds-sys-radius-sm)">…</div>

<!-- 整個畫面 -->
<body class="ds-pattern ds-pattern--surface">…</body>`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const tok = (k, p) => `<code class="var">--ds-sys-pattern-${k}-${p}</code>`;

export default { title: "Style/背景圖樣" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>背景圖樣（pattern）</h1>
<p class="lead">卡片、畫面的底。每一種都是「底色＋一層格線」，底色、格線顏色、每格大小都是 token（<code>ds/sys/pattern/…</code>），格線透明度共用 <code>ds/sys/pattern/opacity</code>（= opacity/2xs，8%）。<br>
Figma 的 pattern 填色不能綁變數，所以 Figma 上格線透明度和格子大小要手動對；token 是兩邊對照的依據。</p>

<section class="tk"><h2>6 種</h2>
<div class="pt-grid">
${P.map((p) => `<figure><div class="pt-sw ds-pattern ds-pattern--${p.k}"></div><figcaption><b>${p.k}</b><br>${p.desc}</figcaption></figure>`).join("")}
</div></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>Figma</th><th>class</th><th>底色</th><th>格線</th><th>每格</th></tr></thead><tbody>
${P.map(
  (p) => `<tr><td class="nm">${p.fig}</td><td><code class="var">ds-pattern--${p.k}</code></td><td>${tok(p.k, "bg")}${p.bg ? `<br><span class="muted">${p.bg}</span>` : ""}</td><td>${tok(p.k, "line")}</td><td>${tok(p.k, "size")}</td></tr>`,
).join("")}
</tbody></table></section>

<section class="tk"><h2>用在卡片和畫面</h2>
<div class="pt-demo">
  <div class="pt-card ds-pattern ds-pattern--primary-soft"><b>北海道 8 日孝親之旅</b><span>2026/12/20 – 12/27</span></div>
  <div class="pt-card ds-pattern ds-pattern--tertiary"><b>京都 春季櫻花漫遊</b><span>2027/03/28 – 04/02</span></div>
  <div class="pt-card ds-pattern ds-pattern--rainbow"><b>東京 PA PA 造</b><span>2026/11/30 – 12/04</span></div>
  <div class="pt-screen ds-pattern ds-pattern--surface"><div class="pt-card ds-pattern ds-pattern--primary"><b style="color:var(--ds-sys-color-on-primary)">整個畫面用 surface</b><span style="color:var(--ds-sys-color-on-primary)">卡片用 primary</span></div></div>
</div></section>

<section class="tk"><h2>用法</h2>
<p class="note">格線畫在元素的 <code>::before</code>，排在內容後面；元素會變成 <code>position: relative</code>＋<code>isolation: isolate</code>。同一個元素的 <code>::before</code> 不要再拿去做別的事。圓角跟著元素自己的 <code>border-radius</code>。</p>
<pre class="wg-code"><code>${esc(USAGE)}</code></pre>
</section>
<style>
.pt-grid { display: flex; flex-wrap: wrap; gap: 24px; }
.pt-grid figure { margin: 0; text-align: center; font: 400 12px/1.5 var(--ds-sys-font-family-label); color: var(--ds-sys-color-text-100); }
.pt-sw { width: 74px; height: 74px; border-radius: var(--ds-sys-radius-sm); margin-bottom: 8px; }
.pt-demo { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
.pt-card { width: 220px; padding: var(--ds-sys-spacing-xl); border-radius: var(--ds-sys-radius-lg); display: flex; flex-direction: column; gap: 4px; font: 400 13px/1.5 var(--ds-sys-font-family-label); color: var(--ds-sys-color-text-100); }
.pt-card b { font-size: 15px; }
.pt-screen { width: 280px; height: 220px; padding: 24px; border-radius: var(--ds-sys-radius-xs); box-shadow: var(--ds-elevation-surface-soft); }
.wg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    return el;
  },
};
