# Retro Modern Design System

> Modern usability dressed in 70s optimism.

給 `playground` 底下的行程網站共用的一套設計語言：溫潤地基、柔和有機幾何、
工藝金屬材質、嚴謹色彩秩序。不是一組好看的配色，是可以直接拿去寫版面的 token。

先開 **[`demo.html`](./demo.html)** 看完整的色票、字級、圓角、陰影、金屬材質與組件。

## 檔案

| 檔案 | 做什麼 |
| --- | --- |
| `retro-modern.css` | **原始碼** —— `@theme` 的全部 token、金屬材質、反光層、復古紋理、組件 class |
| `demo.entry.css` | `demo.html` 的建置入口 —— 也是「全新專案怎麼寫」的範本 |
| `demo.css` | 編出來的成品，`demo.html` 引的就是它 |
| `retro-modern.js` | 動態反光引擎、按壓回饋、toast、複製到剪貼簿（可選） |
| `demo.html` | 可以直接開的展示頁，也是活的使用範例 |
| `build.sh` | 編譯 —— 給 demo 用的那份，或給某個網站用的那份 |
| `shadowed-declarations.js` | 診斷工具：找出這個檔案裡自己打自己的宣告（不是建置的一部分）|

token 和用到 token 的 CSS 現在在同一支檔案裡 —— Tailwind v4 是 CSS-first 的，
沒有 config 檔。JS 仍然是可選的：不引也不會壞，高光只是不會動。

## 找出被自己蓋掉的宣告

```sh
./shadowed-declarations.js            # 預設掃 retro-modern.css
```

```
retro-modern.css: 79 條規則、75 個不同選擇器、4 處重複宣告
  keyframe 步驟 3 ・ media 條件覆蓋 1 ・ 值得看一眼 0
```

同一個選擇器、同一個屬性宣告兩次，後面那個贏、前面那個是死的 —— 而**死宣告
看程式碼看不出來**，它就在那裡，長得跟活的一樣。

輸出把結果分成三類，因為前兩類通常不是問題：兩個 `@keyframes` 裡都有 `0%`、
`@media (prefers-reduced-motion)` 裡的條件覆蓋。**只有「值得看一眼」需要人去看。**

**它抓不到什麼，比它抓得到什麼重要：**

```css
.who input { font-size: 14px }    /* 你補回去的 */
.fld input { font-size: 16px }    /* 別人的規則 */
```

不同選擇器、同特異度、寫在後面 —— 後者贏，前者從寫下的那一刻就是死的。
**這個工具抓不到那種**，因為要知道「哪些元素同時吃到這兩條規則」得有真實的
DOM。那種只有跑在頁面上的探針量得到。

所以**跑過它、乾淨，不代表沒有死宣告** —— 只代表這個檔案沒有自己跟自己打架。

## 接進一個新網站

`retro-modern.css` 是原始碼，不能直接 `<link>` —— 它開頭是 `@import` 和 `@theme`，
瀏覽器讀不懂。每個網站編自己的那一份。

寫一支入口：

```css
/* my-trip/app.css */
@import "../design-system/retro-modern.css";

/* 掃描範圍：只有這個資料夾。這行是必要的，不是選項 —— 見下面。 */
@source "./";

/* 全新專案才加這行。既有網站不要加 —— 見「接上去會改變什麼」。 */
@import "tailwindcss/preflight.css" layer(base);
```

編出來：

```sh
cd design-system
./build.sh ../my-trip/app.css ../my-trip/style.css
```

HTML 只要字型和那支編好的 CSS：

```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&family=JetBrains+Mono:wght@400;600&family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@700&display=swap">

<link rel="stylesheet" href="./style.css">
<script src="../design-system/retro-modern.js"></script>   <!-- 可選 -->

<body class="rm-base">
```

`demo.entry.css` 就是活生生的範本，照抄它就對了。

**`@source "./"` 那行不能省。** `retro-modern.css` 用 `source(none)` 關掉了
Tailwind 的自動範圍偵測，所以掃描範圍要你自己講。

關掉是刻意的：不關的話，Tailwind 會連 `design-system/` 一起掃，把 `demo.html`
用到的 utility 全編進你的產出。量過一次是 **206 個 class**，其中 `bg-steel-*`、
`bg-day-*`、`rounded-arch` 都不是你在用的；關掉之後是 58 個。

