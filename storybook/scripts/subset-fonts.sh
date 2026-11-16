#!/bin/sh
# 把本機裝的源泉圓體、全瀨體裁成「只有 Storybook 頁面用到的字」的 woff2，放進 src/fonts/。
# 頁面文字有新的中文字時，在有裝字型的 Mac 上重跑一次再 commit。
# 需要：pip install fonttools brotli（PYFTSUBSET 可指定 pyftsubset 的路徑）
set -e
cd "$(dirname "$0")/.."
FONTS="${FONTS:-$HOME/Library/Fonts}"
SUB="${PYFTSUBSET:-pyftsubset}"
TEXT=$(mktemp)
# 頁面上所有字 + 英數符號
cat src/*.js src/stories/*.js > "$TEXT"
printf ' !"#$%%&()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_abcdefghijklmnopqrstuvwxyz{|}~' >> "$TEXT"
for w in EL L R M B H; do
  "$SUB" "$FONTS/GenSenRounded2TW-$w.otf" --text-file="$TEXT" --flavor=woff2 --layout-features='*' \
    --output-file="src/fonts/gensen-rounded2-tw-$w.woff2"
done
"$SUB" "$FONTS/cjkFonts_allseto_v1.11.ttf" --text-file="$TEXT" --flavor=woff2 --layout-features='*' \
  --output-file="src/fonts/cjkfonts-allseto.woff2"
rm "$TEXT"
ls -l src/fonts
