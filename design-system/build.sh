#!/bin/sh
# 把設計系統編成一支靜態 CSS。
#
#   ./build.sh                       # 編 demo.html 用的那份 → demo.css
#   ./build.sh <入口.css> <輸出.css>  # 編某個網站用的那份
#
# v4 是 CSS-first 的，沒有 config 檔 —— token 全在 retro-modern.css 的 @theme 裡。
# 要掃哪些檔案也不用指定：它會掃入口 CSS 所在資料夾底下的原始碼（跳過 .gitignore 的）。
#
# 消費端自己寫一支入口，設計系統就不必知道誰在用它：
#
#   /* tokyo-trip/app.css */
#   @import "../design-system/retro-modern.css";
#
#   cd design-system && ./build.sh ../tokyo-trip/app.css ../tokyo-trip/app.css.out
set -e

cd "$(dirname "$0")"

IN="${1:-retro-modern.css}"
OUT="${2:-demo.css}"

# v4 的 CLI 需要能解析到 tailwindcss 套件，所以是本機相依而不是 npx。
# node_modules 不進版控（見 .gitignore），第一次會裝、之後直接用。
[ -d node_modules ] || npm install --silent --no-audit --no-fund

./node_modules/.bin/tailwindcss -i "$IN" -o "$OUT" --minify

echo "→ $OUT ($(wc -c < "$OUT") bytes)"
