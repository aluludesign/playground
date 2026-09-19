# 接上 design-system —— 進行中的工作怎麼接手

這份寫給**沒有任何上下文的人**。`DECISIONS.md` 記的是已經定案的決定,這份記的是
「還沒做完的事、工具怎麼用、以及前一個人踩過哪些坑」。

工作內容:把 `tokyo-trip/index.html` 的樣式**逐塊**換成 `../design-system/` 的組件。
Lulu 要的是「網站真的變成 retro-modern 的樣子」,不只是色調統一。

---

## 現在做到哪

| 狀態 | |
| --- | --- |
| ✅ 移除深色模式 | `ef364ce`,已上線 |
| ✅ 309 條 CSS 包進 `@layer components` | `e890cf0`,視覺零改變 |
| ✅ 接線(載入 design-system) | `b43a2f7`,視覺零改變 |
| ✅ 第一塊:`.chip` → `.rm-chip` | `c43340e`,只有花費頁變 |
| ⏸ `--font-mono` 缺 CJK fallback | 已回報,等 design-system 修 |
| ⏸ 第二塊 | 還沒挑 |
| ⏸ 字型 | **排最後**,見下 |

### 線上現在是什麼

`origin/main` = `e890cf0`。**已經上線的**:移除深色模式、`@layer components` 包裝、
日誌修正。**還沒推的**:接線(`b43a2f7`)和第一塊(`c43340e`),以及 design-system 那邊的幾個。

所以那五個人看到的是**移除深色之後、接線之前**的版本 —— 淺色、但還沒載入 design-system,
花費頁的分類標籤還是舊的。

> **「未推送 N 個」不等於「什麼都沒推」。** 我一度把「有 7 個未推送」記成「什麼都沒推」,
> 而那會讓人對「現在線上是什麼」整個錯位 —— 那是判斷任何事情的起點。
>
> 要知道線上有什麼,**不要從未推送清單反推**,直接問:
>
> ```sh
> git merge-base --is-ancestor <commit> origin/main && echo 已上線
> curl -s https://playground-beta-liart.vercel.app/ | grep -o "color-scheme:[^;]*;"
> ```

**推不推是 Lulu 的決定,不是接手的人的。**

### 下一步的順序

1. 等 design-system 修好 `--font-mono` 的中文 fallback。**那個修法會改變 `.rm-chip` 上中文的長相**,要自己驗一輪(預期差異事前登記)
2. 挑第二塊。判準見「怎麼挑一塊」
3. 字型**最後才做**。理由:字型一換,九張截圖全部不一樣;排在前面的話,後面每一塊
   都是在一個剛剛大幅變動過的基準上比對。排最後,前面每一塊都還能跟乾淨的基準比

---

## 工具:`../adopt-harness/`

> 它在 repo 裡(`playground/adopt-harness/`),但**不在 Vercel 的部署範圍**
> (Vercel 的 Root Directory 是 `tokyo-trip/`)。
>
> 它原本放在 repo 外面。搬進來的理由:換手之後沒有人重建得出它 ——
> 裡面每一行幾乎都是踩到坑之後補的,從零寫一份不會長這樣。

```
shoot.sh        逐頁截 9 張圖(手機 + 桌機)
fixture.py      固定的假資料 + 凍結時鐘
pngdiff.py      逐像素比對,回報差異位置
wrap-layer.py   一次性的,把內嵌樣式包進 @layer components(已經用過了)
shots/          產出,不進版控(3.5MB,每輪重生)
block-01-chip.md  第一塊的預測清單 + 實際結果,可以當範本
```

用法:

```sh
cd <repo>/adopt-harness          # 注意:是 repo 根目錄,不是 tokyo-trip/ 底下
./shoot.sh <標籤>                 # 截一組,放進 shots/<標籤>/
python3 pngdiff.py shots/a/01-plan-mobile.png shots/b/01-plan-mobile.png
```

> 為什麼放在 repo 根目錄而不是 `tokyo-trip/adopt-harness/`:
> **Vercel 的 Root Directory 就是 `tokyo-trip/`**,放進去會把這套工具
> 一起部署到正式站。放在根目錄,它在版控裡但不在部署範圍。

`shoot.sh` 會**自動先重編** design-system 的產出,不用手動跑 build。

---

## 工具的陷阱(全部是踩出來的)

### 1. 它截的是「工作目錄現況」,不是某個 tag

**症狀:比對永遠通過。**

我做過一次:改完 `index.html` 之後才想到要截基準,結果截出來的「基準」是改動後的版本,
拿去跟改動後比,當然零差異。

