import "../wiggle.css";
import "./divider.css";
import { wireWiggle } from "../wiggle.js";

/**
 * 橫的抖動分隔線（Figma divider/wiggle）
 * color：「outline-200」|「primary」（Figma 的 Property 1）
 * 放進頁面後要呼叫 wireDivider(root) 才會畫線
 */
export function dividerWiggleHTML({ color = "outline-200" } = {}) {
  return `<div class="ds-divider ds-wiggle-line${color === "primary" ? " ds-divider--primary" : ""}" role="separator"></div>`;
}

/**
 * 直的點點線（Figma divider/dot）。height 不給就是 Figma 的 9
 * Figma 的虛線（dash 1、gap 5）會自動調整，讓頭尾都剛好是一點：
 * 段數 = 高 ÷ 6 四捨五入，每段的點跟著等比例縮放（9 高 → 3 點，間隔 4.5）
 */
export function dividerDotHTML({ height = 9 } = {}) {
  const k = Math.max(1, Math.round(height / 6));
  const period = height / k;
  const dash = period / 6;
  const f = (n) => +n.toFixed(3);
  return `<svg class="ds-divider-dot" width="2" height="${height}" viewBox="-1 0 2 ${height}" role="separator" aria-orientation="vertical"><line x1="0" y1="0" x2="0" y2="${height}" stroke-dasharray="${f(dash)} ${f(period - dash)}" stroke-dashoffset="${f(dash / 2)}"/></svg>`;
}

/** 畫抖動線（尺寸變了會自己重畫） */
export const wireDivider = (root = document) => wireWiggle(root);
