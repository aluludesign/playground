// 許願卡、喜歡貼紙、許願牆：Figma「card/wishes」（161934:9759）、「likes」（162182:14172）、「sticker」（162182:17965）、「wishes board」（162182:13188）
import { wishCardHTML, wishBoardHTML, likesHTML, heartStickerHTML, wireWishCards } from "../components/wish-card.js";
import photo from "../images/sample-attraction.jpg";
import avatar from "../images/sample-avatar.jpg";

const USAGE = `import { wishBoardHTML, wireWishCards } from "./components/wish-card.js";

el.innerHTML = wishBoardHTML({ cards: [
  { key: "w1", title: "淺草寺", meta: ["日本，東京都", "景點"], photos: [url],
    wisher: { name: "小明", src: "", color: "#E60012" }, note: "我想去吃那個烤布蕾",
    likes: { count: 3, hearts: 3, givers: [{ name: "佳瑜" }], mine: false } },
] });
wireWishCards(el);
el.addEventListener("ds-wish-open", (e) => e.detail.key);  // 點卡片 → 許願卡細節
el.addEventListener("ds-like", (e) => e.detail.key);       // +1
el.addEventListener("ds-photos-open", (e) => e.detail.key);`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const G = [{ name: "佳瑜", src: avatar }, { name: "志偉", color: "#009944" }, { name: "雅倫", color: "#00A7DB" }];
const WIKI = "類別：宗教場所、佛教、觀光景點　營業時間：Mo-Su 06:00-17:00";
const C = (i, extra) => ({ key: "w" + i, title: ["淺草寺", "東京晴空塔", "築地場外市場", "上野動物園", "明治神宮"][i % 5], meta: ["日本，東京都", "景點"], photos: [photo, photo, photo].slice(0, (i % 3) + 1), color: [14, 1, 5, 8, 11][i % 5], ...extra });
const CARDS = [
  C(0, { wisher: { name: "美咲", src: avatar }, note: "我想去吃那個 YT 有介紹的烤布蕾，聽說現在只要", likes: { count: 0, hearts: 0 } }),
  C(1, { likes: { count: 3, hearts: 3, givers: G } }),
  C(2, { wiki: WIKI, wisher: { name: "小明", color: "#E60012" }, note: "一定要去", likes: { count: 2, hearts: 2, givers: G.slice(0, 2) } }),
  C(3, { likes: { count: 1, hearts: 1, givers: G.slice(0, 1) } }),
  C(4, { wiki: WIKI, likes: { count: 3, hearts: 3, givers: G } }),
  C(5, { likes: { count: 0, hearts: 0 } }),
];

export default { title: "Components/許願卡 Wish card" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>許願卡 Wish card</h1>
<p class="lead">許願牆上的卡：名稱（最長一行）、地區‧類別、照片組（點了開照片預覽）、喜歡（愛心貼紙＋人數＋誰按了）、維基摘要（最多 2 行）、許願人和留言（最多 1 行）。牆比畫面寬，整面牆一起左右滑。</p>

<section class="tk"><h2>愛心貼紙 sticker</h2>
<table><thead><tr><th>status</th><th>預覽</th><th>說明</th></tr></thead><tbody>
<tr><td class="nm">emtpy</td><td style="padding:12px">${heartStickerHTML({ hearts: 0 })}</td><td class="al">還沒有人按：空心 duotone</td></tr>
<tr><td class="nm">over 10%</td><td style="padding:12px">${heartStickerHTML({ hearts: 1 })}</td><td class="al">1 顆</td></tr>
<tr><td class="nm">over 40%</td><td style="padding:12px">${heartStickerHTML({ hearts: 2 })}</td><td class="al">2 顆</td></tr>
<tr><td class="nm">over 60%</td><td style="padding:12px">${heartStickerHTML({ hearts: 3 })}</td><td class="al">3 顆</td></tr>
<tr><td class="nm">從 0 變 1</td><td style="padding:12px" id="anim">${heartStickerHTML({ hearts: 1, animate: true })}</td><td class="al">筆刷上色畫出來（Figma 註解）；<button type="button" id="again">再畫一次</button></td></tr>
</tbody></table></section>

<section class="tk"><h2>喜歡 likes</h2><div style="display:flex;gap:24px">${likesHTML({ count: 3, hearts: 3, givers: G })}${likesHTML({ count: 0, hearts: 0 })}</div></section>

<section class="tk"><h2>許願牆（390 寬）</h2>
<div style="width:390px;border:1px dashed #ccc;background:#e8eadf" id="wb">${wishBoardHTML({ cards: CARDS })}</div>
<p class="note" id="wb-now">左右滑整面牆；點卡片、照片、愛心試試</p></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">卡片</td><td>250 寬、<code class="var">--ds-sys-color-surface</code>＋bg pattern、<code class="var">--ds-elevation-surface-medium</code>、<code class="var">--ds-sys-radius-sm</code>、內距 <code class="var">--ds-sys-spacing-2xl</code></td></tr>
<tr><td class="al">名稱</td><td>Body/lg/hand-regular＋螢光筆（custom N，捲進畫面才畫）</td></tr>
<tr><td class="al">許願人／留言</td><td><code class="var">--ds-sys-color-opacity-opacity-primary-50</code>、label/lg/hand-regular、頭像 md</td></tr>
<tr><td class="al">喜歡</td><td>heart sticker 40、「+」label/md/semi-bold、人數 Body/lg/regular、頭像 sm 疊 -6</td></tr>
<tr><td class="al">牆</td><td>欄距、卡距 <code class="var">--ds-sys-spacing-2xl</code>、內距 <code class="var">--ds-sys-spacing-4xl</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre><code>${esc(USAGE)}</code></pre></section>`;
    requestAnimationFrame(() => {
      wireWishCards(el);
      const now = (t) => (el.querySelector("#wb-now").textContent = t);
      el.addEventListener("ds-wish-open", (e) => now("開許願卡：" + e.detail.key));
      el.addEventListener("ds-like", (e) => now("+1：" + e.detail.key));
      el.addEventListener("ds-photos-open", (e) => now("看照片：" + e.detail.key));
      el.querySelector("#again").addEventListener("click", () => { el.querySelector("#anim").innerHTML = heartStickerHTML({ hearts: 1, animate: true }); wireWishCards(el.querySelector("#anim")); });
    });
    return el;
  },
};
