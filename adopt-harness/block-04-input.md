# 第四塊:`.fld input/select/textarea` → `rm-input`

依 `ADOPTION.md`「該改變外觀的輪」的規則:事前登記 → 改 → 比對 → 逐項對帳。

> 本檔「實際結果」以上的每一節都是**在動手之前**寫下的,而且每一句都是量出來的,
> 不是從 CSS 讀出來推的(量法:`WIDTH=390 ./probe.sh probes/inputs.js`,以及 1100)。

---

## 開工前的三件事

### 1. 線上狀態(自己跑的,不寫進 `ADOPTION.md`)

開工時(約 14:35)跑出來的是:`origin/main` = `47b6665`,
第一塊(`rm-chip`)、mono、第三塊(`rm-label`)都已上線,本機 `957d829` 還沒推。

**而這一輪結束前再跑一次,`origin/main` 已經是 `957d829` 了** —— 有人在這中間推了。

> 寫在這裡是因為它剛好示範了 `ADOPTION.md`「線上現在是什麼」那一節在講的事:
> **把 push 狀態寫下來,它在你還沒寫完的時候就過期了。**
> 這一份是某個時刻的紀錄,所以留著並標上時間;
> `ADOPTION.md` 是會被反覆讀的文件,所以那裡**不寫**,只留產生答案的三行指令。
>
> 順帶提醒下一個人:`957d829` 上線**不代表第四塊上線了**。這一輪的改動還沒提交。

### 2. 基準自己重截並用 `cmp` 驗過 —— 而它抓到東西了

照 `ADOPTION.md` 的規定,在乾淨的 `957d829` 上重截一組 `shots/pre-input`,
跟別人遞過來的 `shots/label` 逐張 `cmp`:

```
01-plan-mobile  ✗ 不同(2.1481%,y=454..651)
02..09          逐位元組相同
```

**照規則,任何非零一律當成問題查。** 查的結果見下面「新踩到的陷阱 1」——
它不是誰改壞了,是 **01 這張圖本來就在兩個狀態之間跳**。
同一個乾淨工作樹再截一次(`shots/pre-input-2`)得到的是**跟 `shots/label` 逐位元組相同**
的那一張,也就是說跳掉的是我的第一次。

**這一輪的基準用 `shots/pre-input-2`**(= `shots/label`,九張全 `✓`)。

### 3. 工作樹狀態跟交接時說的不一樣

交接說「有一個未追蹤的 `design-system/vercel.json`,不是你的,別碰」——
開工時它**已經不存在了**(別的 session 在這中間處理掉了)。
`git status --porcelain` 全空。這一輪從頭到尾 `design-system/` 是乾淨的,
出處紀錄的「相依工作樹 0 個檔案有未提交的改動」每一批都確認過。

---

## Lulu 這一輪的決定

`ADOPTION.md` 把 iOS 那題的三條路擺出來,Lulu 選了第一條的精確版本:

> **保留手機版的 16px 覆寫(`:521`),刪掉桌機的基底規則(`:419`)。**

代價她知道:**手機上這一塊的字級和內距不會換成 design-system 的**,
換到的是框線、背景、圓角、文字顏色、placeholder 顏色。

---

## 先驗證交接文件裡的每一句

交接的人要求「請自己驗證上面每一句,包括特異度那句 —— 我也可能錯」。逐句:

| 交接說的 | 驗證 | 結論 |
| --- | --- | --- |
| `:419` 是主規則、`:521` 是手機覆寫 | 讀 `index.html`,`:499` 是 `@media (max-width:640px)` 的開頭,`:521` 在裡面 | ✅ |
| `.fld input` 特異度高過 `.rm-input`,手機那條本來就會贏 | `.fld input` = 1 class + 1 型別 =(0,1,1);`.rm-input` =(0,1,0)。**跟載入順序無關,它一定贏** | ✅ |
| `rm-input` 是 `.9375rem` = 15px | `design-system/retro-modern.css:587`,root 16px → 15px | ✅ |
| 框線 1px 冷灰 → 2px 深褐 | 量到 `1px solid rgb(221,225,234)` → 規則寫 `2px solid var(--color-foundation-clove)` = `#53443D` | ✅ |
| `input[type=number]` 的等寬覆寫還活著 | `:430` =(0,2,1) > `.rm-input`(0,1,0);量到 `ef-amount` / `xe-amount` 現在是 `IBM Plex Mono` | ✅ 預期存活,事後再量一次 |
| `[type=time]` / `[type=date]` 的矯正(`:423-426`)沒被打壞 | 同樣是(0,2,1),而且 `rm-input` 沒有碰 `appearance`。**但有一個副作用,見下** | ⚠ 有一項要登記 |
| padding 會讓欄位明顯變高 | **這一句在九張截圖上不成立,見下** | ❌ **交接這一句要更正** |

