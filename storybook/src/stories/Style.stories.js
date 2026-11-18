import { page, pick, table } from "../render.js";

export default { title: "Style" };
const S = "Style";
const p = (prefix, ex) => pick(S, "ds/sys/" + prefix, ex);
const colors = (re) => pick(S, "ds/sys/color/").filter((t) => re.test(t.name.replace("ds/sys/color/", "")));

export const 顏色 = () =>
  page(
    table(colors(/^(on )?(primary|secondary|tertiary|error)( container)?$/), { title: "主要角色" }),
    table(colors(/^(surface|surf|inverse)/), { title: "表面" }),
    table(colors(/^(text|outline)/), { title: "文字與框線" }),
    table(colors(/^(scrim|shadow)$/), { title: "遮罩與陰影" }),
    table(colors(/(ai primary|disable)/), { title: "AI 與停用" }),
    table(colors(/^opacity\//), { title: "半透明" }),
    table(colors(/^customs\//), { title: "自訂色（行程顏色）" }),
    table(colors(/fixed/), {
      title: "Fixed（尚未設定）",
      note: "這一組在 Figma 還是佔位的洋紅色 #f600ff，沒有指向 Foundations。",
    }),
  );
export const 字型 = () =>
  page(
    table(p("font/family/"), { title: "字體", note: "源泉圓體（GenSenRounded2 TW）和全瀨體（cjkFonts）已附網頁字型檔，但只含這份文件用到的字。" }),
    table(p("font/size/"), { title: "字級" }),
    table(p("font/weight/"), { title: "字重" }),
  );
export const 間距 = () => page(table(p("spacing/"), { title: "間距" }), table(p("height/"), { title: "高度" }));
export const 圓角 = () => page(table(p("radius/"), { title: "圓角" }));
export const 框線 = () => page(table(p("border/"), { title: "框線粗細" }));
export const 陰影 = () =>
  page(
    table(p("shadow/length/"), { title: "陰影位移" }),
    table(p("shadow/", /length/), { title: "陰影顏色" }),
    table(p("blur/"), { title: "模糊" }),
  );
export const 透明度 = () => page(table(p("opacity/"), { title: "透明度" }));
export const 抖動 = () => page(table(p("wiggle/"), { title: "抖動", note: "Figma Dynamic stroke 的三個數字：frequency（多密）、wiggle（抖多大）、smoothen（多圓滑）。線條樣式頁用的就是這些。" }));
export const Icon尺寸 = () => page(table(p("icon/"), { title: "Icon 尺寸" }));
Icon尺寸.storyName = "Icon 尺寸";
