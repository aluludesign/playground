import "./search-list.css";
import { faClockRotateLeft } from "@fortawesome/free-solid-svg-icons/faClockRotateLeft";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons/faMagnifyingGlass";
import { faLocationDot } from "@fortawesome/free-solid-svg-icons/faLocationDot";
import { faSVG } from "../fa.js";

// 沒照片時那一格的圖示（Figma 沒有，先用 Font Awesome）
const ICONS = { history: faClockRotateLeft, search: faMagnifyingGlass, place: faLocationDot };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * 搜尋清單的一列（Figma「search list」）
 * photo：照片網址；沒有照片就放一格淺色底＋icon（不放壞掉的圖）
 * icon：沒照片時那格的圖示：「history」搜過｜「search」相似的說法｜「place」地點（預設）；name：名稱；info：資訊（陣列，中間自動用「‧」隔開，例如 ["日本，東京都", "景點"]）
 * state：只給文件頁固定顯示用（"hover" | "pressed" | "focus"）
 */
export function searchItemHTML({ photo = "", icon = "place", name = "", info = [], state } = {}) {
  const parts = info.map((t) => `<span>${esc(t)}</span>`).join('<span class="ds-search-item__dot" aria-hidden="true"></span>');
  return `<button type="button" class="ds-search-item${state ? " is-" + state : ""}">${photo ? `<img class="ds-search-item__photo" src="${esc(photo)}" alt="">` : `<span class="ds-search-item__photo ds-search-item__photo--none" aria-hidden="true">${faSVG(ICONS[icon] || ICONS.place, "ds-search-item__icon")}</span>`}<span class="ds-search-item__text"><span class="ds-search-item__name">${esc(name)}</span><span class="ds-search-item__info">${parts}</span></span></button>`;
}