### 要更正的一句:padding 在九張截圖裡完全沒有變

`ADOPTION.md` 寫「**`padding`** 桌機 7px 9px → `.625rem .875rem` = 10px 14px,**欄位會明顯變高**」。

**08 和 09 都是 390px 寬的手機圖**(`shoot.sh` 的 `shot 08-addstop-form 390 1100`、
`shot 09-edit-dialog 390 900`),而 390 ≤ 640,所以 `:521` 那條覆寫是生效的,
`padding` 是 `10px 11px`——**保留 `:521` 就等於 padding 一個像素都不會動**。

量到的證據(`probes/inputs.js`,29 個欄位控制項):

| | WIDTH=390 | WIDTH=1100 |
| --- | --- | --- |
| font-size | `16px` × 29 | `14px` × 29 |
| padding | `10px 11px` × 29 | `7px 9px` × 29 |

桌機那一套(15px 字、10px 14px 內距)是真的會改,但**九張截圖裡沒有任何一張
在桌機寬度上打開過 `.fld`**(02 和 07 是 1100px,但那兩張沒有任何表單是開的)。

> 所以這一塊的「欄位變高」只剩下**框線 1px → 2px 帶來的每邊 1px**,
> 一個欄位 +2px,不是交接預期的「明顯變高」。
> **這件事必須事前寫下來**,否則對帳時看到「只變了 2px」會以為是沒生效。

### 另一個副作用:`[type=time]` / `[type=date]` 的字型會跟其他欄位分家(但看不出來)

`:423` 寫的是 `font-family:inherit`,特異度(0,2,1)贏過 `.rm-input` 的
`font-family:var(--font-sans)`。所以改完之後:

- 文字欄位 → `var(--font-sans)` = design-system 的 `"DM Sans","Noto Sans TC",...`
- time / date 欄位 → `inherit` = `--font-body` = `"Noto Sans TC",...`

**兩者實際畫出來一樣**,因為 `tokyo-trip/index.html:10` 那條 Google Fonts `<link>`
只載 IBM Plex Mono / Noto Sans TC / Zen Kaku Gothic New,**沒有 DM Sans**。
量法照 `ADOPTION.md`「量字體的四個陷阱」——不問 `fonts.check()`,用兩個 span 量形狀:

```
"DM Sans",serif      → 390.81px
"__nope__",serif     → 390.81px     完全相同 = DM Sans 沒有載到,落回後援
```

**登記成風險**:哪天有人把 DM Sans 加進那條 `<link>`(字型那一塊排在最後,
很可能就是那時候),**time / date 欄位會立刻跟其他欄位變成兩套字**,
而那時候沒有人會記得原因出在 `:423` 的 `font-family:inherit`。

---

## `.who` 核取方塊:這一塊的 `.fld label` 時刻

**`.fld input` 是後代選擇器,而 `.who` 住在 `.fld` 裡** —— 跟第三塊 `.who label`
一模一樣的形狀,只是這次中招的是核取方塊本身。

量到的(10 個,`ef-who` 5 + `xe-who` 5):

| | 現在(390 / 1100) | `.fld input` 有沒有真的生效 |
| --- | --- | --- |
| `width` | offsetWidth **28px** / **26px**(其中各有一個是 13px) | ✅ `width:100%` 生效了 —— 原生核取方塊是 13px,**它被撐寬了一倍** |
| `background-color` | `rgb(255,255,255)` | ✅ 生效 |
| `font-size` | `16px` / `14px` | ✅ 生效 |
| `line-height` | `24px` / `21px` | ✅ 生效 |
| `border` | `0px none` | ❌ 沒生效(Chrome 的原生核取方塊不吃) |
| `padding` | `0px` | ❌ 沒生效 |
| `border-radius` | `0px` | ❌ 沒生效 |
| `height` | 13px(兩個寬度都是) | — |

