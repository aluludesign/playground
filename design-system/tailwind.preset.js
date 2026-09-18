/*!
 * Retro Modern Design System — Tailwind preset
 * "Modern usability dressed in 70s optimism."
 *
 * 用法（Tailwind CDN）:
 *   <script src="https://cdn.tailwindcss.com"></script>
 *   <script src="../design-system/tailwind.preset.js"></script>
 *   <script>tailwind.config = { presets: [retroModern] }</script>
 *
 * 用法（build step）:
 *   // tailwind.config.js
 *   module.exports = { presets: [require('./design-system/tailwind.preset')], content: [...] }
 *
 * 這份檔案只負責 token。金屬漸層的光澤層、紋理、pattern 與組件 class
 * 在 retro-modern.css；動態反光引擎在 retro-modern.js。
 */
(function (root, factory) {
  var preset = factory();
  if (typeof module === 'object' && module.exports) module.exports = preset;
  if (root) root.retroModern = preset;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ── 原色 ─────────────────────────────────────────────────────────
     規格書的四組色彩角色。這些是「顏料」，不是「用途」——
     用途請走下面的語意別名（paper / ink / accent…）。 */

  var foundation = {
    muslin: '#F1EFE6',        // 主要底色
    linen: '#F9E8D4',         // 次級卡片
    sandstone: '#DCCFB8',     // 邊框 / 分割
    'warm-taupe': '#9A8E84',  // 次級文字
    driftwood: '#8A5033',     // 暖木強調
    chocolate: '#663924',     // 重磅對比
    clove: '#53443D',         // 主文字 / 外框
  };

  var earth = {
    tangelo: '#D54C15',       // Primary CTA
    cork: '#B44B28',          // hover / 次級行動
    terracotta: '#AD7556',    // 質感按鈕
    chocolate: '#663924',     // 暗部錨定
  };

  var sky = {
    'blue-tide': '#97A3AE',
    chambray: '#7A9CB3',
    botticelli: '#8DB6C7',
    'play-blue': '#4F67B1',
  };

  var sun = {
    mustard: '#E3A824',
    tangelo: '#D54C15',
    coral: '#E77451',
    tomato: '#C93B2B',
  };

  var botanical = {
    olive: '#727B48',
    sage: '#98A68B',
  };

  /* 三款仿霧面不鏽鋼的色停點。單獨當色塊用得到，
     整條漸層請用 bg-steel-matte / bg-steel-crisp / bg-steel-iridescent。 */
  var steel = {
    luster: '#F0F2F5', highlight: '#D8DCE1', body: '#B2B9C0',
    satin: '#CBD0D6', shadow: '#889098',
  };
  var steelDeep = {
    luster: '#F1F4F8', highlight: '#C8D0DA', body: '#9EA7B4',
    satin: '#B4BDC8', shadow: '#727C88',
  };
  var steelIri = {
    luster: '#F6F8FB', lavender: '#E0E5F0', cyan: '#B8CBD8', body: '#B2B6C6',
    amber: '#D8CDC2', satin: '#C3CBD2', shadow: '#88919A',
  };

  /* ── Day 分類色 ───────────────────────────────────────────────────
     行程網站專用：第 N 天的身分色（時間軸標題、地圖圖釘、分類佔比）。
     不是規格書原有的，是我從核心色相延伸、並用 CVD 驗證器調過彩度的一組。

     驗過的門檻（surface #F1EFE6，相鄰配對）：
       亮度帶 PASS ・ 彩度下限 PASS ・ CVD ΔE 10.7 PASS ・ 一般視覺 ΔE 21.5 PASS
     規則：day 色一律搭配數字或文字標籤，絕不單靠顏色辨識
     （mustard 與 teal 對底色的對比低於 3:1，這是必要的補償）。
     六個同時出現在一張圖上時（例如地圖），數字編號是強制的。 */
  var day = {
    1: '#D54C15', // tangelo   焦橘
    2: '#2BA6B0', // peacock   孔雀藍綠
    3: '#E3A824', // mustard   芥末黃
    4: '#4F67B1', // play blue 群青
    5: '#6F8130', // avocado   酪梨綠
    6: '#9B4368', // mulberry  桑椹紫紅
  };

  return {
    theme: {
      /* 全面取代，不是 extend —— 留著 Tailwind 原本的 rounded-* 會讓
         radius.lg(24px) 跟預設的 rounded-lg(8px) 同名不同值，很難查。 */
      borderRadius: {
        none: '0',
        sm: '8px',          // 標籤 / 輸入框
        DEFAULT: '8px',
        md: '16px',         // 小型卡片
        lg: '24px',         // 標準容器
        xl: '32px',         // 重點看板
        '2xl': '16px',      // 相容別名 = md（規格書原稿用 rounded-2xl）
        '3xl': '24px',      // 相容別名 = lg（規格書原稿用 rounded-3xl）
        pill: '9999px',     // 按鈕 / 膠囊
        full: '9999px',
        arch: '48px 48px 16px 16px',      // 70s 拱門
        'arch-sm': '24px 24px 8px 8px',
      },

      extend: {
        colors: {
          foundation: foundation,
          earth: earth,
          sky: sky,
          sun: sun,
          botanical: botanical,
          steel: steel,
          'steel-deep': steelDeep,
          'steel-iri': steelIri,
          day: day,

          /* 語意別名。日常寫版面請用這組，不要直接點名顏料——
             之後要調整色票，改這裡就好，不用全站搜尋 foundation-linen。 */
          paper: foundation.muslin,        // 頁面底
          surface: foundation.linen,       // 卡片
          'surface-2': foundation.sandstone,
          line: foundation.sandstone,      // 分割線
          ink: foundation.clove,           // 主文字 / 外框
          'ink-soft': foundation.driftwood,
          'ink-muted': foundation['warm-taupe'],
          accent: earth.tangelo,
          'accent-hover': earth.cork,
          'accent-ink': foundation.muslin, // 壓在 accent 上的文字
          positive: botanical.olive,       // 有結餘 / 已完成
          negative: sun.tomato,            // 超支 / 錯誤
          caution: sun.mustard,            // 提醒
          info: sky.chambray,              // 中性資訊
        },

        fontFamily: {
          /* Fraunces 與 DM Sans 都沒有中文字符，後面接 Noto TC 系列，
             中英混排時英文保有 70s 編輯感、中文也有對應的襯線/黑體調性。 */
          serif: ['Fraunces', 'Noto Serif TC', 'Songti TC', 'PingFang TC', 'serif'],
          sans: ['DM Sans', 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', 'system-ui', 'sans-serif'],
          mono: ['JetBrains Mono', 'IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        },

        /* 語意字級。規格書只定義了兩種字族的分工，這組階層是補上的，
           數字級距（text-sm、text-xl…）照樣可用。 */
        fontSize: {
          display: ['clamp(2.5rem, 6vw, 4rem)', { lineHeight: '1.04', letterSpacing: '-0.022em', fontWeight: '800' }],
          h1: ['clamp(2rem, 4.5vw, 3rem)', { lineHeight: '1.1', letterSpacing: '-0.018em', fontWeight: '800' }],
          h2: ['clamp(1.5rem, 3vw, 2rem)', { lineHeight: '1.18', letterSpacing: '-0.012em', fontWeight: '700' }],
          h3: ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.008em', fontWeight: '700' }],
          h4: ['1.0625rem', { lineHeight: '1.4', fontWeight: '700' }],
          'body-lg': ['1.0625rem', { lineHeight: '1.72' }],
          body: ['0.9375rem', { lineHeight: '1.7' }],
          caption: ['0.8125rem', { lineHeight: '1.5' }],
          overline: ['0.6875rem', { lineHeight: '1.3', letterSpacing: '0.12em', fontWeight: '700' }],
        },

        boxShadow: {
          soft: '0 4px 20px rgba(83, 68, 61, 0.08)',
          medium: '0 8px 30px rgba(83, 68, 61, 0.14)',
          floating: '0 16px 40px rgba(83, 68, 61, 0.22)',
          /* 復古硬派位移投影。不帶模糊，所以一定要配 border 才立得住。 */
          'hard-sm': '3px 3px 0px #53443D',
          'hard-md': '5px 5px 0px #53443D',
          'hard-lg': '8px 8px 0px #53443D',
        },

        backgroundImage: {
          'steel-matte': 'linear-gradient(135deg, #F0F2F5 0%, #D8DCE1 24%, #B2B9C0 52%, #CBD0D6 76%, #889098 100%)',
          'steel-matte-subtle': 'linear-gradient(140deg, #F4F6F8 0%, #DEE2E6 32%, #C2C8CF 68%, #A4ACB5 100%)',
          'steel-crisp': 'linear-gradient(135deg, #F1F4F8 0%, #C8D0DA 22%, #9EA7B4 50%, #B4BDC8 74%, #727C88 100%)',
          'steel-iridescent': 'linear-gradient(135deg, #F6F8FB 0%, #E0E5F0 16%, #B8CBD8 36%, #B2B6C6 52%, #D8CDC2 70%, #C3CBD2 84%, #88919A 100%)',
        },

        transitionTimingFunction: {
          tactile: 'cubic-bezier(0.25, 1, 0.5, 1)',       // 按壓回彈
          overshoot: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', // toast / 抽屜
        },

        maxWidth: {
          prose: '68ch',
        },
      },
    },
  };
});
