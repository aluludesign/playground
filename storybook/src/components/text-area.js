import "../wiggle.css";
import "./text-area.css";
import { wireWiggle } from "../wiggle.js";
import { avatarHTML } from "./avatar.js";
import { buttonHTML } from "./button.js";
import { markerButtonHTML } from "./marker-button.js";
import { photoThumbHTML } from "./photo-thumb.js";
import cross from "../icons/general/icon_cross_outlined.svg?raw";

const ICONS = import.meta.glob("../icons/general/*.svg", { query: "?raw", import: "default", eager: true });
// 前面那格放 icon（跟頭像二選一）：照 Figma 的 24 格，有些 sticker 畫布比 24 大，照比例放大、不裁切
const iconHTML = (name, style) => {
  const svg = ICONS[`../icons/general/icon_${name}_${style}.svg`] || "";
  const m = svg.match(/<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/);
  const [w, h] = m ? [+m[1], +m[2]] : [24, 24];
  return svg.replace("<svg", `<svg class="ds-text-area__icon" style="--w:${w};--h:${h}" aria-hidden="true"`);
};

const CROSS = cross.replace("<svg", '<svg aria-hidden="true"');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let uid = 0;

/**
 * 多行輸入框（Figma shared comps「text area」）
 * label：上面的標籤；placeholder：還沒打字時的提示字；value：一開始的內容
 * avatar：前面頭像的照片網址；avatarAlt：頭像名字
 * icon / iconStyle：前面改放 icon（一般 icon 的名稱，例如 "bulb"；樣式 outlined／solid／duotone／sticker），跟頭像二選一
 *   （Show Leading icon：avatar、icon 都不給就不顯示）
 * photos：已經放的照片網址陣列（Show photos）；photoButton：「+照片」按鈕文字（Show photo button：給 "" 就不顯示）
 * maxPhotos：最多幾張（這個旅行專案最多 3 張）；放滿了「+照片」就變成不能按，多選的只收到補滿為止
 * cancel：取消按鈕文字（Show cancel：給 "" 就不顯示；任何 state 都可以有或沒有，看當時狀況）；submit：送出按鈕文字
 * trailingIcon：清除 ✕（Show Trailing icon，有字才出現）
 * state：只給文件頁固定顯示用（"focused"：另外畫一個會閃的打字游標）
 */
export function textAreaHTML({
  label = "有什麼想說的？",
  placeholder = "許願卡上的留言",
  value = "",
  avatar = "",
  avatarAlt = "",
  icon = "",
  iconStyle = "outlined",
  photos = [],
  photoButton = "+照片",
  maxPhotos = 3,
  cancel = "取消",
  submit = "送出許願",
  trailingIcon = true,
  state,
} = {}) {
  const id = `ds-text-area-${++uid}`;
  const cls = ["ds-text-area"];
  if (value) cls.push("is-filled");
  if (state === "focused") cls.push("is-focused", "is-demo-focus");
  const caret = state === "focused" ? `<span class="ds-text-area__caret" aria-hidden="true"><span>${esc(value)}</span></span>` : "";
  photos = photos.slice(0, maxPhotos);
  const add = photoButton || photos.length
    ? `<div class="ds-text-area__add" data-max="${maxPhotos}">${photoButton ? markerButtonHTML({ label: photoButton, color: "secondary", size: "md", disabled: photos.length >= maxPhotos }).replace('class="ds-marker', 'class="ds-text-area__photo-btn ds-marker') + '<input class="ds-text-area__file" type="file" accept="image/*" multiple hidden>' : ""}<div class="ds-text-area__photos">${photos.map((src) => photoThumbHTML({ src })).join("")}</div></div>`
    : "";
  const actions = cancel || submit
    ? `<div class="ds-text-area__actions">${cancel ? buttonHTML({ label: cancel, color: "secondary", variant: "text", size: "md", leadingIcon: false }).replace('class="ds-btn', 'class="ds-text-area__cancel ds-btn') : ""}${submit ? markerButtonHTML({ label: submit, size: "lg" }).replace('class="ds-marker', 'class="ds-text-area__submit ds-marker') : ""}</div>`
    : "";
  return `<div class="${cls.join(" ")}">${label ? `<label class="ds-text-area__label" for="${id}">${esc(label)}</label>` : ""}<div class="ds-text-area__field">${icon ? `<span class="ds-text-area__avatar ds-text-area__avatar--icon">${iconHTML(icon, iconStyle)}</span>` : avatar ? `<span class="ds-text-area__avatar">${avatarHTML({ src: avatar, alt: avatarAlt })}</span>` : ""}<div class="ds-text-area__content"><textarea class="ds-text-area__input" id="${id}" rows="1" enterkeyhint="enter" placeholder="${esc(placeholder)}"${label ? "" : ` aria-label="${esc(placeholder)}"`}>${esc(value)}</textarea>${caret}${trailingIcon ? `<button type="button" class="ds-text-area__clear" aria-label="清除">${CROSS}</button>` : ""}${add}</div><div class="ds-text-area__line ds-text-area__line--rest ds-wiggle-line" aria-hidden="true"></div><div class="ds-text-area__line ds-text-area__line--focus ds-wiggle-line" aria-hidden="true"></div></div>${actions}</div>`;
}

