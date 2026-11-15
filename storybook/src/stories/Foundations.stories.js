import { page, pick, table, palette } from "../render.js";

export default { title: "Foundations" };
const F = "Foundations";
const p = (prefix, ex) => pick(F, "ds/foun/" + prefix, ex);

export const 顏色 = () =>
  page(
    palette(p("color/", /\/(share|retro)\//), "基本色"),
    palette(p("color/share/"), "Share 色票（共用）"),
    palette(p("color/retro/"), "Retro 色票"),
  );
export const 字型 = () =>
  page(
    table(p("font/", /\/(size|weight)\//), { title: "字體", note: "源泉圓體（GenSenRounded2 TW）和全瀨體（cjkFonts）還沒有網頁字型檔，預覽暫時用替代字顯示。" }),
    table(p("font/size/"), { title: "字級" }),
    table(p("font/weight/"), { title: "字重" }),
  );
export const 間距 = () => page(table(p("spacing/"), { title: "間距" }));
export const 圓角 = () => page(table(p("radius/"), { title: "圓角" }));
export const 框線 = () => page(table(p("border/"), { title: "框線粗細" }));
export const 陰影 = () =>
  page(table(p("shadow/"), { title: "陰影位移" }), table(p("blur/"), { title: "模糊" }));
export const 透明度 = () => page(table(p("opacity/"), { title: "透明度" }));
export const Icon尺寸 = () => page(table(p("icon/"), { title: "Icon 尺寸" }));
Icon尺寸.storyName = "Icon 尺寸";
export const 裝置寬度 = () =>
  page(table(p("device/"), { title: "裝置寬度", note: "預覽長條縮小為 1/20。" }));
