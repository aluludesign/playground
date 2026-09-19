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

IN="${1:-demo.entry.css}"
OUT="${2:-demo.css}"

# v4 的 CLI 需要能解析到 tailwindcss 套件，所以是本機相依而不是 npx。
# node_modules 不進版控（見 .gitignore），第一次會裝、之後直接用。
[ -d node_modules ] || npm install --silent --no-audit --no-fund

./node_modules/.bin/tailwindcss -i "$IN" -o "$OUT" --minify

# 明確宣告 layer 順序。層的優先序由「名字第一次出現的順序」決定，不是由名字——
# 所以不宣告的話，utilities 排在最後只是剛好，任何人在前面插一層就翻盤。
# 寫在原始碼裡沒用：--minify 會把 @layer a,b,c; 這種宣告拿掉，所以在這裡補。
#
# 層有兩種註冊方式，兩種都要數：帶區塊的 `@layer x {` 和裸宣告 `@layer x;`
# （後者也可能是逗號清單）。只數區塊的話空層會被漏掉——而漏掉的後果不是
# 「少宣告一個」，是那個層被接在名單後面、變成優先序最高的。
# 補完會再驗一次，驗不過就讓建置失敗，不留一個看起來有在運作的空保證。
node -e '
  const fs = require("fs"), f = process.argv[1];
  const LAYER = /@layer\s+([a-z][a-z0-9-]*(?:\s*,\s*[a-z][a-z0-9-]*)*)\s*[{;]/g;
  const scan = (css) => {
    const out = [];
    for (const m of css.matchAll(LAYER))
      for (const n of m[1].split(",").map(x => x.trim()))
        if (!out.includes(n)) out.push(n);
    return out;
  };

  let css = fs.readFileSync(f, "utf8");
  const names = scan(css);
  if (!names.length) process.exit(0);
  const decl = "@layer " + names.join(",") + ";";
  const i = css.indexOf("*/");                 /* 接在開頭那行 banner 註解之後 */
  css = i === -1 ? decl + css : css.slice(0, i + 2) + "\n" + decl + css.slice(i + 2);
  fs.writeFileSync(f, css);

  /* 驗收刻意「不」重用上面那個 pattern。用同一個等於循環論證——
     看不見的東西，驗證時一樣看不見。這裡改成最笨也最寬的方式：
     找出每一處 @layer，把它到 { 或 ; 之間的字全部當成層名候選。
     寬鬆會誤報，而誤報看得見；漏報看不見。 */
  const after = fs.readFileSync(f, "utf8");
  const declEnd = after.indexOf(decl) + decl.length;
  const rest = after.slice(declEnd);
  const late = [];
  for (let at = rest.indexOf("@layer"); at !== -1; at = rest.indexOf("@layer", at + 6)) {
    const head = rest.slice(at + 6, at + 200).split(/[{;]/)[0];
    for (const n of head.split(/[^a-zA-Z0-9_-]+/))
      if (n && !names.includes(n) && !late.includes(n)) late.push(n);
  }
  if (late.length) {
    console.error("  ✗ 這些層沒有在頂端宣告過，會排到最後面: " + late.join(", "));
    process.exit(1);
  }
  console.error("  layer 順序: " + names.join(" → ") + "（已驗證無遺漏）");
' "$OUT"

# 在產出尾巴蓋一枚原始碼指紋。demo.html 會自己比對，發現對不上就跳警告——
# 產生檔進了版控就有走鐘的可能：有人改了 retro-modern.css 忘了重編，
# git 裡的 demo 就開始說謊，而那正是這套系統被審閱的方式。
#
# 入口檔本身很少變，真正會變的是它 @import 進來的那些。所以指紋涵蓋
# 「入口 + 它引用的本機 CSS」，而且把檔案清單一起寫進去 —— 這樣 demo.html
# 不必知道建置結構，照著清單抓就好。
node -e '
  const fs = require("fs"), path = require("path");
  const entry = process.argv[1], dir = path.dirname(entry);
  const files = [entry];
  /* 只跟一層本機 @import；套件名（"tailwindcss/..."）不算，那是相依不是原始碼 */
  for (const m of fs.readFileSync(entry, "utf8").matchAll(/@import\s+"(\.[^"]+)"/g))
    files.push(path.join(dir, m[1]));
  let h = 2166136261;                        /* FNV-1a，夠用又不必動到 crypto */
  for (const f of files) {
    const t = fs.readFileSync(f, "utf8");
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  }
  const list = files.map(f => "./" + path.basename(f)).join(",");
  fs.appendFileSync(process.argv[2], "\n/*src:" + (h >>> 0).toString(36) + ":" + list + "*/");
  console.error("  指紋涵蓋: " + list);
' "$IN" "$OUT"

echo "→ $OUT ($(wc -c < "$OUT") bytes)"
