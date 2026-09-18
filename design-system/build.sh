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

# 明確宣告 layer 順序。層的優先序由「第一次出現的順序」決定，不是由名字——
# 所以不宣告的話，utilities 排在最後只是剛好，任何人在前面插一層就翻盤。
# 寫在原始碼裡沒用：--minify 會把 @layer a,b,c; 這種宣告拿掉，所以在這裡補。
# 名單從產出本身推導，Tailwind 之後多一層也不會漏掉。
node -e '
  const fs = require("fs"), f = process.argv[1];
  let css = fs.readFileSync(f, "utf8");
  const names = [];
  for (const m of css.matchAll(/@layer ([a-z-]+)\s*\{/g))
    if (!names.includes(m[1])) names.push(m[1]);
  if (!names.length) process.exit(0);
  const decl = "@layer " + names.join(",") + ";";
  /* 接在開頭那行 banner 註解之後，一定要在第一個 @layer 區塊之前 */
  const i = css.indexOf("*/");
  css = i === -1 ? decl + css : css.slice(0, i + 2) + "\n" + decl + css.slice(i + 2);
  fs.writeFileSync(f, css);
  console.error("  layer 順序: " + names.join(" → "));
' "$OUT"

# 在產出尾巴蓋一枚原始碼的指紋。demo.html 會自己比對，發現對不上就跳警告——
# 產生檔進了版控就有走鐘的可能：有人改了 retro-modern.css 忘了重編，
# git 裡的 demo 就開始說謊，而那正是這套系統被審閱的方式。
STAMP=$(node -e '
  const fs = require("fs");
  const t = fs.readFileSync(process.argv[1], "utf8");
  let h = 2166136261;                        /* FNV-1a，夠用又不必動到 crypto */
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  process.stdout.write((h >>> 0).toString(36));
' "$IN")
printf '\n/*src:%s*/' "$STAMP" >> "$OUT"

echo "→ $OUT ($(wc -c < "$OUT") bytes, src:$STAMP)"
