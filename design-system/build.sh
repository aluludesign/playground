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

# 撞名檢查。消費端如果自己也宣告了某個 @theme token 的同名變數，它會贏——
# 它的 :root 是無層級的，而 @theme 在 @layer theme 裡。那是「消費端的決定
# 蓋不掉」這個保證在運作，不是 bug。問題是沒有人被告知它正在發生：
# 症狀是「改了設計系統卻沒反應」，而我們為了一個 --font-mono 繞了三個 session。
# 所以在編譯之前就講。這只是提示不是錯誤——覆寫 token 是合法的（那就是主題化）。
node -e '
  const fs = require("fs"), path = require("path");
  const entry = process.argv[1], dir = path.dirname(entry);

  /* 設計系統自己的檔案要排除，否則會拿 @theme 去撞 @theme */
  const mine = new Set([path.resolve(entry)]);
  const declared = new Set();
  const readTheme = (f) => {
    const css = fs.readFileSync(f, "utf8");
    for (const m of css.matchAll(/@theme[^{]*\{([\s\S]*?)\n\}/g))
      for (const d of m[1].matchAll(/^\s*--([a-z0-9-]+)\s*:/gm))
        if (!d[1].endsWith("*")) declared.add(d[1]);
  };
  readTheme(entry);
  /* 路徑型的 @import 都要跟（相對或絕對），只跳過套件名（"tailwindcss/..."）。
     原本只吃開頭是 "." 的，絕對路徑就漏掉——而漏掉的結果是名單變空、
     檢查靜靜通過。 */
  for (const m of fs.readFileSync(entry, "utf8").matchAll(/@import\s+"([^"]+)"/g)) {
    const spec = m[1];
    if (!spec.startsWith(".") && !spec.startsWith("/")) continue;
    const f = spec.startsWith("/") ? spec : path.join(dir, spec);
    if (!fs.existsSync(f)) {
      console.error("  ⚠ 撞名檢查找不到 @import 的目標: " + spec);
      continue;
    }
    mine.add(path.resolve(f));
    readTheme(f);
  }

  /* 名單空的時候要出聲，不能靜靜通過。名單空代表「這次沒檢查」，
     而那跟「檢查過沒問題」在畫面上長得一樣——那是這裡最常見的失敗。 */
  if (!declared.size) {
    console.error("  ⚠ 撞名檢查沒有取得任何 @theme token，這次等於沒檢查。");
    console.error("    入口是 " + path.basename(entry) + "，它有 @import 到 retro-modern.css 嗎？");
    process.exit(0);
  }

  /* 掃消費端的原始碼。範圍跟 @source 一致：入口所在的資料夾。 */
  const SKIP = new Set(["node_modules", "dist", ".git", "shots"]);
  const found = new Map();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) { walk(f); continue; }
      if (!/\.(html?|css|js|jsx|ts|tsx|svelte|vue)$/i.test(e.name)) continue;
      if (mine.has(path.resolve(f))) continue;
      if (path.resolve(f) === path.resolve(process.argv[2])) continue;
      const src = fs.readFileSync(f, "utf8");
      /* 我們自己編出來的產出裡當然有全部 token。認指紋而不是認檔名——
         舊的、改過名的、別人編的產出都認得出來。 */
      if (/\/\*src:[a-z0-9]+:/.test(src)) continue;
      for (const m of src.matchAll(/--([a-z0-9-]+)\s*:/g))
        if (declared.has(m[1])) {
          if (!found.has(m[1])) found.set(m[1], new Set());
          found.get(m[1]).add(path.relative(dir, f));
        }
    }
  };
  walk(dir);

  if (found.size) {
    console.error("  ⚠ 這些 token 被消費端自己宣告了，設計系統的值到不了：");
    for (const [n, files] of [...found].sort())
      console.error("      --" + n + "  （" + [...files].join(", ") + "）");
    console.error("    覆寫是合法的。但如果你改了設計系統卻沒反應，先看這裡。");
  } else {
    console.error("  撞名檢查: " + declared.size + " 個 token，無衝突");
  }
' "$IN" "$OUT"

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
  for (const m of fs.readFileSync(entry, "utf8").matchAll(/@import\s+"([^"]+)"/g)) {
    const spec = m[1];
    if (!spec.startsWith(".") && !spec.startsWith("/")) continue;
    files.push(spec.startsWith("/") ? spec : path.join(dir, spec));
  }
  let h = 2166136261;                        /* FNV-1a，夠用又不必動到 crypto */
  for (const f of files) {
    const t = fs.readFileSync(f, "utf8");
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  }
  /* 路徑存「相對於產出」，不是檔名也不是相對入口。理由是：讀指紋的人手上
     只有產出（demo.html 的比對、落後掃描都是這樣），所以基準必須是產出的位置。
     只存檔名的話，匯入的檔案不在同層時會解析到不存在的地方，而重算的人
     不會發現自己算錯了。 */
  const outDir = path.dirname(path.resolve(process.argv[2]));
  const list = files.map(f => {
    const r = path.relative(outDir, path.resolve(f));
    return r.startsWith(".") ? r : "./" + r;
  }).join(",");
  fs.appendFileSync(process.argv[2], "\n/*src:" + (h >>> 0).toString(36) + ":" + list + "*/");
  console.error("  指紋涵蓋: " + list);
' "$IN" "$OUT"

# 落後掃描。改了設計系統之後，各消費端的產出不會自動跟上 —— 而它們是各自
# commit 進自己目錄的（Vercel 的部署範圍只看那個資料夾）。
# 所以每次建置完，順手檢查整個 repo 裡帶著我們指紋的產出還對不對。
# 這樣「改了但有人沒跟上」會講給**動手改的那個人**聽，而不是等別人發現 ——
# 不需要 git hook，也不依賴任何人記得跑什麼。
node -e '
  const fs = require("fs"), path = require("path");
  const root = path.resolve(__dirname, "..");
  const STAMP = /\/\*src:([a-z0-9]+):([^*]+)\*\//;
  const SKIP = new Set(["node_modules", ".git", "shots"]);
  const fnv = (t) => {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  };
  const stale = [], unsure = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) { walk(f); continue; }
      if (!e.name.endsWith(".css")) continue;
      const m = STAMP.exec(fs.readFileSync(f, "utf8"));
      if (!m) continue;
      const srcs = m[2].split(",").map(s => path.resolve(path.dirname(f), s.trim()));
      const missing = srcs.filter(s => !fs.existsSync(s));
      if (missing.length) {
        unsure.push([path.relative(root, f), missing.map(s => path.relative(root, s))]);
        continue;
      }
      if (fnv(srcs.map(s => fs.readFileSync(s, "utf8")).join("")) !== m[1])
        stale.push([path.relative(root, f), path.relative(root, srcs[0])]);
    }
  };
  walk(root);
  for (const [f, srcs] of unsure) {
    console.error("  ⚠ 驗不出 " + f + " 是不是最新的，它記的來源檔找不到: " + srcs.join(", "));
  }
  /* 印出來的路徑相對於 build.sh 自己的位置（它一開頭就 cd 過去），
     所以這行可以直接複製執行 */
  const here = __dirname;
  const rel = (p) => {
    const r = path.relative(here, path.resolve(root, p));
    return r.startsWith(".") ? r : "./" + r;
  };
  for (const [f, entry] of stale) {
    console.error("  ⚠ " + f + " 比它的來源舊了，重編: ./build.sh " + rel(entry) + " " + rel(f));
  }
' "$OUT"

echo "→ $OUT ($(wc -c < "$OUT") bytes)"
