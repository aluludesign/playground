# 第一塊:.chip → .rm-chip

## 為什麼挑它
- **最小**:只有一個元素,花費列裡的分類標籤(交通／餐飲…),由 JS 產生
- **最獨立**:`.chip` 只被這一處用到,沒有其他東西依賴它
- **有對應組件**:`rm-chip` 跟它是語意上的一對一。相較之下 `.cloudbar` 在
  design-system 裡沒有對應(最接近的 `rm-toast` 是浮在角落的提示,不是行內狀態條)

## 做法
markup `class="chip cat"` → `class="rm-chip cat"`;刪掉 `.chip` 基底規則。
保留 `.cat`(透明邊框 + 白字),因為「每個分類一個顏色」是這個 app 的事,
`rm-chip--solid` / `--accent` 都是固定色,表達不了。分類色仍由行內 style 帶。

## 預期的視覺變化(事前登記)

| 屬性 | 現在 | 之後 | 預期 |
| --- | --- | --- | --- |
| font-size | 10.5px | 0.6875rem = 11px | 微幅變大 |
| padding | 1.5px 7px | 0.25rem 0.75rem = 4px 12px | **明顯變大**,標籤變寬變高 |
| font-weight | 繼承(400) | 700 | **變粗** |
| font-family | 內文字體 | `--font-mono` | **換字體** ← 見下面的疑慮 |
| line-height | normal | 1.5 | 變高 |
| display | inline | inline-flex | 對單行文字應該看不出來 |
| border-radius | 20px | `--radius-pill` | 這個高度下兩者都是膠囊,應該看不出來 |
| background | 行內分類色 | 同左(行內贏) | **不變** |
| color | #fff(`.cat`) | 同左(`.cat` 同層後載入贏) | **不變** |
| border-color | transparent(`.cat`) | 同左 | **不變** |
| white-space | nowrap | 沒有了 | 分類名都是兩個字,應該不會斷行 |

## 連帶影響
padding 和 line-height 變大會把**整列花費撐高**,所以 `03-cost-mobile` 的
diff 會從標籤一路往下延伸。那是預期的,不是版面壞掉。

## 一個我預期會出問題的地方
`--font-mono` 是 `JetBrains Mono, IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace`
—— **整串沒有任何中文字體**。而標籤內容是中文(交通、餐飲、住宿…)。
所以中文會 fallback 到系統預設等寬字體,跟頁面其他中文長得不一樣。
如果成立,這是 design-system 的問題(它的 mono stack 對中文沒有準備),要回報。

---

## 實際結果(比對後)

**範圍**:只有 `03-cost-mobile` 變(2.65% 像素),其他八張**逐位元組相同**。符合預期。

| 預測 | 實測 | |
| --- | --- | --- |
| font-size 11px | 11px | ✅ |
| padding 4px 12px | 4px 12px | ✅ |
| font-weight 700 | 700 | ✅ |
| line-height 1.5 | 16.5px(= 11 × 1.5) | ✅ |
| border-radius 膠囊 | 9999px | ✅ |
| background 分類色不變 | rgb(0,153,68) 綠 = 景點 | ✅ |
| color 白字不變 | rgb(255,255,255) | ✅ |
| border-color 透明不變 | rgba(0,0,0,0) | ✅ |
| white-space 沒了 | normal | ✅ |
| 整列撐高 | 標籤 48×27,整列跟著變高 | ✅ |
| display inline-flex | **flex** | ⚠ 見下 |
| font-family 換成 mono | `"IBM Plex Mono", ui-monospace, …` | ⚠ 症狀成立,但**歸因原本寫錯了**,見下 |

### 兩個偏離

**1. `display` 是 `flex` 不是 `inline-flex`** —— 不是 bug,是我漏算了 CSS 規則:
`.exp .hd` 是 flex 容器,**flex 項目的 `inline-flex` 會被 blockify 成 `flex`**。
組件宣告的是 `inline-flex`,瀏覽器照規範改的。視覺上沒有影響(單行文字)。