**體積是小事，真正的傷害是下一段那件事會失效** —— 你要寫的 utility 幾乎一定
已經在裡面了（demo 用過），所以忘了重編也看不出來。失效的樣子是「一切正常」。

**改了 token 或新寫了 class 都要重編。** Tailwind 只產出你真的寫在 HTML 裡的
utility，沒重編的新 class 等於不存在 —— 而且不會有錯誤訊息，樣式就是不見。

> 順帶一個掃描器的實情：它不分辨字出現在什麼語法位置。CSS 屬性名、註解、
> 連中文散文都撿 —— 註解裡寫「用 clip 不用 hidden」，`hidden` 就會進產出。
> 所以產出裡出現你沒寫過的 utility 是正常的，不是壞掉。

## 修正不會自己跑到你的網站上

**每個消費端的產出是它自己編出來、commit 進自己目錄的。** 設計系統改了，你的
產出不會跟著變 —— 要重跑一次 `build.sh`。

這不是疏漏，是部署決定的：`tokyo-trip` 的 Vercel Root Directory 是它自己的
資料夾，`design-system/` 不在部署範圍內，所以那支 CSS 非得躺在消費端的目錄裡。

**這件事有人會講。** 每次跑 `build.sh`，它會掃整個 repo 裡帶指紋的產出，
比對還對不對：

```
⚠ tokyo-trip/retro-modern.built.css 比它的來源舊了，重編: ./build.sh ../tokyo-trip/app.css ../tokyo-trip/retro-modern.built.css
```

講給**動手改設計系統的那個人**聽，不是等消費端那邊的人發現。不需要 git hook、
不依賴任何人記得跑什麼 —— 改了就會編，編了就會被告知。

> 它只在有人跑 `build.sh` 時才掃。只改 `retro-modern.css` 而什麼都不編的話
> 沒有東西會講 —— 但那種狀態下也還沒有人受影響。

**還有一種它不會說「沒問題」的情況**：如果產出記的來源檔找不到（搬過位置、
改過名），它會說「驗不出」而不是「是最新的」。那兩件事不一樣。

## token 撞名：你自己宣告過的，設計系統改不動

如果你在自己的 CSS 裡宣告了跟 `@theme` 同名的變數，**你的會贏** —— 你的 `:root`
是無層級的，`@theme` 在 `@layer theme` 裡。那是上一節那個保證在運作，不是 bug。

問題是症狀長得像 bug：**「改了設計系統卻沒反應」。** 所以編譯時會講：

```
⚠ 這些 token 被消費端自己宣告了，設計系統的值到不了：
    --font-mono  （index.html）
  覆寫是合法的。但如果你改了設計系統卻沒反應，先看這裡。
```

沒撞到的話它會報「撞名檢查：113 個 token，無衝突」—— 講出來是刻意的，
因為「沒叫」有兩種意思，而其中一種是「這次沒檢查」。

**命名空間幫了大忙。** token 都帶 v4 的前綴（`--color-ink`、`--radius-lg`），
所以消費端用裸名（`--ink`、`--accent`）不會撞。實測 `tokyo-trip` 24 個自訂變數
只撞 1 個。**不要為了好寫而把 `--color-ink` 簡化成 `--ink`** —— 那會直接製造衝突。

## 接上去會改變什麼、不會改變什麼

**這支 CSS 不帶 preflight**（Tailwind 那份 8.5KB 的全域重設）。它的用途是替
全新專案抹平瀏覽器差異，不是去改一個已經長好的網站。所以：

**只是把 CSS 連上去 —— 你頁面上任何既有的東西都不會動。** 沒有全域選擇器、
沒有 `*` 重設、沒有元素選擇器。標題級距、清單縮排、`b` 的粗細、各種預設
margin，全部維持瀏覽器原本給你的。

**但把既有的元素套上 `rm-*` class，那個元素會變成 `border-box`**（`.rm-divider`
還會被清掉 margin）。這不是副作用，是組件保證自己版面正確的必要條件 ——
少了它 `.rm-input` 的 `width:100%` 加 padding 加邊框會撐出容器（量過：348 → 380），
`.rm-day-pin` 也不再是圓的（28×28 → 44×32）。

