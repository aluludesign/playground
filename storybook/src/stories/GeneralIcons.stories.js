import { iconPage } from "../icon-page.js";

// 一般 icon：Figma「icon」區塊（node 162443:14521）的 15 組 component set，
// 每組 outlined／solid／duotone／sticker（peoploe_plus 的線條版在 Figma 叫 Style3）。
// 檔案由 Figma 匯出，只保留 component 本身（拿掉外層 section 的底色與虛線框）。
// 名稱照 Figma 原樣（含 peoploe、calender、triangel、start 等拼法）。
const raw = import.meta.glob("../icons/general/*.svg", { query: "?raw", import: "default", eager: true });
const file = (name, style) => `icon_${name}_${style}.svg`;

const ITEMS = [
  "peoploe_plus",
  "calender",
  "bulb",
  "start_heart",
  "heart",
  "flight",
  "circle_triangel_down",
  "triangel_down",
  "triangel_up",
  "cross",
  "plus",
  "subdirectory_arrow_right",
  "check_line",
  "money",
  "eye",
];

const render = () =>
  iconPage({
    title: "一般 icon",
    lead: `Figma「icon」區塊的 ${ITEMS.length} 組 icon，每組有 outlined（線條）、solid（實心）、duotone（雙色）、sticker（貼紙）幾種樣式。點 icon 下方的按鈕可下載單一 SVG，或一次下載某個樣式、全部。<br>
設計網格是 24×24；sticker 版有些畫布比 24 大（貼紙邊），這裡照同一比例放大，線條粗細會一致。名稱照 Figma 原樣。`,
    unit: 24,
    sizes: [16, 24, 32, 48],
    defaultSize: 32,
    items: ITEMS.map((k) => ({ key: k, title: k, code: `icon/${k}` })),
    styles: [{ key: "outlined" }, { key: "Style3" }, { key: "solid" }, { key: "duotone" }, { key: "sticker" }],
    svg: (name, style) => raw[`../icons/general/${file(name, style)}`],
    file,
    zipName: "trippps_icons",
  });

export default { title: "Icons/一般" };
export const 全部 = { render };
