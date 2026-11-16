import names from "../icons/weather/names.json";
import { iconPage } from "../icon-page.js";

// 天氣 icon：每種 × 2 版（default 純線條、color 彩色貼紙）
// 來源：design-system/trippps_weather_icons_20261109（svg/ 與 reference_originals/ 的 sun、drop）
const raw = import.meta.glob("../icons/weather/*.svg", { query: "?raw", import: "default", eager: true });
const file = (type, v) => `weather_${type}_${v}.svg`;

const render = () =>
  iconPage({
    title: "天氣 icon",
    lead: `${names.length} 種天氣 × 2 種版本，共 ${names.length * 2} 個 SVG。點 icon 下方的 default ↓、color ↓ 可下載單一 SVG，或一次下載全部。<br>
default 是純線條；color 是彩色底加白色貼紙邊（畫布多出貼紙邊的寬度，線條位置和 default 對齊）。太陽、水滴是最早的兩張參考圖，其餘依它們的風格繪製。白色貼紙邊在白底上看不出來，建議放在有底色的地方。`,
    unit: 16,
    sizes: [16, 24, 32, 48],
    defaultSize: 32,
    items: names.map((n) => ({ key: n.type, title: n.zh, sub: n.en, code: `weather_${n.type}` })),
    styles: [{ key: "default" }, { key: "color" }],
    svg: (type, v) => raw[`../icons/weather/${file(type, v)}`],
    file,
    zipName: "trippps_weather_icons",
  });

export default { title: "Icons/天氣" };
export const 全部 = { render };
