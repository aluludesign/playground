import "../wiggle.css";
import "./text-field.css";
import { wireWiggle } from "../wiggle.js";
import { markPenLayers, drawPenBrush } from "../pen-brush.js";
import { markerButtonHTML } from "./marker-button.js";
import bulbOutlined from "../icons/general/icon_bulb_outlined.svg?raw";
import bulbSticker from "../icons/general/icon_bulb_sticker.svg?raw";
import cross from "../icons/general/icon_cross_outlined.svg?raw";
import arrow from "../icons/general/icon_subdirectory_arrow_right_outlined.svg?raw";

const sized = (svg, cls) => {
  const m = svg.match(/<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/);
  const [w, h] = m ? [+m[1], +m[2]] : [24, 24];
  return svg.replace("<svg", `<svg class="${cls}" style="--w:${w};--h:${h}" aria-hidden="true"`);
};
// 燈泡：平常 outlined；聚焦或有字換 sticker（上色由共用的筆刷畫出來）
const BULB = sized(bulbOutlined, "is-off") + sized(markPenLayers(bulbSticker), "is-on ds-pen-brush");
const CROSS = cross.replace("<svg", '<svg aria-hidden="true"');
const ARROW = arrow.replace("<svg", '<svg class="ds-text-field__support-icon" aria-hidden="true"');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let uid = 0;

/**
 * 文字輸入框（Figma shared comps「text filed」）
 * label：上面的標籤（Show Floating label：floatingLabel）
 * placeholder：還沒打字時的提示字；value：一開始的內容
 * leadingIcon：燈泡（Show Leading icon）；trailingIcon：清除 ✕（Show Trailing icon，聚焦或有字才出現）
 * supportingText：下面的說明（Show supporting text：supporting）；button：說明列後面的馬克筆按鈕文字（不要就給 ""）
 * state：只給文件頁固定顯示用（"focused"）
 */
export function textFieldHTML({
  label = "許個願，想去東京哪? ",
  placeholder = "東京鐵塔…等",
  value = "",
  floatingLabel = true,
  leadingIcon = true,
  trailingIcon = true,
  supporting = true,
  supportingText = "Supporting text",
  button = "強力搜",
  state,
} = {}) {
  const id = `ds-text-field-${++uid}`;
  const cls = ["ds-text-field"];
  if (value) cls.push("is-filled");
  if (state === "focused") cls.push("is-focused");
  return `<div class="${cls.join(" ")}">${floatingLabel ? `<label class="ds-text-field__label" for="${id}">${esc(label)}</label>` : ""}<div class="ds-text-field__field">${leadingIcon ? `<span class="ds-text-field__icon">${BULB}</span>` : ""}<span class="ds-text-field__content"><input class="ds-text-field__input" id="${id}" type="text" value="${esc(value)}" placeholder="${esc(placeholder)}"${floatingLabel ? "" : ` aria-label="${esc(label)}"`}>${trailingIcon ? `<button type="button" class="ds-text-field__clear" aria-label="清除">${CROSS}</button>` : ""}</span><div class="ds-text-field__line ds-text-field__line--rest ds-wiggle-line" aria-hidden="true"></div><div class="ds-text-field__line ds-text-field__line--focus ds-wiggle-line" aria-hidden="true"></div></div>${supporting ? `<div class="ds-text-field__support">${ARROW}<span class="ds-text-field__support-text">${esc(supportingText)}</span>${button ? markerButtonHTML({ label: button, size: "sm" }).replace('class="ds-marker', 'class="ds-text-field__btn ds-marker') : ""}</div>` : ""}</div>`;
}

/** 聚焦／有字時切換樣子（燈泡用筆刷畫出來、底線由左往右畫出來）；✕ 清掉內容；畫抖動線 */
export function wireTextField(root = document) {
  root.querySelectorAll(".ds-text-field").forEach((tf) => {
    if (tf.dataset.wired) return;
    tf.dataset.wired = "1";
    const input = tf.querySelector(".ds-text-field__input");
    const sticker = tf.querySelector(".ds-text-field__icon .is-on");
    const sync = () => {
      const focused = tf.classList.contains("is-focused");
      tf.classList.toggle("is-filled", !!input.value);
      if (sticker) drawPenBrush(sticker, focused || !!input.value);
    };
    input.addEventListener("focus", () => { tf.classList.add("is-focused"); sync(); });
    input.addEventListener("blur", () => { tf.classList.remove("is-focused"); sync(); });
    input.addEventListener("input", sync);
    tf.querySelector(".ds-text-field__clear")?.addEventListener("click", () => {
      input.value = "";
      input.focus();
      sync();
      tf.dispatchEvent(new CustomEvent("ds-text-field-clear", { bubbles: true }));
    });
    requestAnimationFrame(sync);
  });
  wireWiggle(root);
}