**要截某個 commit 的樣子,先 `git stash` 你的改動。**

每組截圖旁邊有 `PROVENANCE.txt`,記了截圖當下的 HEAD、工作樹有幾個檔沒提交、stash 幾筆。
事後回頭看得出這批是站在哪裡截的。

### 2. 時鐘要凍,而且凍的方式本身會把 app 弄壞

出發倒數(「還有 N 天」)顯示在**每一頁**的標題列。跨過午夜,九張全部「有差異」。
我第一次撞到的時候,一度以為是別人改壞的。

`fixture.py` 把時鐘凍在 `2026-09-19T03:00:00Z`。

**但我第一版的凍法把整個 app 弄壞了:**

```js
function K(){ return arguments.length ? new D(arguments[0], arguments[1], ... arguments[6]) : new D(F); }
```

固定傳七個參數,所以 `new Date(ms)` 變成 `new Date(ms, undefined, ...)` —— 那是多參數
建構式,結果是 Invalid Date。`todayISO()` 一掛,開機就停住。

**症狀:每一頁都一致地空白,而截圖比對照樣報零差異。**

正確的寫法是原樣轉交:`Reflect.construct(D, arguments)`。

### 3. 非決定性來源

| 來源 | 症狀 | 怎麼消掉的 |
| --- | --- | --- |
| 過場動畫 | 分頁切換的指示條被截在不同位置 | 截圖時注入 `transition:none;animation:none` |
| 地圖圖磚 | 地圖區大片差異 | 外部圖磚換成 1px 佔位 |
| 時鐘 | 見上 | 凍結 |

前兩個都只影響「變化過程」和「外部資源」,不影響我要驗的版面。

---

## 最貴的一個教訓

**差異式檢查對「兩邊都是空的」完全無感。**

工具壞掉的那次,每一頁都一致地空白,九張比對全綠。我還跑了「同一狀態連跑兩次完全相同」
來證明工具是決定性的 —— **它確實是決定性的,只是決定性地壞掉。**

> **決定性是必要條件,不是充分條件。**

而且因為這個,我的假資料裡三筆花費**從來沒渲染出來過**,花費那頁在前幾輪一直是空白的。
接線那輪的結論沒有錯(其他八張是實的),但覆蓋率比當時報的低。
**結論對和驗證夠強是兩件事。**

### 補救:正向斷言

每張圖另外附一條「這一頁至少要有這些東西」,絕對式的,不依賴任何基準:

| 畫面 | 斷言 |
| --- | --- |
| 01 / 02 行程 | `.stop` ≥ 3 |
| 03 花費 | `.exp` ≥ 3、`.rm-chip` ≥ 3、`.catrow` ≥ 2 |
| 04 分帳 | `.fp` ≥ 5 |
| 05 許願 | `.wish` ≥ 3 |
| 06 / 07 地圖 | `.map .pin` ≥ 2 |
| 08 加行程 | `#stop-form input` ≥ 3 |
| 09 編輯 | `#edit-form input` ≥ 3 |

> ⚠ **這段程式碼寫好了但還沒跑過一次完整的。** 我在驗證它的時候 session 被中斷。
> 接手的人第一件事請先跑 `./shoot.sh test` 確認九張都印 `✓ 有內容`,
> 有任何一張印 `✗` 或 `?`,先修工具再往下做。

---

## 驗收規則

**兩套規則,看那一輪該不該改變外觀。**

### 不該改變外觀的輪(包 layer、接線)

零差異。**任何非零一律當成問題查,不准先歸因到任何已知效應。**

「帶著預期去驗收」會讓第一反應變成歸因而不是追查,那就毀掉驗收的意義。

### 該改變外觀的輪(每一塊轉換)

零差異反而代表沒生效。所以:

1. **動手前**先寫下預期會產生哪些視覺變化,逐項寫進 `block-NN-*.md`
2. 比對後,把實際差異逐一對到清單上
3. **清單外的差異是問題**,不管看起來多合理
4. **清單上有、但實際沒出現的也是問題** —— 那代表你以為會生效的東西沒生效

第 4 點容易被忽略。前面幾輪一直在防「不該變的變了」,轉換開始之後要同時防「該變的沒變」,
而後者在 CSS 裡一樣不報錯。

已知且無法消除的差異,要在**該輪開始之前**登記。事前登記和事後歸因看起來像同一件事,
但前者可以被檢驗、後者不能。

