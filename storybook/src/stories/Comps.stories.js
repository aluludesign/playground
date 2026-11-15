import { page, pick, table } from "../render.js";

export default { title: "Comps" };
const p = (prefix) => pick("Comps", "ds/comp/" + prefix);

export const 按鈕 = () =>
  page(
    table(p("btn/normal/"), { title: "一般按鈕" }),
    table(p("btn/icon/"), { title: "Icon 按鈕" }),
    table(p("btn/segment/"), { title: "分段按鈕" }),
  );
export const 輸入框 = () => page(table(p("field/"), { title: "輸入框" }));
export const Chip = () => page(table(p("chip/"), { title: "Chip" }));
export const 卡片 = () => page(table(p("card/"), { title: "卡片" }));
export const 分隔線 = () => page(table(p("divider/"), { title: "分隔線" }));
export const Focus外框 = () => page(table(p("focus-ring/"), { title: "Focus 外框" }));
Focus外框.storyName = "Focus 外框";
export const 底部導覽 = () => page(table(p("bottom nav/"), { title: "底部導覽" }));
