// 當日細節卡片：Figma「attraction card」（162182:18508）
import { attractionCardHTML, wireAttractionCard } from "../components/attraction-card.js";
import photo from "../images/sample-attraction.jpg";

const USAGE = `import { attractionCardHTML, wireAttractionCard } from "./components/attraction-card.js";

el.innerHTML = attractionCardHTML({
  photos: [url1, url2],                  // 最多 6 張（含團員上傳的）
  title: "淺草寺", meta: ["日本，東京都", "景點"],
  mapURL: "https://www.google.com/maps/search/?api=1&query=…", // 點地點那一行開 Google 地圖
  info: [{ label: "類別", value: "宗教場所" }, { label: "網站", value: "https://senso-ji.jp" }],
  wisher: "健太三郎", note: "…",          // 有人許願有留言才給
});
wireAttractionCard(el);
el.addEventListener("ds-card-close", () => {});
el.addEventListener("ds-card-photo", (e) => e.detail.index);`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const INFO = [
  { label: "類別", value: "宗教場所、佛教、觀光景點" },
  { label: "營業時間", value: "Mo-Su 06:00-17:00" },
  { label: "門票", value: "不用（fee: no）" },
  { label: "輪椅", value: "可以" },
  { label: "電話", value: "+81-3-3842-0181" },
  { label: "網站", value: "https://senso-ji.jp" },
  { label: "資料來源", value: "OpenStreetMap" },
];
const NOTE = "有許願備注的時候，這邊就顯示許願備注。有許願備注的時候，這邊就顯示許願備注。";

export default { title: "Components/景點卡 Attraction card" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>景點卡 Attraction card</h1>
<p class="lead">當日細節下面那張卡：照片可以左右滑（最多 6 張，含團員上傳的）、名稱、地點（點了開 Google 地圖）、地點資料（連結一律底線＋primary）、有人許願有留言才出現的許願區。右上角 ✕ 關掉。</p>

<section class="tk"><h2>樣子（358 寬）</h2>
<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">
<div style="width:358px">${attractionCardHTML({ photos: [photo, photo, photo], mapURL: "https://www.google.com/maps", info: INFO, wisher: "健太三郎", note: NOTE })}</div>
<div style="width:358px">${attractionCardHTML({ photos: [], title: "合羽橋道具街", meta: ["日本，東京都", "商店街"], info: [{ label: "類別", value: "商店街" }] })}</div>
</div>
<p class="note" id="ac-now">滑照片、點 ✕ 或照片試試</p></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">底</td><td><code class="var">--ds-sys-color-surface</code>＋bg pattern、<code class="var">--ds-sys-radius-sm</code></td></tr>
<tr><td class="al">照片圓點</td><td>active <code class="var">--ds-sys-color-primary</code>、其他 <code class="var">--ds-sys-color-surf-container-low</code></td></tr>
<tr><td class="al">標題</td><td>Headline/xs/semi-bold＋標題螢光筆</td></tr>
<tr><td class="al">地點／資料</td><td>label/sm、label/md、<code class="var">--ds-sys-color-text-200</code>；連結 <code class="var">--ds-sys-color-primary</code>＋底線</td></tr>
<tr><td class="al">許願</td><td><code class="var">--ds-sys-color-opacity-opacity-primary-50</code>、label/lg/hand-regular、底下抖動線 outline 200</td></tr>
<tr><td class="al">內距／間距</td><td><code class="var">--ds-sys-spacing-2xl</code>／<code class="var">--ds-sys-spacing-4xl</code>；區塊 <code class="var">--ds-sys-spacing-5xl</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre><code>${esc(USAGE)}</code></pre></section>`;
    requestAnimationFrame(() => {
      wireAttractionCard(el);
      el.addEventListener("ds-card-close", () => (el.querySelector("#ac-now").textContent = "按了 ✕"));
      el.addEventListener("ds-card-photo", (e) => (el.querySelector("#ac-now").textContent = "看第 " + (e.detail.index + 1) + " 張"));
    });
    return el;
  },
};