**刪掉 `:419`,那 10 個核取方塊會從 28px 縮回 13px。** 那是看得見的,
**而九張截圖裡沒有任何一張打開過 `#exp-form` 或 `#exp-edit-overlay`** —— 驗不到。

**處理:照第三塊的先例,把生效的那四個宣告原樣補進 `.who input`,讓它逐項不變。**
不是因為「被撐寬一倍的核取方塊」好看 —— 它顯然是個意外 ——
而是因為**這一輪不該碰它**,而且碰了也沒有任何一張圖驗得到。

> 登記給之後的人:`.who` 那一整組(膠囊 + 核取方塊)現在是**兩輪各凍一次**的舊樣子。
> 第三塊凍了 `color` 和 `letter-spacing`,這一塊凍了 `width` / `background` /
> `font-size` / `line-height`。要動它得先讓截圖看得到它,那是獨立的一塊。

---

## 改什麼(四處)

```
1. index.html:419   .fld input,.fld select,.fld textarea{...}   → 整條刪掉
2. index.html:521   手機覆寫                                     → 原樣保留(Lulu 的決定)
3. index.html:436   .who input{accent-color:...}                → 補回四個宣告(見上)
4. markup           29 個 .fld 裡的 input / select              → 加 class="rm-input"
                    + JS 產生的那一個(index.html:2855,改名欄位)
```

沒有 `<textarea>`:選擇器裡有,markup 裡一個都沒有(grep 過)。

---

## 事前登記:預期的視覺變化

### 每一個屬性(390px,也就是 08 / 09 實際的寬度)

| 屬性 | 現在 | 之後 | 使用者看得出來嗎 |
| --- | --- | --- | --- |
| border-width | 1px | **2px** | **看得見** |
| border-color | `#DDE1EA` 冷淺灰 | **`#53443D` 深褐** | **看得見**,而且是這一塊最明顯的一項 |
| background | `#FFFFFF` 純白 | **`#F1EFE6` 暖米** | **看得見** |
| color(輸入的字) | `#15171D` 近黑 | **`#53443D` 暖褐** | 看得見(弱) |
| border-radius | 7px | 8px | **看不出來**(差 1px) |
| `::placeholder` | `rgb(117,117,117)` 瀏覽器預設灰 | **`#9A8E84`** | **看得見** —— 08 那三個 placeholder 會變淺變暖 |
| font-size | 16px | **16px 不變**(`:521` 贏) | 只是一致 |
| padding | 10px 11px | **不變**(`:521` 贏) | 沒有效果 |
| line-height | 24px | 24px(兩邊都 1.5) | 沒有效果 |
| 欄位高度 | 46 / 48px | **48 / 50px**(+2px,純粹是框線) | 看得見(微) |
| min-width | `0px` | `auto`(行為上還是 0) | **沒有效果** |
| `:focus-visible` | 瀏覽器預設 | 3px `#D54C15` 外框 | **看得見,但這一輪驗不到**(截圖不對焦) |
| `font-family`(文字欄位) | `Noto Sans TC` | 宣告變 `DM Sans` 但**畫出來仍是 Noto Sans TC** | 沒有效果(見上) |
| `font-family`(number 欄位) | `IBM Plex Mono` | **不變**(`:430` 贏) | 沒有效果(而這正是要確認的) |
| `font-family`(time/date) | `Noto Sans TC` | **不變**(`:423` 的 `inherit` 贏) | 沒有效果 |

### 桌機(1100px)會變、但九張都驗不到的

| 屬性 | 現在 | 之後 |
| --- | --- | --- |
| font-size | 14px | 15px |
| padding | 7px 9px | 10px 14px |
| 欄位高度 | 37 / 38 / 39px | 約 45 / 46 / 47px |

**這一節整段都在「沒有驗到的事」裡**,不在對帳清單裡。

### 每個欄位會長高多少(390px)

```
改前:  內容 24px + 內距 20px + 框線 2px(1+1) = 46px
改後:  內容 24px + 內距 20px + 框線 4px(2+2) = 48px
                                                ────
                                                +2px / 每個欄位
```