**2. mono stack 沒有中文字體 —— 症狀成立,但這裡原本把它歸錯了對象。**

> **這一段是更正。** 原文寫的是「`--font-mono` 是
> `JetBrains Mono, IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace`,
> 整串沒有任何 CJK 字體……這是 design-system 的問題」。
>
> **症狀是真的,歸因的位置是錯的。** 左邊實測欄自己寫著
> `"IBM Plex Mono", ui-monospace, …` —— **開頭沒有 `JetBrains Mono`**,
> 那根本不是 design-system 的 stack,是 **tokyo-trip 自己的**。
>
> 這個錯誤歸因害整條線繞了一大圈:有人照著去修了 design-system 的 `--font-mono`
> (`7214658`),重編之後九張截圖零差異 —— 因為那個 token 從來沒有到達任何元素。

### 怎麼分辨這個 computed 值是誰的 stack

`--font-mono` 這個名字**兩邊都有**,而且值長得很像(都以 mono 家族開頭、都以
`monospace` 收尾)。看 computed `font-family` 的時候,**只看第一個名字**:

| computed 開頭 | 是誰的 | 從哪來 |
| --- | --- | --- |
| `"JetBrains Mono"` | design-system | `retro-modern.built.css` 的 `@layer theme` |
| `"IBM Plex Mono"` | **tokyo-trip** | `tokyo-trip/index.html:30`,**無層級的 `:root`** |

**為什麼永遠是 tokyo-trip 贏:**`@layer` 的規則是「有層級的一律輸給無層級的」。
design-system 的 `--font-mono` 住在 `@layer theme` 裡,tokyo-trip 的住在無層級的
`:root` 裡 —— 特異度一樣、原始碼順序 tokyo-trip 也在後面,但**就算順序反過來也一樣**,
因為無層級勝出跟順序無關。

那個覆寫是**刻意的**,`ADOPTION.md` 的「`:root` 留在 `@layer components` 外面」寫了理由:
它是「之後想覆寫 design-system 某個 token 時唯一有效的位置」。
**它同時是保護傘也是阻礙** —— 保護 tokyo-trip 不被 design-system 的 token 無聲改掉,
也擋住 design-system 對同一個 token 的修正。

**下一個人會再踩的地方,三條:**

1. 看到 computed 出來是 mono,不要就寫成「design-system 的 mono」。
   **先比對第一個字體名**,那唯一決定了是誰的 stack
2. 要知道某個 token 現在是誰說了算,不要讀 CSS 猜,直接在真實 DOM 上問:
   `getComputedStyle(document.documentElement).getPropertyValue('--font-mono')`
3. **在「該改變外觀的輪」裡,零差異就是沒生效**,不要當成好消息。
   `7214658` 重編之後零差異,那是 token 沒到達的證據,不是「修好了而且很安全」

### 症狀本身仍然成立,而且是這一塊造成的回歸

`.rm-chip` 上那三顆中文分類標籤(景點／餐飲／交通)用的是
`"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace` —— 整串沒有 CJK,
中文 fallback 到瀏覽器對這些碼位的預設,跟頁面其他中文(Noto Sans TC)不同一套。

**這是第一塊造成的回歸**:轉換前 `.chip` 沒設 `font-family`,中文繼承本文;
轉換後 `.rm-chip` 用 `--font-mono`,中文就掉出去了。

站上另外 18 處用 mono 且含中日文的地方(出發倒數的「天」、航班板、金額說明)
**在 design-system 進場前就已經是這樣**,不是回歸,是既有狀態。

修法見 `block-02-mono.md`:在 `tokyo-trip/index.html:30` 自己的 `--font-mono`
補中文後援。**不是**刪掉覆寫讓 design-system 接手 —— 那會把站上每個 mono 的拉丁字和
數字都從 IBM Plex Mono 換成 JetBrains Mono,血量大得多。
