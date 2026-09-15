# 東京五人行

2026/10/03 – 10/09 東京六日遊的行程、花費與分帳紀錄。

網站是純靜態的,放在 GitHub Pages;**花費資料存在 Supabase,不在這個公開 repo 裡**,要登入才看得到。

- 網址:`https://aluludesign.github.io/playground/tokyo-trip/`
- 或直接用瀏覽器開 `index.html`

## 內容

| 分頁 | 做什麼 |
| --- | --- |
| 行程 | Day 1–6 時間軸,航班節點已固定釘上,其餘自行新增 |
| 花費 | 總額、每人平均、分類佔比、逐筆明細(日圓／台幣雙幣別) |
| 分帳 | 每人已付／該付／淨額,以及最少轉帳次數的結清清單 |

## 接上雲端(一次性設定)

沒設定的話網站會用離線模式,紀錄只存在自己的瀏覽器。要五個人共用同一份資料:

**1. 開一個 Supabase 專案**

到 [supabase.com](https://supabase.com) 註冊,建立新專案(免費方案足夠)。

**2. 建資料表**

專案左側 **SQL Editor** → New query → 把 `supabase-setup.sql` 整份貼上 → Run。
這會建三張表(expenses / stops / settings)、設好權限、開啟即時同步,並塞入機票那筆紀錄。

**3. 建共用帳號**

左側 **Authentication** → Users → Add user → 填一組大家共用的 email 和密碼,
記得勾 **Auto Confirm User**(不然要收驗證信)。

**4. 填連線資訊**

左側 **Settings → API**,把兩個值填進 `config.js`:

```js
window.TRIP_CONFIG = {
  supabaseUrl: "https://xxxxxxxx.supabase.co",   // Project URL
  supabaseAnonKey: "eyJhbGci...",                 // anon / public key
  trip: "tokyo-2026",
};
```

commit 推上去就生效。

> anon key 放在前端是 Supabase 的正常設計,公開沒關係 —— 真正的門鎖是資料表的 RLS 政策:
> 沒登入的人對三張表完全讀不到。**帳號密碼不要寫進任何檔案**,口頭或私訊給另外四個人就好。

**5. 大家開網站登入**

第一次開會跳登入框,輸入共用帳號密碼。之後這台裝置會記住,不用再登入。
任何人記一筆,其他人的畫面會即時更新。

## 檔案

- `index.html` — 網站本體(單一檔案,含樣式與邏輯)
- `config.js` — Supabase 連線設定,**要自己填**
- `supabase-setup.sql` — 資料表結構與權限,貼進 Supabase 跑一次
- `data/trip.json` — 機票訂單與旅客資料的結構化備份,給人看的,網頁不會讀它

## 已知的基本資料

- 樂桃 MM626 台北桃園 T1 10:50 → 東京成田 T1 15:20(10/03 六)
- 樂桃 MM631 東京成田 T1 21:50 → 台北桃園 T1 00:40(10/08 四 → 10/09 五)
- 訂單 PTETF3,來回機票 NT$61,100,Chinhui 付,五人均分(每人 NT$12,220)
- 五位旅客:HSIEH CHINHUI／CHANG CHIAYU／CHANG CHIHWEI／CHANG YALUN／CHEN SUCHIH
- 座位 27A 27B 27D 27E 27F,每人託運 1 件、手提 2 件合計 7kg
- 預設匯率 1 JPY = 0.21 TWD,可在網站上調整