08 有 4 個可見欄位 → 表單約長高 8px,底下的當日行程整片往下推。
09 有 5 個可見欄位 → 對話框約長高 10px,因為**置中**,整張卡往上移約 5px。

### 逐張截圖

| 圖 | 預期 |
| --- | --- |
| 01 plan-mobile | **零差異** —— 但這張有已知的雙穩態,見「新踩到的陷阱 1」。**只接受兩種結果**:逐位元組相同,或那個已知簽章(2.1481% / y=454..651 / 1 群)且重截後回到相同 |
| 02 plan-desktop | **零差異**(`#stop-form` 帶 `hidden`) |
| 03 cost-mobile | **零差異**(`#exp-form` 帶 `hidden`) |
| 04 split-mobile | **零差異**(這頁沒有 `.fld`) |
| 05 wishes-mobile | **零差異**(`#wish-form` 另外帶 `hidden`) |
| 06 map-sheet | **零差異** |
| 07 map-drawer | **零差異** |
| 08 addstop-form | **會變**:4 個欄位(時間／做什麼／地點車站／備註)。框線變粗變深、背景轉暖米、placeholder 變淺;表單長高約 8px,**把下面的當日行程整片往下推** |
| 09 edit-dialog | **會變**:5 個欄位(哪一天的 `<select>`／時間／做什麼／地點車站／備註)。長高約 10px,對話框置中 → 整張卡往上移約 5px |

### 不在預期內的東西(出現就是問題)

- 02–07 任何一張有差異
- 01 出現**不是**那個已知簽章的差異
- `.who` 核取方塊的 width / background / font-size / line-height 改變(第 3 項沒補對)
- `.who` 成員膠囊(`label`)本身的任何改變 —— 第三塊凍住的那些
- `ef-amount` / `xe-amount` 不再是 `IBM Plex Mono`
- time / date 的 `appearance` 不再是 `none`,或 `::-webkit-date-and-time-value`
  的 `margin` / `text-align` / `line-height` 改變
- 九張裡任何一張的正向斷言從 `✓` 變 `✗`
- `retro-modern.built.css` 的 `utilities` 層從 8 個 class 變多
- 任何欄位溢出容器(刪掉 `min-width:0` 的風險;`.fld` 自己還有 `min-width:0`,
  而且 column flex 的 `min-width:auto` 本來就算 0,所以預期沒事)

---

## 驗不到的地方(事前講清楚)

| 沒被驗到的 | 為什麼 |
| --- | --- |
| **iOS 對焦放大** | **見下面獨立一節。這一輪完全沒有驗證。** |
| 桌機那一套值(15px 字、10px 14px 內距) | 九張裡沒有一張在 1100px 打開過 `.fld` |
| 29 個欄位裡的 20 個 | 截圖只畫得到 08 的 4 個 + 09 的 5 個 = **9 個**。其餘只有探針的 computed 值 |
| JS 產生的 `rn-*` 欄位 | 載入時不在 DOM,探針也量不到,只有 markup 上的 class |
| `.who` 核取方塊 | `#exp-form` / `#exp-edit-overlay` 九張都沒開過 |
| `:focus-visible` 的橘色外框 | 截圖不對焦 |
| `::placeholder` 在 08 以外 | 只有 08 那三個 placeholder 畫得出來 |
| Google Fonts 載入失敗時的樣子 | 從來沒測過 |

### ⚠ iOS 對焦放大:這一輪沒有驗證,需要真人在 iPhone 上確認

這一塊的整個決定(保留 `:521`)就是為了防 iOS Safari 在字級 < 16px 的輸入框
對焦時把整頁放大。**而這一輪沒有、也不可能驗到它:**

- 九張截圖全部是 **macOS 上的 headless Chrome**,沒有 iOS、沒有 Safari、沒有對焦行為
- 探針同樣是 Chrome,`getComputedStyle` 只會告訴我「font-size 是 16px」,
  **不會告訴我「iOS 因此不放大」**
- 我能證明的只有:**改完之後,390px 下 29 個控制項的 font-size 仍然全部是 16px**。
  那是「觸發條件不成立」的證據,不是「行為沒發生」的證據

