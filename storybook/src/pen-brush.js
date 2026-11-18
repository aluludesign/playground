// 筆刷上色：sticker 的上色由一支看不見的筆，從左上往右下一塊一塊畫出來。用法見 src/pen-brush.css。
import "./pen-brush.css";

const NS = "http://www.w3.org/2000/svg";
let maskId = 0;

/**
 * 把 sticker SVG 字串裡的「上色層」標起來：上色層＝半透明的筆刷形狀。
 * 白底、深棕線稿不動（線稿沒有 opacity，或是 opacity ≥ 0.5 的深棕，例如飛機）。
 */
export function markPenLayers(svg) {
  return svg.replace(/<(path|rect)(\s+opacity="([\d.]+)")([^>]*?)(\s*\/?)>/g, (all, tag, opAttr, op, rest, close) => {
    if (/#652D15/i.test(rest) && +op >= 0.5) return all;
    const color = (rest.match(/\s(?:fill|stroke)="(#[0-9a-f]{3,8})"/i) || [])[1] || "currentColor";
    return `<${tag} class="ds-pen-brush__layer" style="--pen:${color}"${opAttr}${rest}${close}>`;
  });
}

/** 幫每一塊上色加一個「從左上掃到右下」的遮罩，並照位置排好先後（左上的先畫）。要等 svg 排版好才量得到 */
export function preparePenBrush(svg) {
  if (svg.dataset.pen) return;
  const pens = [...svg.querySelectorAll(".ds-pen-brush__layer")];
  const boxes = pens.map((p) => p.getBBox());
  if (!boxes.some((b) => b.width)) return; // 還沒排版好，下次再量
  svg.dataset.pen = "1";
  let defs = svg.querySelector("defs");
  if (!defs) defs = svg.insertBefore(document.createElementNS(NS, "defs"), svg.firstChild);
  const gid = `ds-pen-sweep-g-${++maskId}`;
  // 斜向漸層：左上半邊白（看得到）、右下半邊透明，中間一小段柔邊像筆刷邊緣
  defs.insertAdjacentHTML(
    "beforeend",
    `<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset=".44" stop-color="#fff"/><stop offset=".56" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
  );
  const order = pens.map((p, k) => k).sort((a, b) => boxes[a].x + boxes[a].y - (boxes[b].x + boxes[b].y));
  order.forEach((k, i) => {
    const b = boxes[k], pad = 2;
    const x = b.x - pad, y = b.y - pad, w = b.width + pad * 2, h = b.height + pad * 2;
    const id = `ds-pen-sweep-${++maskId}`;
    defs.insertAdjacentHTML(
      "beforeend",
      `<mask id="${id}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}"><rect class="ds-pen-brush__sweep" x="${x - w}" y="${y - h}" width="${w * 2}" height="${h * 2}" fill="url(#${gid})" style="--i:${i};--sx:${w}px;--sy:${h}px"/></mask>`,
    );
    pens[k].setAttribute("mask", `url(#${id})`);
    pens[k].style.setProperty("--i", i);
  });
}

/** 畫出來（on = true）或收起來 */
export function drawPenBrush(svg, on = true) {
  preparePenBrush(svg);
  svg.classList.toggle("is-drawn", on);
}