**它的後代不受影響。** `box-sizing` 只套在組件元素本身，沒有往下傳。所以把既有
內容放進 `.rm-card` 裡，那些內容維持它原本的盒模型。實測過：帶不帶後代那條，
組件自己的幾何一模一樣，差別只在消費端的子元素動不動。

換句話說，會變的**只有你親手加上 `rm-*` 的那幾個元素本身**。

**而且你原本的決定蓋不掉。** 組件全部包在 `@layer components` 裡，而
**沒有 layer 的 CSS 贏過所有的層** —— 你自己寫的規則是無層級的，所以它一定贏。
真實例子：`tokyo-trip` 刻意在某個元素上設了 `box-sizing: content-box`，
那個元素就算套上 `rm-*`，也還是 content-box。這不只是原則，是階層機制給的結構保證，
而那套機制在這裡站在消費端那邊。

全新專案想要 preflight 就自己加一行（`demo.entry.css` 裡有），那是 opt-in。

## 瀏覽器需求

v4 產出會用到 `@property`、`color-mix()`、`@layer`，所以下限是
**iOS Safari 16.4+ / Chrome 111+ / Firefox 128+**（Safari 16.4 是 2023 年 3 月，
iPhone 8 以後的機型都支援）。

低於這條線不是整個壞掉，但壞法要知道：

- **顏色照常**。`var(--color-ink)` 是十年前就有的語法
- **`bg-paper/50` 這類半透明會整條宣告失效**，背景直接不上色 —— 它編成
  `color-mix()`，而且連 `@supports` 裡的後備也是。這是安靜失效，不是退化成難看
- 陰影和 ring 靠 `@property` 的 `initial-value`，行為不保證

## token 就是 CSS 變數

`@theme` 裡每一個 token 都會被輸出成真正的 CSS 變數，手寫 CSS 直接用：

```css
color: var(--color-ink);
background: var(--color-surface);
border: 2px solid var(--color-foundation-clove);
```

**它們是完整的顏色，不是三個數字。** devtools 也照常顯示色塊。

| 命名空間 | 例 |
| --- | --- |
| `--color-*` | `--color-ink`、`--color-day-3`、`--color-earth-tangelo` |
| `--radius-*` | `--radius-arch` |
| `--shadow-*` | `--shadow-hard-md` |
| `--font-*` `--text-*` `--ease-*` | `--font-serif`、`--text-h2`、`--ease-tactile` |

語意別名是扁平的（`--color-ink`），顏料是分組的（`--color-foundation-clove`）。

## 色彩

### 用語意別名，不要點名顏料

| 寫這個 | 而不是 | 用途 |
| --- | --- | --- |
| `bg-paper` | `bg-foundation-muslin` | 頁面底 |
| `bg-surface` | `bg-foundation-linen` | 卡片 |
| `border-line` | `border-foundation-sandstone` | 分割線 |
| `text-ink` | `text-foundation-clove` | 主文字與外框 |
| `text-ink-soft` / `text-ink-muted` | driftwood / warm-taupe | 次級、更次級的文字 |
| `bg-accent` `text-accent-ink` | `bg-earth-tangelo` | 主要行動 |
| `text-positive` `text-negative` `text-caution` `text-info` | olive / tomato / mustard / chambray | 狀態 |

之後要調色票，改 `@theme` 裡的別名一行就好，不用全站搜尋 `foundation-linen`。
顏料名（`foundation-*`、`earth-*`、`sky-*`、`sun-*`、`botanical-*`）留給
真的需要指名某個色相的場合，例如裝飾線、圖表。

### 80% 中性 + 20% 表現力

規格書的鐵則：大面積永遠是 foundation 那組奶油／砂岩色，
tangelo、terracotta、mustard 是點睛，不是底色。
`rm-card--expressive`（陶土色卡片）一個畫面出現一次就夠了。

### Day 分類色

行程網站專用：`bg-day-1` … `bg-day-6`，第 N 天的身分色。
這組不在原規格書裡，是我從核心色相延伸、用 CVD 驗證器調過彩度的。

| Slot | Hex | |
| --- | --- | --- |
| day-1 | `#D54C15` | 焦橘 |
| day-2 | `#2BA6B0` | 孔雀藍綠 |
| day-3 | `#E3A824` | 芥末黃 |
| day-4 | `#4F67B1` | 群青 |
| day-5 | `#6F8130` | 酪梨綠 |
| day-6 | `#9B4368` | 桑椹紫紅 |

