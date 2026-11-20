import "./photo-thumb.css";
import cross from "../icons/general/icon_cross_outlined.svg?raw";

const CROSS = cross.replace(/fill="#652D15"/gi, 'fill="currentColor"').replace("<svg", '<svg aria-hidden="true"');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** 照片縮圖（Figma delete photo）：src 照片網址；alt 說明；右上角 ✕ 按了發出 ds-photo-delete（要不要刪由外面決定） */
export function photoThumbHTML({ src = "", alt = "照片" } = {}) {
  return `<span class="ds-photo-thumb"><img class="ds-photo-thumb__img" src="${esc(src)}" alt="${esc(alt)}"><button type="button" class="ds-photo-thumb__delete" aria-label="刪除照片">${CROSS}</button></span>`;
}
