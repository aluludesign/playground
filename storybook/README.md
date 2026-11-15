# Trippps Storybook

放 Trippps 設計系統的變數與元件。

```sh
npm install
npm run dev      # 本機開 http://localhost:6006
npm run build    # 編成靜態網站到 dist/
```

## 變數從哪來

`tokens/figma-retro.txt` 是 Figma（Trippps，fileKey `IBf6o1WsPQkgjllDyunIAc`）變數的快照：
Foundations 取 default 模式，Style、Comps 取 **Retro** 模式。

`npm run tokens`（dev / build 會自動先跑）把它轉成：

- `src/generated/tokens.css`：三層 CSS 變數，Style 用 `var()` 指 Foundations、Comps 用 `var()` 指 Style。
  名稱跟網站同一套（`ds/sys/color/on primary` → `--ds-sys-color-on-primary`）。
- `src/generated/tokens.json`：給展示頁用。

Figma 改了變數之後，要重新匯出這支檔案（由 Claude 用 Figma MCP 讀回來）。
指向不存在的變數、或同名變數出現兩次，`npm run tokens` 會直接失敗。

## 部署

Vercel 專案的 Root Directory 設成 `storybook`，其餘設定在 `vercel.json`。
