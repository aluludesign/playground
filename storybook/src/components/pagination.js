import "./pagination.css";

/**
 * 分頁點點（Figma pagination）
 * count：共幾頁（照片最多 3 張，所以通常是 1–3）
 * active：現在是第幾頁（從 0 開始）
 * label：給讀屏的說明（例如「照片」→ 唸成「照片 第 1 頁，共 3 頁」）
 */
export function paginationHTML({ count = 3, active = 0, label = "" } = {}) {
  const n = Math.max(1, count | 0);
  const a = Math.min(Math.max(0, active | 0), n - 1);
  const dots = Array.from({ length: n }, (_, i) => `<span class="ds-pagination__dot${i === a ? " is-active" : ""}"></span>`).join("");
  return `<div class="ds-pagination" role="img" aria-label="${label ? label + " " : ""}第 ${a + 1} 頁，共 ${n} 頁" data-count="${n}">${dots}</div>`;
}

/** 換到第 index 頁（例如照片左右滑之後呼叫） */
export function setPaginationActive(el, index) {
  const dots = el.querySelectorAll(".ds-pagination__dot");
  if (!dots.length) return;
  const a = Math.min(Math.max(0, index | 0), dots.length - 1);
  dots.forEach((d, i) => d.classList.toggle("is-active", i === a));
  const label = el.getAttribute("aria-label") || "";
  el.setAttribute("aria-label", label.replace(/第 \d+ 頁/, `第 ${a + 1} 頁`));
}
