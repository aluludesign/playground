// Trippps · 前端設定
//
// apiBase  後端所在位置。同一個 Vercel 專案的話留空字串就好。
//          如果網站放 GitHub Pages、後端另外部署在 Vercel,
//          填 Vercel 的網址,例如 "https://tokyo-trip.vercel.app"
// rate     日圓換台幣的匯率。這是「官方版本」,五個人看到的數字都用它。
//          要改就改這裡然後 commit —— 記得同步改 Notion「台幣金額」欄位的公式。

// kitty    每個人先拿出來放進共同基金的台幣金額。共同分攤的錢從這裡扣,
//          扣完就要再湊。改這裡五個人看到的額度就一起變。

window.TRIP_CONFIG = {
  apiBase: "",
  rate: 0.21,
  kitty: 30000,
};
