// 把 tokens/figma-retro.txt（Figma 變數快照）轉成：
//   src/generated/tokens.css   —— 三層 CSS 變數，Style/Comps 用 var() 指向上一層
//   src/generated/tokens.json  —— 給故事頁畫表格用（含指向誰、最後的值）
//
// CSS 變數名稱跟網站同一套：ds/sys/color/on primary → --ds-sys-color-on-primary
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "tokens/figma-retro.txt"), "utf8");

const PREFIX = { F: "ds/foun/", S: "ds/sys/", C: "ds/comp/" };
const COLLECTION = { F: "Foundations", S: "Style", C: "Comps" };
const full = (short) => PREFIX[short[0]] + short.slice(2);
const cssVar = (name) => "--" + name.toLowerCase().replace(/[\/\s]+/g, "-");
const TYPE = { F: "number", C: "color", S: "string" };

const tokens = [];
const seen = new Set();
for (const line of src.split("\n")) {
  if (!line.trim() || line.startsWith("#")) continue;
  const [short, t, value] = line.split("|");
  if (seen.has(short)) throw new Error("重複的變數：" + short);
  seen.add(short);
  const name = full(short);
  tokens.push({
    collection: COLLECTION[short[0]],
    name,
    cssVar: cssVar(name),
    type: TYPE[t],
    alias: value.startsWith("@") ? full(value.slice(1)) : null,
    raw: value.startsWith("@") ? null : value,
  });
}

const byName = new Map(tokens.map((t) => [t.name, t]));
for (const t of tokens) {
  if (t.alias && !byName.has(t.alias)) throw new Error(`${t.name} 指向不存在的 ${t.alias}`);
}

// 數字要不要帶單位：看它是什麼
function unitFor(name, value) {
  if (/\/font\/weight\//.test(name)) return String(value);
  // 抖動線的三個數字照 Figma Dynamic stroke（frequency／wiggle／smoothen），不帶單位
  if (/\/wiggle\//.test(name)) return String(value);
  if (/\/opacity\//.test(name)) return value + "%";
  return value + "px";
}
function cssValue(t) {
  if (t.alias) return `var(${byName.get(t.alias).cssVar})`;
  if (t.type === "number") return unitFor(t.name, t.raw);
  if (t.type === "string") return t.raw === "n/a" ? "initial" : JSON.stringify(t.raw);
  return t.raw;
}
function resolve(t) {
  const chain = [];
  let cur = t;
  while (cur.alias) {
    cur = byName.get(cur.alias);
    chain.push(cur.name);
  }
  return { chain, value: cur.raw, css: cssValue(cur) };
}

let css = "/* 由 scripts/build-tokens.mjs 產生，不要手改。來源：tokens/figma-retro.txt */\n:root {\n";
for (const c of ["Foundations", "Style", "Comps"]) {
  css += `  /* ${c} */\n`;
  for (const t of tokens.filter((x) => x.collection === c)) css += `  ${t.cssVar}: ${cssValue(t)};\n`;
}
css += "}\n";

const json = tokens.map((t) => {
  const r = resolve(t);
  return { ...t, chain: r.chain, value: r.value, resolvedCss: r.css };
});

const out = join(root, "src/generated");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "tokens.css"), css);
writeFileSync(join(out, "tokens.json"), JSON.stringify(json, null, 1));
const count = (c) => tokens.filter((t) => t.collection === c).length;
console.log(`tokens: Foundations ${count("Foundations")}、Style ${count("Style")}、Comps ${count("Comps")}`);