`block-01-chip.md` 是完整的範本:為什麼挑這塊、預測表、實際結果、偏離的解釋。

---

## 怎麼挑一塊

- **最小、最獨立、最容易單獨看到**
- **而且 design-system 裡要有語意對得上的組件**

第二個判準比第一個重要。挑一塊在 design-system 裡沒有對應組件的,就會變成
「用 utility 手工拼出一個外觀」—— 那驗不到我們要驗的東西(組件在真實頁面上長得對不對)。

實例:第一塊挑 `.chip` 是因為 `rm-chip` 跟它一對一。排除 `.cloudbar` 是因為
最接近的 `rm-toast` 是**浮在角落的提示**,語意不對。

可用的組件(`design-system/retro-modern.css` 的 `@layer components`):

```
rm-base  rm-btn(--action/--cta/--ghost/--lg/--secondary/--sm/--steel)
rm-card(--arch/--expressive/--raised/--surface)  rm-chip(--accent/--solid)
rm-day-pin  rm-divider(--dashed)  rm-input  rm-label  rm-overline
rm-row  rm-stack  rm-toast
```

---

## 約束

### 不要用 opacity modifier

`bg-paper/50`、`text-ink/70` 這一類。它們編出來是 `color-mix`,**在 iOS 16.3 以下
整條宣告無效** —— 不報錯,背景就是不上色。

Lulu 對 iOS 版本的答覆是「以最新版為主」,那是**假設不是事實**(她沒有去問那四個人)。
避開這類 utility 就避開了這個假設的主要暴露面。需要半透明就用明確色值或自己的 `:root` 變數。

### `<link>` 必須在 `<style>` 之前

不是保險,是**必要條件**。兩邊的組件都在 `components` 層,同層之內比特異度再比原始碼順序,
**後載入的贏**。design-system 先載入,`.card` 才蓋得過 `.rm-card`。

反過來的話它的組件會開始無聲蓋掉這邊寫好的東西。

### `:root` 留在 `@layer components` 外面

自訂屬性一旦進了層,任何無層級的 `:root` 都蓋得過它。留在外面就永遠是這邊說了算 ——
那也是之後想覆寫 design-system 某個 token 時唯一有效的位置。

### 改 markup 之後一定要重編

Tailwind 是 content-driven,掃 `tokyo-trip/` 決定編出哪些 utility。
用了新 class 沒重編 = 那個 class 不存在 = 樣式安靜消失。

**已經做進 `shoot.sh` 了**,截圖前自動重編,不是人要記得的事。

---

## 已登記的盲區

產出的 `utilities` 層有 8 個 class:

```
block  ease-out  filter  hidden  inline  resize  sticky  transform
```

**沒有一個是 markup 在用的。** 掃描器從 CSS 屬性值、JS 字串、**甚至中文註解**裡撿出來的:
`padding-block`、`position:sticky`、`cursor:col-resize`、`backdrop-filter`、
還有註解裡寫的「用 clip 不用 hidden」。

**後果:這 8 個名字不受「忘了重編」偵測保護。** 哪天想拿其中一個當 utility 用
(例如 `class="hidden"`),它早就在產出裡了,忘記重編也不會被抓到。

不修:為了 8 個常見字去調掃描規則,成本高於收益。詳見 `app.css` 的註解。

---

## 走鐘防護

`index.html` 裡有一段:檢查「頁面上用到、但沒有任何 CSS 規則提到的 class」,
也檢查產生檔有沒有載到。

**正式站完全不出聲**(只寫 console),localhost 和 `file://` 才跳橫幅 ——
那五個人不該看到我們的工程訊息。

`brand` 和 `panel` 在忽略名單裡,它們是純標記用的 class,沒有樣式也沒有 JS 用到。

---

## 多 session 協調規則

這個 repo 同時有別的 session 在動(`design-system/` 由另一隻負責),共用**同一個工作樹**。

- **提交前先問協調者**(`playground-8b`)。編輯可以並行,提交不行
- **逐檔 `git add`,不要用 `-A` 或 `.`** —— 會把別人手上的檔案掃進去。
  我實際遇過一次:協調者放行時說工作樹只有我的檔,我 add 之前重讀,
  發現另一隻已經落盤了兩個檔。**放行不等於工作樹狀態的保證,自己重讀。**
- **`DECISIONS.md` 一次只有一隻能寫**,要先拿鎖
- **一輪轉換進行中,design-system 凍結**。相依一動,差異就無法歸因。
  開始一塊之前跟協調者說,做完回報才解凍