**要一個真人拿 iPhone 打開網站、點進「加行程」的任何一個欄位,看版面會不會跳。**
最好在推上線之前做,因為那五個人就是在 iPhone 上記帳的。

---

## 實際結果

基準 `shots/pre-input-2`(14:47,HEAD `957d829`,工作樹乾淨,**與別人遞來的 `shots/label`
逐位元組相同**),對照 `shots/input`(15:31,同一個 HEAD,會烘進圖的未提交改動只有
`tokyo-trip/index.html` 一個,**相依工作樹 0 個**)。九張正向斷言全 `✓`。

`tokyo-trip/retro-modern.built.css` 重編後**沒有變動**(`git status` 裡看不到它),
`utilities` 層仍然是那 8 個 class ——「新增的是組件 class,不是 utility」成立。

### 逐張差異

| 圖 | 預期 | 實際 |
| --- | --- | --- |
| 01-plan-mobile | 零差異(容許已知雙穩態) | **逐位元組相同** ✓(落在穩定的那一側,沒有用到容許) |
| 02-plan-desktop | 零差異 | **逐位元組相同** ✓ |
| 03-cost-mobile | 零差異 | **逐位元組相同** ✓ |
| 04-split-mobile | 零差異 | **逐位元組相同** ✓ |
| 05-wishes-mobile | 零差異 | **逐位元組相同** ✓ |
| 06-map-sheet | 零差異 | **逐位元組相同** ✓ |
| 07-map-drawer | 零差異 | **逐位元組相同** ✓ |
| 08-addstop-form | 會變 | 350868 px / **18.6473%**,y=793..2089,31 群 |
| 09-edit-dialog | 會變 | 385115 px / **24.9169%**,y=275..1556,16 群 |

**七張零差異,而且是 `cmp` 驗的。**

### 對帳:預期清單 vs 實際

**命中 13 項,落空 0 項,清單外 3 項**(三項都在下面交代)。

量法:`WIDTH=390 ./probe.sh probes/inputs.js` 與 `WIDTH=1100 ...`,29 個欄位控制項。

| 預期項 | 實際量到的 | |
| --- | --- | --- |
| border 1px 冷灰 → 2px 深褐 | `1px solid rgb(221,225,234)`×29 → `2px solid rgb(83,68,61)`×29 | ✓ `#53443D` |
| background 純白 → 暖米 | `rgb(255,255,255)`×29 → `rgb(241,239,230)`×29 | ✓ `#F1EFE6` |
| color 近黑 → 暖褐 | `rgb(21,23,29)`×29 → `rgb(83,68,61)`×29 | ✓ |
| border-radius 7px → 8px | `7px`×29 → `8px`×29 | ✓(**過程中出過一個例外,見清單外第 1 項**) |
| `::placeholder` 變色 | `rgb(117,117,117)` → `rgb(154,142,132)` | ✓ `#9A8E84` |
| font-size 手機**不變** | `16px`×29 → `16px`×29 | ✓ **`:521` 贏了,Lulu 的決定生效** |
| padding 手機**不變** | `10px 11px`×29 → `10px 11px`×29 | ✓ |
| line-height 手機不變 | `24px`×21 / `normal`×8,前後相同 | ✓ |
| 欄位高度 +2px | `46`×9 / `48`×10 → `48`×9 / `50`×10 | ✓ 正好 +2,而且只來自框線 |
| `.fld` 整塊 +2px | `72`/`74` → `74`/`76` | ✓ |
| `input[type=number]` 維持等寬 | `ef-amount` / `xe-amount` 前後都是 `IBM Plex Mono` | ✓ `:430` 活著 |
| time/date 矯正沒被打壞 | 390px 下 `appearance:none`、`::-webkit-date-and-time-value` 的 `margin:0px` / `text-align:start` / `line-height:24px` **前後完全相同**(5 個) | ✓ 那個修過兩次的地方沒有退步 |
| time/date 的 font-family 仍是 `Noto Sans TC` | `Noto Sans TC`×5(另外 22 個變成宣告上的 `DM Sans`) | ✓ `:423` 的 `inherit` 贏了,如登記 |
| `.who` 核取方塊逐項不變 | `who核取方塊_逐個`(width / height / background / font-size / border / paintable)**前後完全相同**,兩個寬度都是 | ✓ 但有一個欄位有差,見清單外第 3 項 |