**規則：day 色一律搭數字或文字標籤，絕不單靠顏色辨識。**
相鄰配對全部通過門檻（最差 CVD ΔE 10.7 deutan、一般視覺 ΔE 21.5），
但 day-2 與 day-3 對底色的對比低於 3:1 —— 標籤是必要的補償，不是裝飾。

六天同時出現在同一張圖上（地圖、散佈圖、小倍數）時屬於 all-pairs 情境，
**前三個 slot 才過得了 all-pairs 門檻**；橘與綠在 deutan 下必然靠近，
再怎麼換色都一樣。所以那種圖上編號是強制的 —— 現成的
`.rm-day-pin` 就是為此存在，時間軸的號碼牌與地圖圖釘共用同一個樣式，
兩邊看起來才是同一個東西：

```html
<span class="rm-day-pin" style="--rm-dc: var(--rm-day-3)">7</span>
```

顏色由「它是第幾天」決定，寫死在每個標記上，不要繼承容器 ——
靠繼承的話，同一個點在不同圖層裡會變色。

## 字體

Fraunces（標題）與 DM Sans（內文）**都沒有中文字符**，
所以字族後面接了 Noto Serif TC / Noto Sans TC。中英混排時英文保有 70s
編輯感，中文也有對應的襯線／黑體調性，不會突然掉回系統預設。

| Class | 用途 |
| --- | --- |
| `font-serif` | Fraunces → Noto Serif TC。只給 display 與 h1~h3 |
| `font-sans` | DM Sans → Noto Sans TC。內文與所有 UI |
| `font-mono` | JetBrains Mono。時間、金額、色碼、token 名 |

字級走語意名：`text-display` `text-h1` `text-h2` `text-h3` `text-h4`
`text-body-lg` `text-body` `text-caption` `text-overline`。
display 與 h1/h2 是 `clamp()`，手機到桌機自己縮。
Tailwind 原本的數字級距（`text-sm` 等）沒有被拿掉，照樣可用。

> 輸入框不要小於 16px。iOS 在較小的輸入框上會自動放大整頁，
> `.rm-input` 已經設好了。

## 圓角與陰影

**`rounded-sm/md/lg/xl` 是這套系統重新定義過的**，不是 Tailwind 預設值：

| Class | 值 | 用途 |
| --- | --- | --- |
| `rounded-sm` | 8px | 標籤、輸入框 |
| `rounded-md` | 16px | 小型卡片 |
| `rounded-lg` | 24px | 標準容器 |
| `rounded-xl` | 32px | 重點看板 |
| `rounded-pill` | 9999px | 按鈕、膠囊 |
| `rounded-arch` | `48px 48px 16px 16px` | 70s 拱門 |

整組取代而不是 extend：留著 Tailwind 原本的值會讓 `rounded-lg` 同名不同值，
翻程式碼時很難確定看到的是哪一套。`rounded-2xl` / `rounded-3xl` 保留成
md / lg 的別名，規格書原稿的 markup 貼過來不會變形。

陰影有兩種性格，別混用：

- `shadow-soft` `shadow-medium` `shadow-floating` —— 帶模糊的暖色環境光，
  用 clove 調色，不是 Material 的冷黑
- `shadow-hard-sm` `shadow-hard-md` `shadow-hard-lg` —— 復古硬派位移投影，
  不帶模糊，**一定要配 `border-2 border-ink` 才立得住**

## 金屬材質

三款仿霧面不鏽鋼。漸層是 Tailwind utility，光澤與紋理是 CSS class：

```html
<div class="steel-sheen-surface relative rounded-lg border-2 border-ink bg-steel-matte p-6 shadow-hard-md">
  <div class="texture-brushed-metal pointer-events-none absolute inset-0 rounded-lg opacity-40"></div>
  <div class="steel-content-layer">…文字放這裡…</div>
</div>
```

| | 漸層 | 性格 |
| --- | --- | --- |
| Version A | `bg-steel-matte` | 柔霧、高漫射絲緞。**預設用這款** |
| Version B | `bg-steel-crisp` | 更凝聚、更有精神的冷灰階 |
| Version C | `bg-steel-iridescent` + `.sheen-iridescent` | 天青淡紫與香檳金薄膜微虹光 |

