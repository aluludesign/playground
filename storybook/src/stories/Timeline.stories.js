// 時間軸：Figma「timeline set」（162075:11123）、「schedule/detail」（162075:10954）、「attraction photos」（162093:14097）
import { timelineHTML, scheduleDetailHTML, attractionPhotosHTML, wireTimeline } from "../components/timeline.js";
import photo from "../images/sample-attraction.jpg";

const USAGE = `import { timelineHTML, wireTimeline } from "./components/timeline.js";

el.innerHTML = timelineHTML({ items: [
  { key: "s1", n: 1, time: "08:00", color: 14, title: "淺草寺", meta: ["日本，東京都", "景點"],
    wiki: "類別：宗教場所…", note: "千本鳥居清早去人超少", photos: [url1, url2, url3] },
  …
] });
wireTimeline(el);
el.addEventListener("ds-stop-open", (e) => e.detail.key);    // 點小卡 → 當日細節
el.addEventListener("ds-photos-open", (e) => e.detail.key);  // 點照片 → 照片預覽`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const WIKI = "類別：宗教場所、佛教、觀光景點　營業時間：Mo-Su 06:00-17:00　門票：不用";
const ITEMS = [
  { key: "s1", n: 1, time: "08:00", color: 14, title: "淺草寺", meta: ["日本，東京都", "景點"], wiki: WIKI, photos: [photo, photo, photo] },
  { key: "s2", n: 2, time: "11:30", color: 14, title: "東京晴空塔", meta: ["日本，東京都", "景點"], note: "千本鳥居清早去人超少，景色絕美！", photos: [photo, photo] },
  { key: "s3", n: 3, time: "14:00", color: 14, title: "築地市場吃海鮮", meta: ["日本，東京都", "餐廳"], wiki: WIKI, photos: [photo] },
  { key: "s4", n: 4, time: "18:00", color: 14, title: "東京鐵塔", meta: ["日本，東京都", "景點"] },
];

export default { title: "Components/時間軸 Timeline" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>時間軸 Timeline</h1>
<p class="lead">行程面板裡那一天的行程：中間一條點點線，每個點有編號和時間（編號＝地圖上的號碼）；照片組和行程小卡左右交替。點小卡開當日細節，點照片組開照片預覽。</p>

<section class="tk"><h2>整條（390 寬）</h2>
<div style="width:342px;padding:0 24px;border:1px dashed #ccc" id="tl-demo">${timelineHTML({ items: ITEMS })}</div>
<p class="note" id="tl-now">點小卡或照片試試</p></section>

<section class="tk"><h2>零件</h2>
<table><thead><tr><th></th><th>預覽</th><th>說明</th></tr></thead><tbody>
<tr><td class="nm">小卡 left</td><td style="width:200px">${scheduleDetailHTML({ wiki: WIKI, note: "千本鳥居清早去人超少，景色絕美！" })}</td><td class="al">卡在時間軸右邊；泡泡尖角貼齊上緣、在右邊外面（Figma alignment=left）</td></tr>
<tr><td class="nm">小卡 right</td><td style="width:200px">${scheduleDetailHTML({ align: "right", note: "想吃那家烤布蕾" })}</td><td class="al">卡在時間軸左邊，靠右對齊；尖角貼齊上緣、在左邊外面</td></tr>
<tr><td class="nm">照片 variants</td><td style="padding:16px;display:flex;flex-wrap:wrap;gap:16px" id="photo-variants">${[1, 2, 6, 5, 4, 3].map((v) => `<span data-v="${v}">${attractionPhotosHTML({ photos: [photo, photo, photo].slice(0, v <= 2 ? 3 : v >= 5 ? 2 : 1), variant: v })}</span>`).join("")}</td><td class="al">Figma variants 1、2（3 張）／6、5（2 張）／4、3（1 張）；照片有多種樣式，隨機變化（同一個 key 每次都一樣）；最多疊 3 張，第一張在最上面；沒有照片就空著</td></tr>
<tr><td class="nm">沒有行程</td><td style="width:342px">${timelineHTML({ items: [] })}</td><td class="al">那天還沒排東西</td></tr>
</tbody></table></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">名稱</td><td>Body/lg/hand-regular（<code class="var">--ds-sys-font-family-zhtw-handwriting-zhtw</code>・<code class="var">--ds-sys-font-size-body-lg</code>）＋螢光筆（固定 custom 5，不跟那天的顏色）</td></tr>
<tr><td class="al">地區‧類別</td><td>label/sm、<code class="var">--ds-sys-color-text-200</code></td></tr>
<tr><td class="al">維基摘要</td><td>label/md/regular、<code class="var">--ds-sys-color-text-200</code>、最多 2 行</td></tr>
<tr><td class="al">留言泡泡</td><td><code class="var">--ds-sys-color-opacity-opacity-primary-50</code>、label/lg/hand-regular、尖角（8×5、貼齊泡泡上緣、朝時間軸）同泡泡底色、底下抖動線 outline 200</td></tr>
<tr><td class="al">照片</td><td>90×90、<code class="var">--ds-sys-radius-sm</code>、框 <code class="var">--ds-sys-color-outline-50</code>、Elevation/component/sm 加在整組上（filter drop-shadow，用 <code class="var">--ds-sys-blur-2xs</code>・<code class="var">--ds-sys-shadow-md</code>）</td></tr>
<tr><td class="al">編號＋時間</td><td>pin_timeline w/time（見 Location pin）</td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre><code>${esc(USAGE)}</code></pre></section>`;
    requestAnimationFrame(() => {
      wireTimeline(el);
      el.addEventListener("ds-stop-open", (e) => (el.querySelector("#tl-now").textContent = "開當日細節：" + e.detail.key));
      el.addEventListener("ds-photos-open", (e) => (el.querySelector("#tl-now").textContent = "開照片預覽：" + e.detail.key));
    });
    return el;
  },
};
