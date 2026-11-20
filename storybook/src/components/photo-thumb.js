import "./photo-thumb.css";
import { scrimButtonHTML } from "./scrim-button.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** 照片縮圖（Figma delete photo）：src 照片網址；alt 說明；右上角 Scrim sm 圓鈕（✕）按了發出 ds-photo-delete（要不要刪由外面決定） */
export function photoThumbHTML({ src = "", alt = "照片" } = {}) {
  const del = scrimButtonHTML({ icon: "cross", size: "sm", label: "刪除照片" }).replace('class="ds-scrim-btn', 'class="ds-photo-thumb__delete ds-scrim-btn');
  return `<span class="ds-photo-thumb"><img class="ds-photo-thumb__img" src="${esc(src)}" alt="${esc(alt)}">${del}</span>`;
}
