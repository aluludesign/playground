import names from "../icons/weather/names.json";
import { zip } from "../zip.js";
import "../icons.css";

// 天氣 icon：每種 × 2 版（default 純線條、color 彩色貼紙）
// 來源：design-system/trippps_weather_icons_20261109（svg/ 與 reference_originals/ 的 sun、drop）
const raw = import.meta.glob("../icons/weather/*.svg", { query: "?raw", import: "default", eager: true });
const svgOf = (type, v) => raw[`../icons/weather/weather_${type}_${v}.svg`];
const file = (type, v) => `weather_${type}_${v}.svg`;
const VARIANTS = [
  { key: "default", label: "default（線條）" },
  { key: "color", label: "color（彩色）" },
];
// 照 SVG 自己的寬高（16 為一個單位）縮放，畫布大一點的 color 版線條才會跟 default 一樣粗
const dims = (svg) => {
  const m = svg.match(/<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/);
  return m ? [+m[1], +m[2]] : [16, 16];
};
const SIZES = [16, 24, 32, 48];
const BGS = [
  { key: "white", label: "白底", css: "#ffffff" },
  { key: "surface", label: "surface", css: "var(--ds-sys-color-surface)" },
  { key: "dim", label: "深底", css: "var(--ds-sys-color-surf-container-high)" },
];

const urlCache = new Map();
const urlOf = (name, svg) => {
  if (!urlCache.has(name)) urlCache.set(name, URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })));
  return urlCache.get(name);
};

function download(name, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1000);
}

function render() {
  const state = { size: 32, bg: "surface" };
  const el = document.createElement("div");
  el.className = "tk-page ic-page";

  const draw = () => {
    const bg = BGS.find((b) => b.key === state.bg).css;
    const px = (u) => Math.round((state.size * u) / 16);
    const N = names.length;
    el.innerHTML = `
<h1>天氣 icon</h1>
<p class="lead">${N} 種天氣 × 2 種版本，共 ${N * 2} 個 SVG。點 icon 下方的 default ↓、color ↓ 可下載單一 SVG，或一次下載全部。<br>
default 是純線條；color 是彩色底加白色貼紙邊（畫布多出貼紙邊的寬度，線條位置和 default 對齊）。太陽、水滴是最早的兩張參考圖，其餘依它們的風格繪製。白色貼紙邊在白底上看不出來，建議放在有底色的地方。</p>
<div class="ic-bar">
  <div class="ic-seg" role="group" aria-label="大小">${SIZES.map((s) => `<button data-size="${s}" aria-pressed="${s === state.size}">${s}px</button>`).join("")}</div>
  <div class="ic-seg" role="group" aria-label="底色">${BGS.map((b) => `<button data-bg="${b.key}" aria-pressed="${b.key === state.bg}">${b.label}</button>`).join("")}</div>
  <span class="ic-grow"></span>
  <button class="ic-dl" data-all="default">下載全部 default（${N}）</button>
  <button class="ic-dl" data-all="color">下載全部 color（${N}）</button>
  <button class="ic-dl" data-all="both">下載全部（${N * 2}）</button>
</div>
<div class="ic-grid">${names
      .map(
        (n) => `<figure class="ic-card">
  <figcaption><b>${n.zh}</b><small>${n.en}</small></figcaption>
  <div class="ic-pair">${VARIANTS.map(
    (v) => `<div class="ic-cell">
    <div class="ic-stage" style="background:${bg}"><img src="${urlOf(file(n.type, v.key), svgOf(n.type, v.key))}" width="${px(dims(svgOf(n.type, v.key))[0])}" height="${px(dims(svgOf(n.type, v.key))[1])}" alt="${n.zh} ${v.key}"></div>
    <button class="ic-file" data-type="${n.type}" data-v="${v.key}" title="下載 ${file(n.type, v.key)}">${v.key} ↓</button>
  </div>`,
  ).join("")}</div>
  <code>weather_${n.type}</code>
</figure>`,
      )
      .join("")}</div>`;
  };

  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.size) (state.size = +b.dataset.size), draw();
    else if (b.dataset.bg) (state.bg = b.dataset.bg), draw();
    else if (b.dataset.type) {
      const { type, v } = b.dataset;
      download(file(type, v), new Blob([svgOf(type, v)], { type: "image/svg+xml" }));
    } else if (b.dataset.all) {
      const vs = b.dataset.all === "both" ? ["default", "color"] : [b.dataset.all];
      const files = [];
      for (const v of vs) for (const n of names) files.push({ name: (vs.length > 1 ? v + "/" : "") + file(n.type, v), text: svgOf(n.type, v) });
      download(`trippps_weather_icons_${b.dataset.all}.zip`, zip(files));
    }
  });

  draw();
  return el;
}

export default { title: "Icons/天氣" };
export const 全部 = { render };