### 清單外的三項

#### 1. 對焦中的欄位圓角從 8px 掉到 4px —— **改完當場量到,已處理**

`index.html:53` 有一條全域 `:focus-visible{outline:2px solid var(--accent); outline-offset:2px; border-radius:4px;}`。

- **以前**:`.fld input`(0,1,1)蓋得過它。量到的證據是改動前 29 個欄位圓角**全部是 7px**,
  而其中 `xe-title` 當下是對焦狀態(`#exp-edit-overlay` 打開時 app 會 `focus()` 它)——
  **也就是說對焦以前不會改變欄位的形狀。**
- **改完**:`.rm-input` 也是(0,1,0),跟 `:focus-visible` 同特異度,而 `:53` 在原始碼後面 →
  對焦中的那一個量到 `4px`,其餘 28 個 `8px`。**「對焦會把圓角變小」是這一輪新長出來的行為。**

處理:加一條 `.fld .rm-input:focus-visible{border-radius:var(--radius-sm);}`(0,3,0)。
用 token 不用字面值,所以 design-system 改 `--radius-sm` 這裡還是跟著走。
改完重量:對焦中的 `xe-title` 回到 `8px`,29 個全 `8px`。

> 這一項是「刪掉一條規則,讓一條一直被遮住的宣告浮出來」—— 跟第三塊的 `.who label`
> 同一個形狀。**差別是第三塊那次是靠讀 CSS 想到的,這次是探針量出來的**:
> 我事前沒想到 `:focus-visible` 也設了 `border-radius`。

#### 2. 我事前寫「`:focus-visible` 這一輪驗不到」—— 這句是錯的,它就在 08 裡

切圖出來才發現:**08 的第一個欄位(時間)在截圖裡是對焦狀態**,
框線是 before 的**藍色 2px**(`--accent` `#24457E`)對 after 的**橘色 3px**(`#D54C15`)。

所以 `.rm-input:focus-visible`(0,2,0)蓋過 `:53`(0,1,0)這件事**有截圖證據**,
而且如果我沒有修掉上面第 1 項,那個 4px 圓角**也會出現在 08 裡**,
會被當成「清單外的差異」抓到。

**我事前把自己的涵蓋率報低了。** 記在這裡是因為它的方向雖然「安全」,
但一樣是事前登記不準 —— 而這一輪剛好因此差點放過一個真的回歸。

#### 3. `min-width` 從 `0px` 變成 `auto`(含 `.who` 核取方塊)

事前登記寫了「min-width `0px` → `auto`(行為上還是 0),**沒有效果**」,這對欄位成立。
**沒登記到的是 `.who` 核取方塊也跟著變**,所以「`.who` 逐項不變」這句嚴格說不成立 ——
它有一個 computed 值變了。

實際影響:零。同一支探針量到的 `offsetWidth` / `offsetHeight`
(核取方塊 10 個,390px 下 `28`×8 + `13`×2,高 `13`×10)**前後逐個完全相同**,
兩個寬度都是。column flex 的 `min-width:auto` 本來就算 0,跟量到的一致。

### 看得見嗎:非常看得見

`crop.py` 切出 08 / 09 的欄位區並排看過(左 before 右 after):

- **白底變暖米底**,一整塊面積,不是細線
- **框線從 1px 冷淺灰變成 2px 深褐**,粗一倍而且深很多,欄位的輪廓整個跳出來
- **placeholder(「淺草寺參拜」)從中性灰變成暖淺褐**
- `<select>`(「哪一天」)也一起變,原生下拉箭頭留著,坐在暖米底上
- 對焦框從**藍色 2px** 變成**橘色 3px**

**18.6% / 24.9% 這兩個數字跟第三塊(12.5% / 10%)不能直接比。**
第三塊的差異絕大部分是位移;這一塊**多了「整個欄位內部換底色」**,那是實心面積。
位移的部分反而比第三塊小(每欄 +2px,第三塊是 +3.9px)。
切了 08 的 y=1600..1960(表單下面的當日行程)確認過:那一段是**同樣的內容整片往下移**,
文字和圖示逐項相同 —— 位移,不是重新上色。