/**
 * 聚焦／有字時換樣子、跟著字變高、✕ 清除、「+照片」選照片（縮圖可以刪）、畫抖動線
 * 事件：ds-text-area-photos（detail.files：新選的檔案）、ds-text-area-cancel、ds-text-area-submit（detail.value、detail.files）
 */
export function wireTextArea(root = document) {
  root.querySelectorAll(".ds-text-area").forEach((ta) => {
    if (ta.dataset.wired) return;
    ta.dataset.wired = "1";
    const input = ta.querySelector(".ds-text-area__input");
    const photos = ta.querySelector(".ds-text-area__photos");
    const file = ta.querySelector(".ds-text-area__file");
    const files = [];
    const max = +(ta.querySelector(".ds-text-area__add")?.dataset.max || 3);
    const photoBtn = ta.querySelector(".ds-text-area__photo-btn");
    // 放滿了就不能再加（這個旅行專案最多 3 張）
    const syncMax = () => { if (photoBtn) photoBtn.disabled = photos.children.length >= max; };
    const fit = () => {
      input.style.height = "auto";
      input.style.height = input.scrollHeight + "px";
    };
    const sync = () => {
      ta.classList.toggle("is-filled", !!input.value);
      fit();
    };
    ta.querySelector(".ds-text-area__field").addEventListener("click", (e) => {
      if (e.target.closest("button, input, .ds-photo-thumb") || e.target === input) return;
      input.focus();
    });
    input.addEventListener("focus", () => { ta.classList.remove("is-demo-focus"); ta.classList.add("is-focused"); });
    input.addEventListener("blur", () => ta.classList.remove("is-focused"));
    input.addEventListener("input", sync);
    ta.querySelector(".ds-text-area__clear")?.addEventListener("click", () => {
      input.value = "";
      input.focus();
      sync();
    });
    photoBtn?.addEventListener("click", () => file?.click());
    file?.addEventListener("change", () => {
      const picked = [...file.files].slice(0, Math.max(0, max - photos.children.length));
      picked.forEach((f) => {
        files.push(f);
        photos.insertAdjacentHTML("beforeend", photoThumbHTML({ src: URL.createObjectURL(f), alt: f.name }));
      });
      file.value = "";
      syncMax();
      ta.dispatchEvent(new CustomEvent("ds-text-area-photos", { bubbles: true, detail: { files: picked } }));
    });
    photos?.addEventListener("click", (e) => {
      const del = e.target.closest(".ds-photo-thumb__delete");
      if (!del) return;
      const thumb = del.closest(".ds-photo-thumb");
      const i = [...photos.children].indexOf(thumb);
      const img = thumb.querySelector("img");
      if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
      thumb.remove();
      syncMax();
      ta.dispatchEvent(new CustomEvent("ds-photo-delete", { bubbles: true, detail: { index: i } }));
    });
    ta.querySelector(".ds-text-area__cancel")?.addEventListener("click", () => ta.dispatchEvent(new CustomEvent("ds-text-area-cancel", { bubbles: true })));
    ta.querySelector(".ds-text-area__submit")?.addEventListener("click", () => ta.dispatchEvent(new CustomEvent("ds-text-area-submit", { bubbles: true, detail: { value: input.value, files: [...files] } })));
    requestAnimationFrame(sync);
  });
  wireWiggle(root);
}
