import { zip } from "./zip.js";
import "./icons.css";

// icon 展示頁共用：每個 icon 一張卡、各樣式並排、可切大小與底色、可下載單一 SVG 或整包 zip
//
// opts:
//   title, lead(HTML)        頁首
//   unit                     設計網格（weather 16、一般 icon 24）；「大小」= 一個網格顯示成幾 px
//   sizes                    大小選項
//   items: [{ key, title, sub }]
//   styles: [{ key, label }] 欄位順序；某個 icon 沒有這個樣式就略過
//   svg(itemKey, styleKey)   取 SVG 原始碼，沒有回傳 undefined
//   file(itemKey, styleKey)  下載檔名
//   zipName                  整包下載的檔名前綴

const BGS = [
  { key: "white", label: "白底", css: "#ffffff" },
  { key: "surface", label: "surface", css: "var(--ds-sys-color-surface)" },
  { key: "dim", label: "深底", css: "var(--ds-sys-color-surf-container-high)" },
];

const dims = (svg) => {
  const m = svg.match(/<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/) || svg.match(/<svg[^>]*\sheight="([\d.]+)"[^>]*\swidth="([\d.]+)"/);
  return m ? [+m[1], +m[2]] : null;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

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

export function iconPage(opts) {
  const { title, lead, unit, sizes, items, styles, svg, file, zipName } = opts;
  const state = { size: opts.defaultSize || sizes[1], bg: "surface" };
  const has = (i, s) => !!svg(i, s);
  const count = (s) => items.filter((it) => has(it.key, s)).length;
  const total = styles.reduce((n, s) => n + count(s.key), 0);

  const el = document.createElement("div");
  el.className = "tk-page ic-page";

  const draw = () => {
    const bg = BGS.find((b) => b.key === state.bg).css;
    // 照 SVG 自己的寬高縮放（一個網格 = 選的大小），畫布比較大的 sticker／color 版線條才會一樣粗
    const px = (n) => Math.round((state.size * n) / unit);
    const cols = Math.max(...items.map((it) => styles.filter((s) => has(it.key, s.key)).length));
    el.innerHTML = `
<h1>${esc(title)}</h1>
<p class="lead">${lead}</p>
<div class="ic-bar">
  <div class="ic-seg" role="group" aria-label="大小">${sizes.map((s) => `<button data-size="${s}" aria-pressed="${s === state.size}">${s}px</button>`).join("")}</div>
  <div class="ic-seg" role="group" aria-label="底色">${BGS.map((b) => `<button data-bg="${b.key}" aria-pressed="${b.key === state.bg}">${b.label}</button>`).join("")}</div>
  <span class="ic-grow"></span>
  ${styles
    .filter((s) => count(s.key))
    .map((s) => `<button class="ic-dl" data-all="${s.key}">下載全部 ${esc(s.key)}（${count(s.key)}）</button>`)
    .join("")}
  <button class="ic-dl" data-all="*">下載全部（${total}）</button>
</div>
<div class="ic-grid" style="--ic-cols:${cols}">${items
      .map(
        (it) => `<figure class="ic-card">
  <figcaption><b>${esc(it.title)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</figcaption>
  <div class="ic-pair">${styles
    .filter((s) => has(it.key, s.key))
    .map((s) => {
      const code = svg(it.key, s.key);
      const [w, h] = dims(code) || [unit, unit];
      return `<div class="ic-cell">
    <div class="ic-stage" style="background:${bg}"><img src="${urlOf(file(it.key, s.key), code)}" width="${px(w)}" height="${px(h)}" alt="${esc(it.title)} ${esc(s.key)}"></div>
    <button class="ic-file" data-item="${esc(it.key)}" data-style="${esc(s.key)}" title="下載 ${esc(file(it.key, s.key))}">${esc(s.label || s.key)} ↓</button>
  </div>`;
    })
    .join("")}</div>
  <code>${esc(it.code || it.key)}</code>
</figure>`,
      )
      .join("")}</div>`;
  };

  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.size) (state.size = +b.dataset.size), draw();
    else if (b.dataset.bg) (state.bg = b.dataset.bg), draw();
    else if (b.dataset.item) {
      const { item, style } = b.dataset;
      download(file(item, style), new Blob([svg(item, style)], { type: "image/svg+xml" }));
    } else if (b.dataset.all) {
      const all = b.dataset.all === "*";
      const files = [];
      for (const s of styles) {
        if (!all && s.key !== b.dataset.all) continue;
        for (const it of items) if (has(it.key, s.key)) files.push({ name: (all ? s.key + "/" : "") + file(it.key, s.key), text: svg(it.key, s.key) });
      }
      download(`${zipName}_${all ? "all" : b.dataset.all}.zip`, zip(files));
    }
  });

  draw();
  return el;
}
