// 照片預覽：Figma 161747:16541
import { photoPreviewHTML, wirePhotoPreview } from "../components/photo-preview.js";
import photo from "../images/sample-attraction.jpg";

const USAGE = `import { photoPreviewHTML, wirePhotoPreview } from "./components/photo-preview.js";

box.innerHTML = photoPreviewHTML({
  photos: [{ src: url1 }, { src: url2, thumb: small2 }], at: 0,
  title: "淺草寺", credit: "照片:維基共享資源", creditURL: "https://commons.wikimedia.org/…",
});
wirePhotoPreview(box, { count: 2 });
box.addEventListener("ds-photo-at", (e) => e.detail.index);   // 換張（重畫一次）
box.addEventListener("ds-photo-close", () => {});`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const PH = [{ src: photo }, { src: photo }, { src: photo }];

export default { title: "Components/照片預覽 Photo preview" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>照片預覽 Photo preview</h1>
<p class="lead">點景點照片組、景點卡的照片打開。整頁蓋在畫面上、後面糊掉：大圖、名稱、縮圖列（左右箭頭換張）、出處（點了開出處頁）、✕ 關掉。</p>
<section class="tk"><h2>樣子（390×844，後面是地圖）</h2>
<div id="pp" style="position:relative;width:390px;height:844px;overflow:hidden;border-radius:12px;transform:translateZ(0);background:linear-gradient(160deg,#dfe7d6,#c5d4bb 50%,#ebe5d6)"></div>
<p class="note" id="pp-now">點縮圖、箭頭試試</p></section>
<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">大圖</td><td>358×358、<code class="var">--ds-sys-radius-3xl</code></td></tr>
<tr><td class="al">名稱</td><td>Headline/xs/semi-bold、<code class="var">--ds-sys-color-text-inverse-100</code></td></tr>
<tr><td class="al">縮圖</td><td>40×40、<code class="var">--ds-sys-radius-sm</code>；選到的框 <code class="var">--ds-sys-color-primary</code>・<code class="var">--ds-sys-border-md</code></td></tr>
<tr><td class="al">箭頭</td><td><code class="var">--ds-comp-btn-normal-sm-radius</code>、icon <code class="var">--ds-comp-btn-normal-sm-icon</code></td></tr>
<tr><td class="al">間距</td><td><code class="var">--ds-sys-spacing-2xl</code>；出處上 <code class="var">--ds-sys-spacing-5xl</code>、跟 ✕ 之間 <code class="var">--ds-sys-spacing-4xl</code></td></tr>
<tr><td class="al">關閉</td><td>Button Primary・Icon Filled・sm</td></tr>
</tbody></table></section>
<section class="tk"><h2>用法</h2><pre><code>${esc(USAGE)}</code></pre></section>`;
    const paint = (at) => {
      const box = el.querySelector("#pp");
      box.innerHTML = photoPreviewHTML({ photos: PH, at, title: "淺草寺", credit: "照片:維基共享資源", creditURL: "https://commons.wikimedia.org/" });
      box.querySelector(".ds-photo").style.position = "absolute";
      wirePhotoPreview(box, { count: PH.length });
    };
    requestAnimationFrame(() => {
      paint(0);
      el.addEventListener("ds-photo-at", (e) => { paint(e.detail.index); el.querySelector("#pp-now").textContent = "第 " + (e.detail.index + 1) + " 張"; });
      el.addEventListener("ds-photo-close", () => (el.querySelector("#pp-now").textContent = "按了 ✕"));
    });
    return el;
  },
};