幾件要守的事：

- **文字一定要在 `.steel-content-layer` 裡**（或是 `.steel-sheen-surface`
  的直接子元素）。反光層在 `z-index` 2 和 3，內容在 10 ——
  這個順序就是為了不讓高光把文字洗白
- `.text-steel-engraved`（實體刻印陰影）**只給大級字**。
  小字套下去筆畫會糊掉，反而更難讀
- `.steel-sheen-surface` 會 `overflow:hidden`，圓角要同時給容器和紋理層

### 混合按鈕：Version B ⇄ C

一顆按鈕三種狀態，各自獨立不互相干擾：

| 狀態 | 表現 |
| --- | --- |
| 靜止 | Version B 的冷鋼 |
| Hover / 鍵盤 focus | Version C 的薄膜虹光在 0.3 秒內淡入 —— 天青、淡紫、香檳金、薄荷綠 |
| Click | 白光微閃（`steel-press-flash`）|

```html
<button class="rm-btn btn-steel-hybrid steel-sheen-surface"
        onclick="RetroModern.pressFlash(this, () => { … })">
  <span class="steel-iridescent-overlay"></span>
  <span>按鈕文字</span>
</button>
```

**hover 層裡一滴白色都沒有**（沒有白光掃掠條、沒有循環呼吸亮度），
白光嚴格保留給點擊。這樣「滑過去有回應」和「真的被按下」才不會混成同一件事 ——
兩個都閃白光的話，使用者分不出自己到底按到了沒有。

兩個實作上的細節：

- `.rm-btn:hover` 的特異度跟 `.btn-steel-hybrid` 一樣（各一個 class + 一個
  pseudo-class），所以底色那條**必須把 `:hover` 也列進選擇器**，
  不然滑過去會被換成砂岩色
- hover 規則包在 `@media (hover: hover)` 裡。手機點一下之後 `:hover` 會黏住不放，
  虹光就永遠亮著、再也回不去 Version B —— 那不是這個效果的用意。
  鍵盤的 `:focus-visible` 不分裝置，所以放在 media query 外面

### 動態反光

引了 `retro-modern.js` 就自動啟動：滑鼠、捲動、觸控都會推動高光；
手機的陀螺儀要使用者手勢才拿得到權限，得自己綁一顆按鈕：

```js
RetroModern.requestMotion().then(state => { /* 'granted' | 'denied' */ });
```

實作上光源是**全域的**：所有金屬面共用同一盞燈，變數寫在 `:root` 上讓它繼承，
每幀只改 4 個變數而不是走訪 N 個元件各改 4 個。
追到定位就停掉 `requestAnimationFrame` —— 行程網站是在外面邊走邊看的，
不能讓它一直空轉耗電池。`prefers-reduced-motion: reduce` 下整套動態直接不啟動。

## 其他工具

```js
RetroModern.pressFlash(btn, () => { … });  // 金屬按壓微光，callback 延後 160ms
RetroModern.flare();                       // 整片金屬閃一下
RetroModern.toast('已儲存');                // 需要頁面上有一個 .rm-toast
RetroModern.copy('#D54C15', 'accent');     // 複製並跳 toast
```

`pressFlash` 的 callback 刻意延後，讓使用者先看到金屬凹下去、再看到事情發生。

## 紋理

`.pattern-checker`、`.pattern-stripes`、`.pattern-grid`、`.texture-brushed-metal`。

方格是參數化的 —— 四個變數行內給值就好，不必為每種配色各寫一個 class：

```html
<div class="pattern-grid"
     style="--grid-fill-color:#8DB6C7; --grid-border-color:#D54C15;
            --grid-size:24px; --grid-border-width:2px"></div>
```

| 變數 | 預設 | |
| --- | --- | --- |
| `--grid-fill-color` | `transparent` | 方格填色 |
| `--grid-border-color` | 8% 丁香褐 | 線色 |
| `--grid-border-width` | `1px` | 線粗 |
| `--grid-size` | `20px` | 格寬 |

四個各自獨立，只給想改的那個就行。變數名沒有 `rm-` 前綴，沿用規格書原稿，
那份 HTML 的 markup 可以直接貼過來。

