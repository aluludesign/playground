import "./search-list.css";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * 搜尋清單的一列（Figma「search list」）
 * photo：照片網址；name：名稱；info：資訊（陣列，中間自動用「‧」隔開，例如 ["日本，東京都", "景點"]）
 * state：只給文件頁固定顯示用（"hover" | "pressed" | "focus"）
 */
export function searchItemHTML({ photo = "", name = "", info = [], state } = {}) {
  const parts = info.map((t) => `<span>${esc(t)}</span>`).join('<span class="ds-search-item__dot" aria-hidden="true"></span>');
  return `<button type="button" class="ds-search-item${state ? " is-" + state : ""}"><img class="ds-search-item__photo" src="${esc(photo)}" alt=""><span class="ds-search-item__text"><span class="ds-search-item__name">${esc(name)}</span><span class="ds-search-item__info">${parts}</span></span></button>`;
}
