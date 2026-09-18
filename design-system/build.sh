#!/bin/sh
# 把 preset 編成一支靜態 CSS，正式網站就不用掛 cdn.tailwindcss.com。
#
#   ./build.sh ../tokyo-trip/index.html
#   ./build.sh '../my-trip/**/*.html'
#
# 產出 dist/retro-modern.tailwind.css，只包含來源檔案真的用到的 utility。
# Tailwind 是 content-driven 的，所以一定要指定掃哪些檔案——
# 沒有「全部 utility 的預編版本」這種東西（那會是好幾 MB）。
set -e

cd "$(dirname "$0")"

if [ $# -eq 0 ]; then
  echo "用法: ./build.sh <要掃描的 HTML glob> [更多...]" >&2
  echo "例如: ./build.sh '../tokyo-trip/index.html'" >&2
  exit 1
fi

CONTENT=""
for arg in "$@"; do
  CONTENT="$CONTENT    '$arg',
"
done

mkdir -p dist
cat > dist/.tailwind.config.js <<CFG
module.exports = {
  presets: [require('../tailwind.preset.js')],
  content: [
$CONTENT  ],
};
CFG

printf '@tailwind base;\n@tailwind utilities;\n' > dist/.in.css

npx --yes tailwindcss@3 \
  -c dist/.tailwind.config.js \
  -i dist/.in.css \
  -o dist/retro-modern.tailwind.css \
  --minify

rm -f dist/.tailwind.config.js dist/.in.css
echo "→ dist/retro-modern.tailwind.css ($(wc -c < dist/retro-modern.tailwind.css) bytes)"
echo "  正式網站改引這支，把 cdn.tailwindcss.com 那兩行拿掉。"
