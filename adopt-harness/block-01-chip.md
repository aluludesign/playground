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
| font-family 換成 mono | `"IBM Plex Mono", ui-monospace, …` | ⚠ 疑慮成立,見下 |

### 兩個偏離

**1. `display` 是 `flex` 不是 `inline-flex`** —— 不是 bug,是我漏算了 CSS 規則:
`.exp .hd` 是 flex 容器,**flex 項目的 `inline-flex` 會被 blockify 成 `flex`**。
組件宣告的是 `inline-flex`,瀏覽器照規範改的。視覺上沒有影響(單行文字)。

**2. mono stack 沒有中文字體 —— 事前登記的疑慮成立。**
`--font-mono` 是 `JetBrains Mono, IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace`,
**整串沒有任何 CJK 字體**。標籤內容是中文(景點、餐飲、交通),所以中文字會
fallback 到瀏覽器對這些碼位的預設,跟頁面其他中文(Noto Sans TC)不同一套。

實際看起來沒有壞掉,但字重和字距明顯不一樣。這是 design-system 的問題,不是我的用法問題 ——
它的 `--font-sans` 有 `'Noto Sans TC', 'PingFang TC'` 的 fallback,`--font-mono` 沒有。
已回報。
