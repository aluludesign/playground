// 地點標記：Figma shared comps「location pin」（162565:24486）
import { pinBadgeHTML, pinLabelHTML, pinHTML, pinSetHTML, pinTimelineHTML } from "../components/location-pin.js";

const USAGE = `import { pinBadgeHTML, pinLabelHTML, pinHTML, pinSetHTML, pinTimelineHTML } from "./components/location-pin.js";

pinBadgeHTML({ number: 1, color: 8, state: "default" }); // state: default | dot | not-on-map | focus
pinLabelHTML({ text: "淺草寺", focus: false });
pinHTML({ size: "sm", number: 1, color: 8 });           // size: sm | lg
pinSetHTML({ size: "lg", label: "淺草寺", number: 1 });   // 名字 + pin
pinTimelineHTML({ type: "time", time: "08:00", badge: { number: 1 } }); // type: empty | badge | time | text`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

export default { title: "Components/地點標記 Location pin" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>地點標記 Location pin</h1>
<p class="lead">地圖上、行程時間軸上標地點用的一組元件：塗鴉圓號碼（badge）、白色名字膠囊（label）、白色水滴（pin），以及把它們組起來的 pin set 和時間軸那一欄。</p>

<section class="tk"><h2>badge（pin/draw）</h2>
<table><thead><tr><th>Property 1</th><th>預覽</th><th>說明</th></tr></thead><tbody>
<tr><td class="nm">Default</td><td class="lp-cell">${pinBadgeHTML()}</td><td class="al">塗鴉底 <code class="var">custom N</code> × <code class="var">--ds-comp-pin-badge-opacity</code>（80%），號碼 label/md/semi-bold、文字陰影 Elevation/text/xs</td></tr>
<tr><td class="nm">dot</td><td class="lp-cell">${pinBadgeHTML({ state: "dot" })}</td><td class="al">primary 實心塗鴉，中間一顆 <code class="var">on primary</code> 小塗鴉，沒有號碼</td></tr>
<tr><td class="nm">not on map</td><td class="lp-cell">${pinBadgeHTML({ state: "not-on-map", number: 12 })}</td><td class="al">不在地圖上：塗鴉底換成 <code class="var">on disable</code></td></tr>
<tr><td class="nm">focuse</td><td class="lp-cell">${pinBadgeHTML({ state: "focus" })}</td><td class="al">外面一圈手繪圈（<code class="var">outline 300</code>、<code class="var">--ds-comp-pin-focus-ring-width</code>）</td></tr>
</tbody></table>
<p class="note">塗鴉底的顏色照 Figma 用 <code class="var">custom 8</code>；<code>color</code> 可以換成別的編號（對應 <code class="var">sys/color/customs/custom N</code>）。</p>
</section>

<section class="tk"><h2>label</h2>
<table><thead><tr><th>Property 1</th><th>預覽</th><th>說明</th></tr></thead><tbody>
<tr><td class="nm">defautl</td><td class="lp-cell">${pinLabelHTML()}</td><td class="al"><code class="var">surface bright</code>、radius full、Elevation/component/sm；label/sm/regular</td></tr>
<tr><td class="nm">focuse</td><td class="lp-cell">${pinLabelHTML({ focus: true })}</td><td class="al">字換成 label/sm/semi-bold</td></tr>
</tbody></table></section>

<section class="tk"><h2>pin（pin/focuse_s、pin/focuse_l）</h2>
<table><thead><tr><th>size</th><th>預覽</th><th>說明</th></tr></thead><tbody>
<tr><td class="nm">sm</td><td class="lp-cell">${pinHTML()}</td><td class="al">32×36 白色水滴，badge 28</td></tr>
<tr><td class="nm">lg</td><td class="lp-cell">${pinHTML({ size: "lg" })}</td><td class="al">56×68，badge 51、號碼 Body/lg/regular</td></tr>
</tbody></table></section>

<section class="tk"><h2>pin set</h2>
<table><thead><tr><th>Property 1</th><th>預覽</th><th>說明</th></tr></thead><tbody>
<tr><td class="nm">sm</td><td class="lp-cell">${pinSetHTML()}</td><td class="al">名字（一般字）在上、pin sm 在下，間距 <code class="var">--ds-sys-spacing-xs</code></td></tr>
<tr><td class="nm">lg</td><td class="lp-cell">${pinSetHTML({ size: "lg" })}</td><td class="al">名字（粗體）撐滿整組寬、pin lg</td></tr>
</tbody></table></section>

<section class="tk"><h2>pin_timeline</h2>
<table><thead><tr><th>Property 1</th><th>預覽</th><th>說明</th></tr></thead><tbody>
<tr><td class="nm">empty</td><td class="lp-cell">${pinTimelineHTML({ type: "empty" })}</td><td class="al">只有點點線（divider/dot）</td></tr>
<tr><td class="nm">badge</td><td class="lp-cell">${pinTimelineHTML({ type: "badge" })}</td><td class="al">badge，下面接點點線（dot line bottom），間距 <code class="var">--ds-comp-pin-timeline-gap</code></td></tr>
<tr><td class="nm">w/time</td><td class="lp-cell">${pinTimelineHTML({ type: "time" })}</td><td class="al">上下點點線（dot line top／bottom），中間 badge＋時間（label/sm/hand-regular）</td></tr>
<tr><td class="nm">text</td><td class="lp-cell">${pinTimelineHTML({ type: "text" })}</td><td class="al">只有一段手寫字，例如 Day end</td></tr>
</tbody></table>
<p class="note">badge style：badge 可以換成任何一種 badge（例如 <code>badge: { state: "dot" }</code>）。</p></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">塗鴉底透明度</td><td><code class="var">--ds-comp-pin-badge-opacity</code></td></tr>
<tr><td class="al">focus 手繪圈線寬</td><td><code class="var">--ds-comp-pin-focus-ring-width</code></td></tr>
<tr><td class="al">時間軸間距</td><td><code class="var">--ds-comp-pin-timeline-gap</code></td></tr>
<tr><td class="al">塗鴉底顏色</td><td><code class="var">--ds-sys-color-customs-custom-1</code>～<code class="var">-14</code>（× 80%）・dot <code class="var">--ds-sys-color-primary</code>・not on map <code class="var">--ds-sys-color-disabled</code>（不透明）</td></tr>
<tr><td class="al">白色水滴、名字膠囊</td><td><code class="var">--ds-sys-color-surface-bright</code>・<code class="var">--ds-elevation-component-sm</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre class="wg-code"><code>${esc(USAGE)}</code></pre></section>
<style>
.lp-cell { padding: 14px 16px; line-height: 0; }
.wg-code { background: #f6f2f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
</style>`;
    return el;
  },
};
