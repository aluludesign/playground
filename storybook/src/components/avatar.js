import "./avatar.css";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * 頭像（Figma shared comps「avatar」）
 * src：照片網址；alt：名字（給讀螢幕的人）；size：「lg」(35) |「md」(24) |「sm」(18)
 */
export function avatarHTML({ src = "", alt = "", size = "md" } = {}) {
  return `<span class="ds-avatar${size !== "md" ? " ds-avatar--" + size : ""}"><img class="ds-avatar__img" src="${esc(src)}" alt="${esc(alt)}"></span>`;
}
