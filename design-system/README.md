# Retro Modern Design System

> Modern usability dressed in 70s optimism.

給 `playground` 底下的行程網站共用的一套設計語言：溫潤地基、柔和有機幾何、
工藝金屬材質、嚴謹色彩秩序。不是一組好看的配色，是可以直接拿去寫版面的 token。

先開 **[`demo.html`](./demo.html)** 看完整的色票、字級、圓角、陰影、金屬材質與組件。

## 檔案

| 檔案 | 做什麼 |
| --- | --- |
| `tailwind.preset.js` | 全部的 token：色彩、字族、字級、圓角、陰影、漸層、緩動曲線 |
| `retro-modern.css` | 金屬材質、反光層、復古紋理、組件 class，以及同一組 token 的 CSS 變數 |
| `retro-modern.js` | 動態反光引擎、按壓回饋、toast、複製到剪貼簿（可選） |
| `demo.html` | 可以直接開的展示頁，也是活的使用範例 |
| `build.sh` | 把 preset 編成靜態 CSS，正式上線用（不必掛 CDN） |

三支檔案是分開的，因為需求層次不同：只要配色就引 preset，
要金屬質感才加 CSS，要高光會跟著手機轉才加 JS。

## 接進一個新網站

```html
<!-- 1. 字型。CSS 刻意不做 @import，那會多一次往返並擋住渲染 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&family=JetBrains+Mono:wght@400;600&family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@700&display=swap">

<!-- 2. Tailwind + preset -->
<script src="https://cdn.tailwindcss.com"></script>
<script src="../design-system/tailwind.preset.js"></script>
<script>tailwind.config = { presets: [retroModern] }</script>

<!-- 3. 材質與組件 -->
<link rel="stylesheet" href="../design-system/retro-modern.css">

<!-- 4. 動態反光（可選，不引也不會壞，高光只是不會動） -->
<script src="../design-system/retro-modern.js"></script>

<body class="rm-base">
```

有 build step 的話 preset 也吃得動：

```js
// tailwind.config.js
module.exports = {
  presets: [require('./design-system/tailwind.preset')],
  content: ['./**/*.html'],
};
```

## 正式上線前要換掉 CDN

上面那段用的是 `cdn.tailwindcss.com`，開起來 console 會出現：

> cdn.tailwindcss.com should not be used in production.

**這個警告是對的，而且是刻意的。** CDN 版會把整個 Tailwind 編譯器
（約 120KB 的 JS）送到瀏覽器，在使用者的裝置上即時算出樣式 ——
打草稿很方便，正式網站不該這樣。行程網站是在國外用手機開的，這點差很多。

正式上線前跑一次 `build.sh`，把 preset 編成一支靜態 CSS：

```sh
./build.sh '../tokyo-trip/index.html'
# → dist/retro-modern.tailwind.css
```

然後把 HTML 裡這兩行

```html
<script src="https://cdn.tailwindcss.com"></script>
<script src="../design-system/tailwind.preset.js"></script>
<script>tailwind.config = { presets: [retroModern] }</script>
```

換成一行：

```html
<link rel="stylesheet" href="../design-system/dist/retro-modern.tailwind.css">
```

沒有 JS，沒有 CDN，沒有執行期編譯。`demo.html` 整頁編出來是 14KB（minified）。

> **一定要指定掃描哪些檔案。** Tailwind 是 content-driven 的 ——
> 它只產出你真的寫在 HTML 裡的 class。所以沒有「全部 utility 的預編版本」
> 可以直接拿來用（那會是好幾 MB），每個網站要編自己的那一份。
> 也因此 `dist/` 沒有進版控。

## 為什麼 demo.html 會說「preset 沒有載入」

`demo.html` 要和 `tailwind.preset.js`、`retro-modern.css`、`retro-modern.js`
**放在同一層一起開**。單獨把它拖進預覽窗格或 artifact 檢視器，
那些相對路徑的兄弟檔案抓不到，token 就不會生效。

碰到這個狀況頁面最上面會出現一條紅色提示。以前是直接丟
`ReferenceError: retroModern is not defined` 然後整段 script 停掉 ——
現在會把話講完，頁面其餘部分照樣運作。

`.rm-base` 負責底色、文字色、字族，以及**讓長字串斷得掉**
（`overflow-wrap:anywhere`）—— 行程網站的欄位是使用者打的，
一條 Google 地圖長網址或一整串日文地址進來，沒有它就會把整頁撐出去。

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

之後要調色票，改 preset 裡的別名一行就好，不用全站搜尋 `foundation-linen`。
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

## 組件 class

`rm-` 開頭的是這套系統新增的；沒有前綴的
（`gradient-*`、`texture-*`、`steel-*`、`pattern-*`、`sheen-*`）
沿用規格書原稿的名字，那份 HTML 的 markup 可以直接貼過來。

| Class | |
| --- | --- |
| `.rm-btn` + `--cta` `--action` `--secondary` `--ghost` `--steel` `--sm` `--lg` | 按鈕 |
| `.btn-steel-hybrid` + 子層 `.steel-iridescent-overlay` | 混合不鏽鋼按鈕（B ⇄ C）|
| `.rm-card` + `--surface` `--expressive` `--raised` `--arch` | 卡片 |
| `.rm-chip` + `--solid` `--accent` | 標籤 |
| `.rm-input` `.rm-label` | 表單 |
| `.rm-day-pin` | 行程號碼牌／地圖圖釘 |
| `.rm-overline` `.rm-divider` `.rm-toast` | 小零件 |

都是單一 class 的低特異度，Tailwind utility 蓋得過去 ——
`class="rm-btn bg-info"` 會如你所想。

## 深色模式

**沒有，刻意的。** 這套系統的靈魂是溫潤的奶油底色與暖色光影，
翻成深色等於重新設計一套色票。之後真的要做，就在 preset 裡新增一組
深色 token，不要用濾鏡反轉 —— 那會把 70s 的暖調變成髒的藍灰。

## 沒有納入的東西

規格書原稿裡的 `foundation.chocolate` 與 `earth.chocolate` 是同一個值
（`#663924`），兩個都保留了，因為它在兩組色階裡各自說得通。

原稿的 `sun.tangelo` 同樣等於 `earth.tangelo`，一併保留，理由相同。
