// 陰影樣式：Figma 的 Effect styles「Elevation/…」，做成 CSS 變數（src/elevation.css）

const ITEMS = [
  { name: "Elevation/component/sm", v: "--ds-elevation-component-sm", use: "元件平常（按鈕 Enabled、Pressed）", fig: "0 1 4 2 · ds/sys/shadow/md · 兩層" },
  { name: "Elevation/component/md", v: "--ds-elevation-component-md", use: "元件 hover", fig: "0 2 8 8 · ds/sys/shadow/md · 兩層" },
  { name: "Elevation/text/xs", v: "--ds-elevation-text-xs", use: "文字陰影（text-shadow）", fig: "0 0.5 1.5 10 · #000000 48%", text: true, note: "CSS 的 text-shadow 沒有 spread，Figma 的 spread 10 套不上" },
  { name: "Elevation/surface/soft", v: "--ds-elevation-surface-soft", use: "柔和環境光（demo shadow-soft）", fig: "0 4 24 2 · red-orange/700 16%" },
  { name: "Elevation/surface/medium", v: "--ds-elevation-surface-medium", use: "實體懸浮光（demo shadow-medium）", fig: "0 8 32 4 · red-orange/700 32%" },
  { name: "Elevation/surface/hard-md", v: "--ds-elevation-surface-hard-md", use: "復古硬派投影", fig: "5 5 0 0 · red-orange-muted/700" },
];

const render = () => {
  const el = document.createElement("div");
  el.className = "tk-page";
  el.innerHTML = `<h1>陰影樣式</h1>
<p class="lead">對應 Figma 的 Effect styles。Figma 的陰影顏色透明度不能綁變數，所以那邊用 effect style 收；這裡做成 CSS 變數，綁了變數的數值都指回 token。元件一律套這些，不各自寫數值。<br>Figma 只有在 frame 開了「Clip content」時陰影的 spread 才會生效，我們的元件都沒開，所以這裡一律用 spread 0，畫出來才會跟 Figma 一樣；表格裡的 spread 是 Figma 上設的值。</p>
<section class="tk"><table><thead><tr><th>Figma 樣式</th><th>預覽</th><th>用在</th><th>Figma 數值（x y blur spread · 顏色）</th><th>CSS 變數</th></tr></thead><tbody>
${ITEMS.map(
  (i) => `<tr>
  <td class="nm">${i.name}</td>
  <td class="pv" style="padding:22px 18px">${
    i.text
      ? `<span style="display:inline-block;padding:8px 12px;border-radius:8px;background:var(--ds-sys-color-primary);font-size:18px;font-weight:700;color:#fff;text-shadow:var(${i.v})">Trippps</span>`
      : `<span style="display:inline-block;width:88px;height:44px;border-radius:10px;background:#fff;box-shadow:var(${i.v})"></span>`
  }</td>
  <td class="al">${i.use}${i.note ? `<br><span class="muted" style="color:#a3948d">${i.note}</span>` : ""}</td>
  <td><code>${i.fig}</code></td>
  <td><code class="var">${i.text ? "text-shadow" : "box-shadow"}: var(${i.v})</code></td>
</tr>`,
).join("")}
</tbody></table></section>`;
  return el;
};

export default { title: "Style/陰影樣式" };
export const 全部 = { render };