格子愈小、線愈細，愈接近 Retro Editorial 的排版底紋；格子大、線粗則偏向
70s 海報的活潑感。demo 裡那兩組（24px/2px 與 14px/1.5px）就是這兩端。

## 可切換與可移除的標籤

```html
<!-- 按鈕：狀態在 aria-pressed -->
<button class="rm-chip rm-chip--selectable" aria-pressed="false">景點</button>

<!-- label + checkbox：狀態在 checkbox，表單送得出去 -->
<label class="rm-chip rm-chip--selectable"><input type="checkbox" name="who" hidden> 阿輝</label>

<!-- 可移除 -->
<span class="rm-chip rm-chip--removable">Sky Blue
  <button class="rm-chip__remove" aria-label="移除 Sky Blue">✕</button>
</span>
```

**狀態寫在屬性上，不是靠 JS 抽換 class。** 抽換 class 的做法要記住十個名字的增減
順序，少刪一個就卡在半途；而且 screen reader 讀不出它是被按下的。
`aria-pressed` 和 `:has(input:checked)` 兩種都支援，因為兩種都是真實用法 ——
前者是純互動、後者送得進表單。

**選取時不只換顏色**：邊框變實、加硬派投影。所以灰階列印和色盲情境下也分得出來，
不是只靠色相。

## 自動掃掠

hover 要使用者先碰到；掃掠是「不碰它也想讓它被看見」用的。虹光從右掃到左閃入
閃出，接著白色高光再掃一次：

```html
<button class="rm-btn btn-steel-hybrid steel-sheen-surface">
  <span class="steel-iridescent-overlay"></span>
  <span class="directional-sheen"></span>
  <span class="white-sweep-flare"></span>
  <span>按鈕文字</span>
</button>
```

```js
RetroModern.sweep(btn);   // 回傳 Promise，兩段都跑完才 resolve
```

兩段是**接續**不是同時 —— 白光那層是 overlay 混合、虹光那層是遮罩位移，疊在一起
會互相洗掉。時長寫在 CSS 的 `animation` 上，JS 只負責加 class 和收尾，
**時長只存在一個地方**。

`prefers-reduced-motion: reduce` 下 `sweep()` 直接 resolve，兩層都不動。

### 虹光的彩度

```css
:root { --iri-saturate: 1.2; }   /* 1 = 原本的薄膜色 */
```

跟 `--sheen-*` 一樣是執行期旋鈕，不在 `@theme` 裡 —— demo 有一根滑桿可以調到
滿意為止，調定之後它就是一個常數。

## 組件 class

`rm-` 開頭的是這套系統新增的；沒有前綴的
（`gradient-*`、`texture-*`、`steel-*`、`pattern-*`、`sheen-*`）
沿用規格書原稿的名字，那份 HTML 的 markup 可以直接貼過來。

| Class | |
| --- | --- |
| `.rm-btn` + `--cta` `--action` `--secondary` `--ghost` `--steel` `--sm` `--lg` | 按鈕 |
| `.btn-steel-hybrid` + 子層 `.steel-iridescent-overlay` | 混合不鏽鋼按鈕（B ⇄ C）|
| `.rm-card` + `--surface` `--expressive` `--raised` `--arch` | 卡片 |
| `.rm-chip` + `--solid` `--accent` `--selectable` `--removable` + `.rm-chip__remove` | 標籤 |
| `.rm-input` `.rm-label` | 表單 |
| `.rm-day-pin` | 行程號碼牌／地圖圖釘 |
| `.rm-overline` `.rm-divider` `.rm-toast` | 小零件 |

全部包在 `@layer components` 裡，所以 Tailwind utility 一定蓋得過去 ——
`class="rm-btn bg-info"` 會如你所想。

## 深色模式

**沒有，刻意的。** 這套系統的靈魂是溫潤的奶油底色與暖色光影，
翻成深色等於重新設計一套色票。之後真的要做，就在 `@theme` 裡新增一組
深色 token，不要用濾鏡反轉 —— 那會把 70s 的暖調變成髒的藍灰。

## 沒有納入的東西

規格書原稿裡的 `foundation.chocolate` 與 `earth.chocolate` 是同一個值
（`#663924`），兩個都保留了，因為它在兩組色階裡各自說得通。

原稿的 `sun.tangelo` 同樣等於 `earth.tangelo`，一併保留，理由相同。
