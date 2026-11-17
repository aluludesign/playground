// 抖動線條：照 Figma「Dynamic stroke」的 frequency／wiggle／smoothen 畫平滑的 SVG 線。
// 用法見 src/wiggle.css。
import "./wiggle.css";

const SVG = "http://www.w3.org/2000/svg";

// 固定種子的亂數：同一個元素每次重畫的抖法都一樣，不會一縮放就換一條線
function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const f = (n) => +n.toFixed(2);

// 把折線的每個轉角磨圓：smoothen 0 = 尖角、1 = 整段都是曲線
function smoothPath(pts, smoothen, closed) {
  const n = pts.length;
  const at = (i) => pts[(i + n) % n];
  const k = Math.max(0, Math.min(1, smoothen)) / 2;
  if (closed) {
    const start = lerp(at(0), at(1), k);
    let d = `M${f(start[0])} ${f(start[1])}`;
    for (let i = 1; i <= n; i++) {
      const p = at(i);
      const a = lerp(p, at(i - 1), k);
      const b = lerp(p, at(i + 1), k);
      d += ` L${f(a[0])} ${f(a[1])} Q${f(p[0])} ${f(p[1])} ${f(b[0])} ${f(b[1])}`;
    }
    return d + "Z";
  }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < n - 1; i++) {
    const p = pts[i];
    const a = lerp(p, pts[i - 1], k);
    const b = lerp(p, pts[i + 1], k);
    d += ` L${f(a[0])} ${f(a[1])} Q${f(p[0])} ${f(p[1])} ${f(b[0])} ${f(b[1])}`;
  }
  return d + ` L${f(pts[n - 1][0])} ${f(pts[n - 1][1])}`;
}

/** 水平抖動線：寬 width，畫在 y = 0，上下最多偏 amount */
export function wiggleLinePath(width, { frequency = 10, amount = 1.5, smoothen = 0.5, seed = 1 } = {}) {
  const r = rng(seed);
  const step = 100 / Math.max(1, frequency);
  const n = Math.max(2, Math.round(width / step));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([(width * i) / n, (r() * 2 - 1) * amount]);
  return smoothPath(pts, smoothen, false);
}

/** 圓角矩形外框：沿著邊每隔一段取一點，往內外最多偏 amount。
 *  radius 可以是一個數字，或四個角 [左上, 右上, 右下, 左下]（膠囊、圓形、只有上面圓角都行） */
export function wiggleRectPath(w, h, radius, { frequency = 10, amount = 0.3, smoothen = 0.5, seed = 1 } = {}) {
  const r = rng(seed);
  const step = 100 / Math.max(1, frequency);
  const rs = (Array.isArray(radius) ? radius : [radius, radius, radius, radius]).map((x) => Math.max(0, x || 0));
  // 跟瀏覽器一樣：相鄰兩角加起來超過邊長時等比例縮小
  const scale = Math.min(1, w / (rs[0] + rs[1] || 1), h / (rs[1] + rs[2] || 1), w / (rs[2] + rs[3] || 1), h / (rs[3] + rs[0] || 1));
  const [tl, tr, br, bl] = rs.map((x) => x * scale);
  const rad = (deg) => (deg * Math.PI) / 180;
  const arcSeg = (cx, cy, rr, from) => ({
    len: (Math.PI * rr) / 2,
    pt: (t) => [cx + rr * Math.cos(rad(from + 90 * t)), cy + rr * Math.sin(rad(from + 90 * t))],
    nm: (t) => [Math.cos(rad(from + 90 * t)), Math.sin(rad(from + 90 * t))],
  });
  const segs = [
    { len: w - tl - tr, pt: (t) => [tl + t * (w - tl - tr), 0], nm: () => [0, -1] },
    arcSeg(w - tr, tr, tr, -90),
    { len: h - tr - br, pt: (t) => [w, tr + t * (h - tr - br)], nm: () => [1, 0] },
    arcSeg(w - br, h - br, br, 0),
    { len: w - br - bl, pt: (t) => [w - br - t * (w - br - bl), h], nm: () => [0, 1] },
    arcSeg(bl, h - bl, bl, 90),
    { len: h - bl - tl, pt: (t) => [0, h - bl - t * (h - bl - tl)], nm: () => [-1, 0] },
    arcSeg(tl, tl, tl, 180),
  ];
  const pts = [];
  for (const s of segs) {
    if (s.len <= 0.01) continue;
    const n = Math.max(1, Math.round(s.len / step));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const [x, y] = s.pt(t);
      const [nx, ny] = s.nm(t);
      const off = (r() * 2 - 1) * amount;
      pts.push([x + nx * off, y + ny * off]);
    }
  }
  return smoothPath(pts, smoothen, true);
}

let nextSeed = 1;
const num = (v, d) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
};

function draw(el) {
  const cs = getComputedStyle(el);
  const w = el.clientWidth;
  const h = el.clientHeight;
  if (!w) return;
  if (!el.dataset.wiggleSeed) el.dataset.wiggleSeed = String(nextSeed++ * 7919);
  const opts = {
    frequency: num(cs.getPropertyValue("--wiggle-frequency"), 10),
    amount: num(cs.getPropertyValue("--wiggle-amount"), 1),
    smoothen: num(cs.getPropertyValue("--wiggle-smoothen"), 0.5),
    seed: +el.dataset.wiggleSeed,
  };
  const sw = num(cs.getPropertyValue("--wiggle-width"), 1);
  let svg = el.querySelector(":scope > .ds-wiggle__svg");
  if (!svg) {
    svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "ds-wiggle__svg");
    svg.setAttribute("aria-hidden", "true");
    svg.appendChild(document.createElementNS(SVG, "path"));
    el.appendChild(svg);
  }
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  const path = svg.firstChild;
  path.setAttribute("stroke-width", sw);
  if (el.classList.contains("ds-wiggle-line")) {
    path.setAttribute("d", wiggleLinePath(w, opts));
    path.setAttribute("transform", `translate(0 ${h / 2})`);
  } else {
    const radii = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map((v) => num(v, 0));
    path.setAttribute("d", wiggleRectPath(w, h, radii, opts));
    path.removeAttribute("transform");
  }
}

const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver((es) => es.forEach((e) => draw(e.target))) : null;

/** 幫 root 底下所有 .ds-wiggle-line／.ds-wiggle-border 畫線，之後尺寸變了自動重畫 */
export function wireWiggle(root = document) {
  const els = root.querySelectorAll(".ds-wiggle-line, .ds-wiggle-border");
  els.forEach((el) => {
    draw(el);
    observer && observer.observe(el);
  });
  // 字型載入後尺寸可能變，再畫一次
  document.fonts && document.fonts.ready.then(() => els.forEach(draw));
}
