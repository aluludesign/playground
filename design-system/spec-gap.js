#!/usr/bin/env node
/*
 * 量「規格書有、系統沒有」的缺口。
 *
 *   ./spec-gap.js <規格書.html> [demo.html] [retro-modern.css]
 *
 * 為什麼需要這支：移植規格書時最容易犯的錯不是做錯，是**judge 掉**——
 * 覺得某個區塊「示範用兩顆就夠」、某個標籤「不重要」。發生過三次：
 * 第一次漏了改掉的值、第二次漏了章節順序、第三次漏了整個區塊。
 * 共同點是每次都在判斷「什麼值得移植」。這支把那個判斷換成一張清單。
 *
 * 它比的四件事，**方向都是單向的**（規格書有而系統沒有）：
 *   CSS 選擇器 ・ id ・ markup 用到的自訂 class ・ 看得見的文字標籤
 *
 * Tailwind 的工具 class（bg-*、flex、px-4…）不算缺口 —— 規格書用 CDN 寫，
 * 那些由 Tailwind 提供，不該由設計系統收。名單在 TW_LIKE。
 */
'use strict';
const fs = require('fs');
const [specFile, demoFile = 'demo.html', cssFile = 'retro-modern.css'] = process.argv.slice(2);
if (!specFile) { console.error('用法: ./spec-gap.js <規格書.html> [demo.html] [retro-modern.css]'); process.exit(2); }

const spec = fs.readFileSync(specFile, 'utf8');
const demo = fs.readFileSync(demoFile, 'utf8');
const css  = fs.readFileSync(cssFile, 'utf8');
const mine = demo + '\n' + css;

const styleOf = (s) => { const a = s.indexOf('<style>'); return a === -1 ? '' : s.slice(a, s.indexOf('</style>')); };

/* 1. CSS 選擇器 */
const selsOf = (s) => new Set([...s.matchAll(/(?:^|\n)\s*([.#][a-zA-Z][^{}\n,]*(?:,\s*[^{}\n]*)?)\s*\{/g)]
  .flatMap(m => m[1].split(',').map(x => x.trim())).filter(Boolean));
const specSels = selsOf(styleOf(spec));
const mySels = selsOf(css);
/* 名字對得上就算有（我這邊會改名，例如 gradient-crisp-steel-dark → bg-steel-crisp）*/
const baseName = (sel) => (sel.match(/[.#]([a-zA-Z][\w-]*)/) || [, ''])[1];
const myNames = new Set([...mySels].map(baseName));

/* 2. id */
const idsOf = (s) => new Set([...s.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));

/* 3. markup 的自訂 class */
const TW_LIKE = /^(sm:|md:|lg:|xl:|hover:|focus:|active:|group|peer|selection:|backdrop-|animate-|sticky|fixed|absolute|relative|flex|grid|inline|block|hidden|w-|h-|min-|max-|p[xytblr]?-|m[xytblr]?-|gap-|space-|text-|font-|leading-|tracking-|bg-|border|rounded|shadow|opacity-|z-|overflow|object-|top-|bottom-|left-|right-|inset-|items-|justify-|self-|col-|row-|order-|cursor-|pointer-|select-|transition|duration-|ease-|scale-|translate|rotate|origin-|fill-|stroke-|list-|whitespace|break-|truncate|underline|uppercase|italic|not-|divide-|ring-|outline|aspect-|container$|mx-auto$|shrink|grow|basis-)/;
const classesOf = (s) => new Set([...s.matchAll(/class="([^"]+)"/g)]
  .flatMap(m => m[1].split(/\s+/)).filter(c => c && !TW_LIKE.test(c) && !/^\[/.test(c)));

/* 4. 看得見的文字（中文或含括號的英文標籤） */
const textOf = (s) => {
  const body = s.replace(/<(script|style)[\s\S]*?<\/\1>/g, '');
  return new Set([...body.matchAll(/>([^<>{}]{2,60})</g)].map(m => m[1].trim())
    .filter(t => t && /[一-鿿]/.test(t) && !/^\s*$/.test(t)));
};

const report = [];
const gap = (label, specSet, mySet, extra) => {
  const miss = [...specSet].filter(x => !mySet.has(x) && !(extra && extra(x)));
  report.push([label, specSet.size, miss]);
};
gap('CSS 選擇器', specSels, mySels, (sel) => myNames.has(baseName(sel)));
gap('id', idsOf(spec), idsOf(demo));
gap('自訂 class', classesOf(spec), new Set([...classesOf(demo), ...myNames]));
gap('看得見的文字', textOf(spec), textOf(demo));

let total = 0;
for (const [label, n, miss] of report) {
  total += miss.length;
  console.log(`${label}: 規格書 ${n} 個，缺 ${miss.length} 個`);
  for (const m of miss) console.log('    ' + m);
  if (miss.length) console.log('');
}
console.log(total === 0
  ? '沒有缺口。注意這比的是「名字和文字有沒有出現」，不是「長得一不一樣」—— 版面要用眼睛看。'
  : `合計缺 ${total} 項。`);
process.exit(total ? 1 : 0);
