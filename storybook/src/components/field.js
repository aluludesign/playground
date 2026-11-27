import "./field.css";
import search from "../icons/material/search.svg?raw";
import cancel from "../icons/material/cancel.svg?raw";
import errorIcon from "../icons/material/error.svg?raw";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const icon = (svg) => svg.replace("<svg", '<svg aria-hidden="true"');
let uid = 0;

/**
 * 外框輸入框（Figma「Text field」「Text area」，團主視角那組 Material 3 outlined）
 * multiline：false＝Text field（單行）、true＝Text area（多行）
 * label：標題（Show title：給 "" 就不顯示）；placeholder：對焦、還沒打字時的提示字；value：一開始的內容
 * supporting：框下面的說明文字（Supporting text：給 "" 就不顯示）
 * leadingIcon：前面的放大鏡（Leading icon；要換 icon 就傳 svg 字串）
 * trailingIcon：後面的清除 ✕（Trailing icon；有字才會清）
 * error：錯誤（框、標題、說明變 error，右邊換成錯誤 icon）；disabled：不能用
 * state：只給文件頁固定顯示用（"hover" | "focused"）
 */
export function fieldHTML({
  multiline = false,
  label = "項目",
  placeholder = "例如：一蘭拉麵",
  value = "",
  supporting = "",
  leadingIcon = false,
  trailingIcon = false,
  error = false,
  disabled = false,
  name = "",
  state,
} = {}) {
  const id = `ds-field-${++uid}`;
  const cls = ["ds-field"];
  if (multiline) cls.push("ds-field--area");
  if (value) cls.push("is-filled");
  if (error) cls.push("is-error");
  if (disabled) cls.push("is-disabled");
  if (state === "hover") cls.push("is-hover");
  if (state === "focused") cls.push("is-focused");
  const lead = leadingIcon ? `<span class="ds-field__icon ds-field__leading">${icon(typeof leadingIcon === "string" ? leadingIcon : search)}</span>` : "";
  const trail = trailingIcon
    ? `<button type="button" class="ds-field__icon ds-field__trailing ds-field__clear" aria-label="清除"${disabled ? " disabled" : ""}>${icon(typeof trailingIcon === "string" ? trailingIcon : cancel)}</button>`
    : "";
  const attrs = `class="ds-field__input" id="${id}"${name ? ` name="${esc(name)}"` : ""} placeholder="${esc(placeholder)}"${disabled ? " disabled" : ""}${error ? ' aria-invalid="true"' : ""}${supporting ? ` aria-describedby="${id}-sup"` : ""}${label ? "" : ` aria-label="${esc(placeholder)}"`}`;
  const input = multiline ? `<textarea ${attrs}>${esc(value)}</textarea>` : `<input type="text" ${attrs} value="${esc(value)}">`;
  return `<div class="${cls.join(" ")}"><div class="ds-field__box">${lead}<div class="ds-field__content">${label ? `<label class="ds-field__rest" for="${id}">${esc(label)}</label>` : ""}${input}</div>${trail}<span class="ds-field__icon ds-field__error-icon">${icon(errorIcon)}</span>${label ? `<span class="ds-field__float" aria-hidden="true">${esc(label)}</span>` : ""}<span class="ds-field__outline" aria-hidden="true"></span></div>${supporting ? `<div class="ds-field__support" id="${id}-sup">${esc(supporting)}</div>` : ""}</div>`;
}

/** 對焦、有字時換樣子；點框的任何地方都會對焦；✕ 清除（發出 ds-field-clear） */
export function wireField(root = document) {
  root.querySelectorAll(".ds-field").forEach((f) => {
    if (f.dataset.wired) return;
    f.dataset.wired = "1";
    const input = f.querySelector(".ds-field__input");
    const sync = () => f.classList.toggle("is-filled", !!input.value);
    f.querySelector(".ds-field__box").addEventListener("click", (e) => {
      if (e.target.closest("button") || e.target === input || input.disabled) return;
      input.focus();
    });
    input.addEventListener("focus", () => f.classList.add("is-focused"));
    input.addEventListener("blur", () => f.classList.remove("is-focused"));
    input.addEventListener("input", sync);
    f.querySelector(".ds-field__clear")?.addEventListener("click", () => {
      input.value = "";
      sync();
      input.focus();
      f.dispatchEvent(new CustomEvent("ds-field-clear", { bubbles: true }));
    });
  });
}
