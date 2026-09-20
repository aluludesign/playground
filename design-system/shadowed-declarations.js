#!/usr/bin/env node
/*
 * 找出「一個 CSS 檔案自己打自己」的宣告 —— 同一個選擇器、同一個屬性，
 * 宣告超過一次，後面那個贏、前面那個是死的。
 *
 *   ./shadowed-declarations.js [檔案.css]      預設 retro-modern.css
 *
 * ⚠️ 它抓不到什麼（這比它抓得到什麼更重要）
 *
 * 它掃的是「一個檔案內部自己打自己」，**不是**「兩個檔案在同一個元素上打架」。
 * 後者長這樣：
 *
 *     .who input { font-size: 14px }    ← 你補回去的
 *     .fld input { font-size: 16px }    ← 別人的規則
 *
 * 不同選擇器、同特異度、寫在後面 —— 後者贏，而前者從寫下的那一刻就是死的。
 * **這個工具抓不到那種**，因為要知道「哪些元素同時吃到這兩條規則」得有真實
 * 的 DOM。那種只有探針量得到。
 *
 * 所以跑過它、乾淨，**不代表沒有死宣告** —— 只代表這個檔案沒有自己跟自己打架。
 *
 * 誤判來源（會列出來但通常不是問題）：
 *   keyframe   兩個 @keyframes 裡都有 0% / 35% / 100%，那是不同動畫的步驟
 *   media      @media 裡的條件覆蓋，例如 prefers-reduced-motion 把 transform 關掉。
 *              那是刻意的，而且它確實贏 —— 只在該媒體條件成立時
 */
'use strict';
const fs = require('fs');
const file = process.argv[2] || 'retro-modern.css';
const css = fs.readFileSync(file, 'utf8');

/* 每條規則記下它在哪、選擇器是什麼、宣告了哪些屬性，以及它是不是包在 @media 裡 */
const rules = [];
const RULE = /\n\s*([^@{}\n][^{}]*?)\s*\{([^{}]*)\}/g;
for (const m of css.matchAll(RULE)) {
  const sel = m[1].replace(/\s+/g, ' ').trim();
  const props = m[2].split(';').filter(d => d.includes(':')).map(d => d.split(':')[0].trim());
  if (!props.length) continue;
  const before = css.slice(0, m.index);
  /* 粗略判斷有沒有在 @media 裡：往前數 @media 之後還沒關掉的括號 */
  const lastMedia = before.lastIndexOf('@media');
  let inMedia = false;
  if (lastMedia !== -1) {
    const tail = before.slice(lastMedia);
    inMedia = (tail.split('{').length - tail.split('}').length) > 0;
  }
  rules.push({ at: m.index, sel, props, inMedia, line: before.split('\n').length });
}

const seen = new Map();
for (const r of rules)
  for (const p of r.props) {
    const k = r.sel + ' ⟨' + p + '⟩';
    if (!seen.has(k)) seen.set(k, []);
    seen.get(k).push(r);
  }

const isStep = (sel) => /^(from|to|\d+%)$/.test(sel);
const findings = [...seen.entries()].filter(([, v]) => v.length > 1);

const kinds = { keyframe: [], media: [], look: [] };
for (const [key, hits] of findings) {
  const sel = key.split(' ⟨')[0];
  if (isStep(sel)) kinds.keyframe.push([key, hits]);
  else if (hits.some(h => h.inMedia)) kinds.media.push([key, hits]);
  else kinds.look.push([key, hits]);
}

const selectors = new Set(rules.map(r => r.sel)).size;
console.log(`${file}: ${rules.length} 條規則、${selectors} 個不同選擇器、${findings.length} 處重複宣告`);
console.log(`  keyframe 步驟 ${kinds.keyframe.length} ・ media 條件覆蓋 ${kinds.media.length} ・ 值得看一眼 ${kinds.look.length}`);

for (const [label, list] of [['值得看一眼', kinds.look], ['media 條件覆蓋', kinds.media], ['keyframe 步驟', kinds.keyframe]]) {
  if (!list.length) continue;
  console.log(`\n[${label}]`);
  for (const [key, hits] of list)
    console.log('  ' + key + ' — 第 ' + hits.map(h => h.line).join('、') + ' 行');
}

if (!kinds.look.length)
  console.log('\n沒有需要人看的項目。注意這只代表這個檔案沒有自己跟自己打架 —— 跨檔案的覆蓋要靠探針。');
