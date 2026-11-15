import tokens from "./generated/tokens.json";

export const ALL = tokens;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** 取某一層、名稱符合前綴的變數。prefix 例：「ds/sys/color/」 */
export function pick(collection, prefix, exclude) {
  return tokens.filter(
    (t) => t.collection === collection && t.name.startsWith(prefix) && !(exclude && exclude.test(t.name)),
  );
}

/** 依名稱猜要畫哪一種預覽（全部用 var() 畫，所以畫出來的就是三層真的串起來的結果） */
function kindOf(t) {
  const n = t.name;
  if (t.type === "color") return "color";
  if (/\/font\/size\//.test(n)) return "fontSize";
  if (/\/font\/weight\//.test(n)) return "fontWeight";
  if (/family/.test(n)) return "fontFamily";
  if (/radius|raduis/.test(n)) return "radius";
  if (/\/border\/|outline-width|divider\/size|focus-ring\/border/.test(n)) return "border";
  if (/\/opacity\//.test(n)) return "opacity";
  if (/\/blur\//.test(n)) return "blur";
  if (/shadow\/length|shdow\/length/.test(n)) return "shadow";
  if (/\/icon/.test(n) || /active-icon/.test(n)) return "square";
  if (/\/device\//.test(n)) return "device";
  return "bar";
}

export function preview(t) {
  const v = `var(${t.cssVar})`;
  switch (kindOf(t)) {
    case "color":
      return `<span class="sw" style="background:${v}"></span>`;
    case "fontSize":
      return `<span style="font-size:${v};line-height:1.2">字 Aa</span>`;
    case "fontWeight":
      return `<span style="font-weight:${v};font-size:18px">字 Aa</span>`;
    case "fontFamily":
      return `<span style="font-family:${v};font-size:18px">旅行 Trippps 123</span>`;
    case "radius":
      return `<span class="rd" style="border-radius:${v}"></span>`;
    case "border":
      return `<span class="bd" style="border-width:${v}"></span>`;
    case "opacity":
      return `<span class="sw op" style="opacity:${v}"></span>`;
    case "blur":
      return `<span class="bl"><i style="filter:blur(${v})"></i></span>`;
    case "shadow":
      return `<span class="sh" style="box-shadow:${v} ${v} 0 var(--ds-foun-color-retro-red-orange-muted-700)"></span>`;
    case "square":
      return `<span class="sq" style="width:${v};height:${v}"></span>`;
    case "device":
      return `<span class="bar" style="width:calc(${v} / 20)"></span>`;
    default:
      return `<span class="bar" style="width:${v}"></span>`;
  }
}

const short = (name) => name.replace(/^ds\/(foun|sys|comp)\//, "");

function valueCell(t) {
  if (t.type === "color") return `<code>${esc(t.value)}</code>`;
  if (t.type === "number") return `<code>${esc(t.resolvedCss)}</code>`;
  return `<code>${esc(t.value)}</code>`;
}

/** 一般表格：名稱｜預覽｜指向｜最後的值｜CSS 變數 */
export function table(list, { title, note } = {}) {
  const rows = list
    .map(
      (t) => `<tr>
  <td class="nm">${esc(short(t.name))}</td>
  <td class="pv">${preview(t)}</td>
  <td class="al">${t.alias ? "→ " + esc(t.alias) : "<span class=muted>—</span>"}</td>
  <td>${valueCell(t)}</td>
  <td><code class="var">${esc(t.cssVar)}</code></td>
</tr>`,
    )
    .join("");
  return `<section class="tk">
${title ? `<h2>${esc(title)}</h2>` : ""}${note ? `<p class="note">${note}</p>` : ""}
<table><thead><tr><th>名稱</th><th>預覽</th><th>指向</th><th>值</th><th>CSS 變數</th></tr></thead><tbody>${rows}</tbody></table>
</section>`;
}

/** Foundations 色票：每個色系一列 */
export function palette(list, title) {
  const groups = new Map();
  for (const t of list) {
    const m = t.name.match(/^(.*)\/([^/]+)$/);
    const fam = m[1].replace(/^ds\/foun\/color\/?/, "") || "base";
    if (!groups.has(fam)) groups.set(fam, []);
    groups.get(fam).push({ t, step: m[2] });
  }
  const rows = [...groups]
    .map(
      ([fam, items]) => `<div class="pal-row"><div class="pal-name">${esc(fam)}</div><div class="pal-chips">${items
        .map(
          ({ t, step }) =>
            `<div class="chip" title="${esc(t.cssVar)}"><span class="sw lg" style="background:var(${t.cssVar})"></span><b>${esc(step)}</b><small>${esc(t.value)}</small></div>`,
        )
        .join("")}</div></div>`,
    )
    .join("");
  return `<section class="tk"><h2>${esc(title)}</h2>${rows}</section>`;
}

export const page = (...parts) => {
  const el = document.createElement("div");
  el.className = "tk-page";
  el.innerHTML = parts.join("");
  return el;
};
