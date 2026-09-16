# 東京五人行

2026/10/03 – 10/09 東京六日遊的行程、花費與分帳。

資料存在 **Notion**,網站是讀寫它的介面 —— 手機上用網站記帳,Notion 裡看表格、排序、做視圖,兩邊同一份資料。

看不需要通行碼,要動資料才需要(見「誰能改」)。

- Notion 頁面:<https://natural-darkness-9f1.notion.site/tokyotrip>
- 網站:部署到 Vercel 後就有網址(見下方設定)

## 為什麼需要後端

Notion API 不接受瀏覽器直接呼叫(沒有 CORS),而且需要一組密鑰 —— 密鑰放前端等於公開。
所以 `api/notion.js` 這支 serverless function 擋在中間:它拿著密鑰,網站只跟它說話。

```
瀏覽器  →  /api/notion  →  Notion API
           (密鑰在這)
```

## 內容

| 分頁 | 做什麼 |
| --- | --- |
| 行程 | Day 1–6 時間軸,航班節點已固定釘上,其餘自行新增 |
| | 旅行期間預設停在今天那一格,過去的日子會反灰(照樣點得進去) |
| | 管理員長按行程那一列(哪裡都行),整列會浮起來變一張卡片,拖去別的位置 —— 時間排不進去時會問要改成幾點 |
| | 管理員按 `✎` 可以改時間／名稱／地點／備註 |
| 花費 | 總額、每人平均、分類佔比、逐筆明細(日圓／台幣雙幣別) |
| 分帳 | 每人已付／該付／淨額,以及最少轉帳次數的結清清單 |

## 設定(一次性)

**1. 建 Notion integration**

到 <https://www.notion.so/my-integrations> → New integration,
取個名字(例如 `tokyo-trip`),Type 選 **Internal**,建立後複製 **Internal Integration Secret**。

**2. 把頁面分享給它**

打開 Notion 的「東京五人行」頁面 → 右上 `⋯` → **Connections** → 加入剛建的 integration。
兩個資料庫在這頁底下,會一起繼承權限。

**3. 部署到 Vercel**

<https://vercel.com> 用 GitHub 登入 → Add New Project → 選 `playground` repo。
**Root Directory 要設成 `tokyo-trip`**(不然找不到 `api/`)。

Environment Variables 加兩個:

| Name | Value |
| --- | --- |
| `NOTION_TOKEN` | 第 1 步複製的密鑰 |
| `TRIP_KEY` | 自己訂一組通行碼,給另外四個人 |

Deploy。之後每次 push 都會自動重新部署。

> `TRIP_KEY` 一定要設。沒設的話後端會拒絕所有寫入(回 503),
> 網站變成純看板 —— 這是刻意的,沒設定不等於不設防。

## 誰能改

進站時會問你走哪一條:

| | 看行程／花費／分帳 | 新增、刪除、改名字 |
| --- | --- | --- |
| **直接進入** | ✅ | ❌ |
| **管理員**(輸通行碼) | ✅ | ✅ |

通行碼對了之後這台裝置就記住了,下次直接進管理員模式;
狀態列的「登出」會忘掉它。想中途升級成管理員,按狀態列的「管理員登入」。

擋在後端:`GET` 開放,`POST`／`DELETE` 一定要 `x-trip-key`。
前端把按鈕藏起來只是順手,真正說不行的是 `api/notion.js`。

> 通行碼只是擋住路過的人,不是強加密,而且讀是公開的。
> 別把 Vercel 網址貼到公開的地方就好。

## 檔案

- `index.html` — 網站本體(單一檔案,含樣式與邏輯)
- `api/notion.js` — Notion 代理,密鑰只存在這裡的環境變數
- `config.js` — 匯率、API 位置
- `vercel.json` — 部署設定
- `data/trip.json` — 機票訂單的結構化備份,給人看的,網頁不會讀它

## 匯率

預設 **1 JPY = 0.21 TWD**,寫在 `config.js`。這是五個人共用的版本,
要改就改那裡然後 commit,同時把 Notion「花費紀錄」的「台幣金額」公式一起改掉。

## 沒設定的時候

連不上後端時網站會退回離線模式:紀錄只存在自己的瀏覽器,頁尾可以匯出／匯入 JSON。
GitHub Pages 上的那份沒有後端,永遠是離線模式。

## 已知的基本資料

- 樂桃 MM626 台北桃園 T1 10:50 → 東京成田 T1 15:20(10/03 六)
- 樂桃 MM631 東京成田 T1 21:50 → 台北桃園 T1 00:40(10/08 四 → 10/09 五)
- 訂單 PTETF3,來回機票 NT$61,100,Chinhui 付,五人均分(每人 NT$12,220)
- 五位旅客:HSIEH CHINHUI／CHANG CHIAYU／CHANG CHIHWEI／CHANG YALUN／CHEN SUCHIH
- 座位 27A 27B 27D 27E 27F,每人託運 1 件、手提 2 件合計 7kg