**「使用者看得出來嗎」這一欄:看得見,而且是這四塊裡最明顯的一次。**

### 桌機那一套(量到了,但九張都沒畫到)

| | 1100px 改前 | 1100px 改後 |
| --- | --- | --- |
| font-size | `14px`×29 | `15px`×29 |
| padding | `7px 9px` | `10px 14px` |
| line-height | `21px` | `22.5px`(1.5 × 15) |
| 欄位高度 | `37`×9 / `38`×7 / `39`×3 | `47`×16 / `49`×3 |
| `.fld` 整塊 | 63 / 64 / 65 | 72 / 73 / 74 |
| `::-webkit-date-and-time-value` 的 line-height | `21px` | `22.5px` |

最後一列是唯一一個「time/date 矯正」在 1100px 下前後不同的值,
而它只是 `line-height:1.5` 乘上變大的字級 —— `margin` / `text-align` / `appearance`
三項一字未動。390px 下連這一項都完全相同。

**這一整段沒有任何一張截圖驗過。** 九張裡的兩張桌機圖(02 / 07)沒有打開任何表單。

### 沒有驗到的事(講清楚)

- **iOS 對焦放大:這一輪完全沒有驗證。** 見上面那一節。我能證明的只有
  「390px 下 29 個控制項的 font-size 改完仍然全部是 16px」,那是**觸發條件不成立**的證據,
  不是**行為沒發生**的證據。**需要真人拿 iPhone 點進欄位確認。**
- 29 個欄位裡截圖只畫得到 **9 個**(08 的 4 個 + 09 的 5 個)。其餘 20 個只有 computed 值。
- **JS 產生的 `rn-*` 欄位**(`index.html:2864`,改名欄位)載入時不在 DOM,
  探針量到的 29 個不含它。它只有 markup 上的 class,**完全沒被驗過**。
- `.who` 核取方塊 10 個只有探針驗過,`#exp-form` / `#exp-edit-overlay` 九張都沒開過。
- 桌機那一整套值(上一節)沒有任何截圖。
- `:focus-visible` 只在 08 的**第一個**欄位驗到,`<select>` 和 number 欄位的對焦沒驗到。
- 全部是 macOS + headless Chrome。**沒有真實 iOS / Safari。**
- 沒有測 Google Fonts 載入失敗時的樣子。
- 沒有測 DM Sans 真的被載進來之後會怎樣(見上面 time/date 分家那段的風險登記)。

---

## 新踩到的陷阱

### 1. `01-plan-mobile` 是雙穩態的,而那個差異長得跟「我改壞了」一模一樣

**症狀:同一個乾淨工作樹連跑兩次 `shoot.sh`,01 得到兩張不同的圖,
差 2.1481%,全部落在 `y=454..651`(日期橫條那一列),`pngdiff` 說「切成 1 群」。**

三次量測:`shots/label`(別人遞來的)= `shots/pre-input-2`(我第二次)≠ `shots/pre-input`(我第一次)。
**跳掉的是中間那一次**,所以「別人遞來的基準壞了」這個第一直覺是錯的。

用 `pngdiff.load()` 逐列做水平位移搜尋,在 **-27 影像像素(= -13.5 CSS px)**
的位移上兩張**完全相同**(平均差 0.0)。所以它不是重繪,是**整條日期橫條被捲到不同位置**。

根因(`probes/dayscroll.js` 量的):

```
renderDays() 的最後一行  cur.scrollIntoView({block:"nearest", inline:"center"})
實際 scrollLeft          102
用現在的度量重算         88        ← 對不上
反推當初算的時候卡寬     106.8     ← 現在是 101
```

`scrollIntoView` 算出來的 `scrollLeft` 取決於**算的那一刻每張日卡多寬**,
而日卡寬度取決於 Noto Sans TC 載完了沒:**沒載完 = 用後援字體的度量(卡片 ~107px)**,
載完之後卡片縮到 101px,**但 `scrollLeft` 不會重算**。
所以 102 這個值是「用舊度量算的」,88 才是「用現在的度量算的」。
偶爾字體先贏那場賽跑,就得到另一張圖。

> **這不只是工具的問題,使用者也會遇到**:第一次造訪(字體要下載)和之後造訪
> (字體在快取裡)看到的橫條起始位置不一樣。只是沒有人會注意到。

