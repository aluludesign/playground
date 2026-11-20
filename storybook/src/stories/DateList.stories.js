// 日期列：Figma「date list」（162271:11054）
import { dateListHTML, dateCardHTML, wireDateList, centerDateList } from "../components/date-list.js";

const USAGE = `import { dateListHTML, wireDateList, centerDateList } from "./components/date-list.js";

el.innerHTML = dateListHTML({ cards: [
  { state: "status", title: "正在倒數", value: "38 天" },          // 倒數／回味中，放最前面
  { state: "past", key: "2026-10-05", day: "Day1", week: "MON", date: "10/05", color: 3 },
  { state: "active", key: "2026-10-06", day: "Day2", week: "TUE", date: "10/06", color: 14,
    weather: { icon: "sun", lo: 24, hi: 29, rain: 30 } },          // 查不到的日子不給 weather
] });
wireDateList(el);
centerDateList(el.querySelector(".ds-date-list"));               // 選到的那天捲到正中間
el.addEventListener("ds-date-select", (e) => e.detail.key);`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const WX = { icon: "sun", lo: 24, hi: 29, rain: 30 };
const DEMO = [
  { state: "status", title: "正在倒數", value: "38 天" },
  { state: "past", key: "d1", day: "Day1", week: "TUE", date: "10/06", color: 3 },
  { state: "active", key: "d2", day: "Day2", week: "WED", date: "10/07", color: 14, weather: WX },
  { key: "d3", day: "Day3", week: "THU", date: "10/08", color: 4, weather: { icon: "rain", lo: 18, hi: 22, rain: 80 } },
  { key: "d4", day: "Day4", week: "FRI", date: "10/09", color: 8, weather: { icon: "partly_cloudy_day", lo: 20, hi: 25, rain: 10 } },
  { key: "d5", day: "Day5", week: "SAT", date: "10/10", color: 10 },
];

export default { title: "Components/日期列 Date list" };

export const 全部 = {
  render: () => {
    const el = document.createElement("div");
    el.className = "tk-page";
    el.innerHTML = `<h1>日期列 Date list</h1>
<p class="lead">行程面板最上面那一排：每天一格，可以左右滑。點一格就選那天，選到的那格捲到正中間。最前面一格是倒數（開始前）或回味中（結束後）。天氣只在預報查得到的日子顯示。</p>

<section class="tk"><h2>state</h2>
<table><thead><tr><th>state</th><th>預覽</th><th>說明</th></tr></thead><tbody>
<tr><td class="nm">status</td><td style="padding:12px">${dateCardHTML({ state: "status" })} ${dateCardHTML({ state: "status", title: "回味中", value: "" })}</td><td class="al">Figma coming soon：倒數 N 天／回味中，放在最前面</td></tr>
<tr><td class="nm">past</td><td style="padding:12px">${dateCardHTML({ state: "past", color: 3 })}</td><td class="al">Figma pass by：過去的日子，沒有天氣、變淡</td></tr>
<tr><td class="nm">active</td><td style="padding:12px">${dateCardHTML({ state: "active", color: 14, weather: WX })}</td><td class="al">選到的那天：整格鋪那天的顏色</td></tr>
<tr><td class="nm">default</td><td style="padding:12px">${dateCardHTML({ color: 4, weather: WX })} ${dateCardHTML({ color: 4 })}</td><td class="al">一般；第二格是查不到天氣的日子</td></tr>
</tbody></table></section>

<section class="tk"><h2>整排（390 寬）</h2>
<div style="width:390px;border:1px dashed #ccc" id="dl-demo">${dateListHTML({ cards: DEMO })}</div>
<p class="note" id="dl-now">點一格試試</p></section>

<section class="tk"><h2>Token</h2>
<table><thead><tr><th>用在</th><th>token</th></tr></thead><tbody>
<tr><td class="al">框</td><td>抖動外框 <code class="var">--ds-sys-color-outline-300</code></td></tr>
<tr><td class="al">Day1 ‧ TUE</td><td>label/sm（<code class="var">--ds-sys-font-family-label</code>・<code class="var">--ds-sys-font-size-label-sm</code>）、上下 <code class="var">--ds-sys-spacing-md</code></td></tr>
<tr><td class="al">10/06</td><td>Body/md/semi-bold（<code class="var">--ds-sys-font-size-body-md</code>）＋螢光筆（那天的 <code class="var">--ds-sys-color-customs-custom-N</code>）</td></tr>
<tr><td class="al">天氣</td><td>label/sm/hand-regular（<code class="var">--ds-sys-font-family-zhtw-handwriting-zhtw</code>）、圖示 <code class="var">--ds-sys-icon-xs</code></td></tr>
<tr><td class="al">active 底色</td><td><code class="var">--ds-sys-color-customs-on-custom-N</code> × <code class="var">--ds-sys-opacity-md</code></td></tr>
<tr><td class="al">間距</td><td>格內 <code class="var">--ds-sys-spacing-xl</code>；整排左右 <code class="var">--ds-sys-spacing-md</code>、下 <code class="var">--ds-sys-spacing-4xl</code></td></tr>
</tbody></table></section>

<section class="tk"><h2>用法</h2><pre><code>${esc(USAGE)}</code></pre></section>`;
    requestAnimationFrame(() => {
      wireDateList(el);
      const demo = el.querySelector("#dl-demo");
      centerDateList(demo.querySelector(".ds-date-list"), false);
      demo.addEventListener("ds-date-select", (e) => {
        const list = demo.querySelector(".ds-date-list");
        list.querySelectorAll("button.ds-date").forEach((b) => {
          const on = b.dataset.key === e.detail.key;
          b.classList.toggle("ds-date--active", on);
          b.setAttribute("aria-pressed", String(on));
        });
        centerDateList(list);
        el.querySelector("#dl-now").textContent = "選到：" + e.detail.key;
      });
    });
    return el;
  },
};