**沒有修,而且是刻意的:** 兩個狀態都是使用者真的會看到的狀態,
要「修」就得讓 harness 在字體載完之後強制重捲一次 —— 那會改掉 01 這張圖本身,
**讓前面每一組基準都不能再比**,代價遠大於收益。登記在 `ADOPTION.md` 的非決定性來源表裡。

**下一個人遇到它時的判準**:01 的差異如果剛好是
`2.1481%` / `y=454..651` / **1 群** / 水平位移 27,就是這件事,重截一次會回到相同;
**任何其他形狀的差異都要當成問題查。**

### 2. `shoot.sh` 和 `probe.sh` 每一次成功收工都回傳 **1**

```sh
trap 'rm -rf "$LOCK"; [ -n "${SRV:-}" ] && kill "$SRV" 2>/dev/null; true' EXIT INT TERM
```

**`set -e` 在 trap 裡面照樣有效**,而 `[ ] && kill` 是一個複合句 ——
`kill` 失敗時整句失敗,trap **在那裡中止**,末尾那個 `; true` 根本沒跑到,
腳本於是成功做完事情卻回傳 1。

`shoot.sh` 正常結束前會先 `kill $SRV 2>/dev/null || true`,
所以 trap 跑到的時候那個 pid **一定**已經死了 —— 也就是說它**每一次成功都回傳 1**。
沒有人發現,是因為兩支的輸出一路都被 `| tail` 之類的東西接走,退出碼從來沒被看過。

後果:任何 `./shoot.sh a && ./shoot.sh b`、或 CI 上的 `set -e`,都會在第一支之後停住,
而且訊息會說「截圖失敗」——**它明明成功了**。

**已修**,兩支都改成 `if ... then kill ... || true; fi`。
驗證:`./probe.sh probes/dayscroll.js >/dev/null 2>&1; echo $?` → `0`;
`./shoot.sh input` 最後印 `shoot exit=0`。

> **這是 `block-03-label` 修過的同一個坑,在同一個檔案裡,距離三行。**
> 那一輪在 PROVENANCE 那個區塊踩到 `&&` 當最後一句 + `set -e`,寫進了註解
> (「注意 `&&` 不能是這個區塊的最後一句」),**然後沒有回頭看三行外的 trap。**
> 而且這次還多一層:那一輪的結論是「補 `; true` 就好」,
> **實測補了 `; true` 也擋不住** —— `set -e` 是在 `true` 之前就中止的。

### 3. `probe.sh` 以前只量得到桌機

原本硬編碼 `width:1100px`。**九張截圖裡有七張是 390px**,包含這一塊的主角 08 / 09,
而 `index.html` 有一整段 `@media (max-width:640px)` 的覆寫 ——
**在 1100px 量到的是那七張根本看不到的那一套值。**

這一塊要驗的核心(「`:521` 的 16px 有沒有守住」)在 1100px 上量**永遠是 14px**,
會得到完全相反的結論。

已加 `WIDTH=` 環境變數(預設仍是 1100)。這一輪每一項都量了 390 和 1100 兩次。

---

## 下一塊的建議

沒有強烈推薦的一塊,但有三件事已經排好順序:

1. **`.who` 那一整組**(成員膠囊 `label` + 核取方塊 `input`)。它現在是**兩輪各凍一次**
   的舊樣子,而且其中 `width:100%` 把原生核取方塊撐寬一倍,**看起來就是個意外**。
   **但動它之前一定要先讓截圖看得到它** —— 九張沒有一張打開過 `#exp-form`
   或 `#exp-edit-overlay`。現在 `probes/inputs.js` 已經會用真實點擊打開那兩個容器了,
   要加一張截圖不難(`shoot.sh` 加一行 `shot 10-exp-form 390 1200 "...add-exp-btn..."`)。
   **「先補一張截圖」本身就可以當成一塊。**
2. **字型** —— `ADOPTION.md` 說排最後。提醒:它會把 `--font-sans` 的 DM Sans 真的載進來,
   那時 `[type=time]` / `[type=date]` 會因為 `:423` 的 `font-family:inherit` 跟其他欄位分家。
3. `.btn` → `rm-btn` 仍然太大(九張全會變、七個變體)。
