#!/bin/sh
# 在真實 DOM 上量東西。
#   ./probe.sh <js檔>      例:./probe.sh probes/labels.js
#
# 為什麼要有這支:`ADOPTION.md`「工具還缺什麼」的第 1 條 —— 那一節的每個陷阱
# (canvas 不觸發網頁字體、fonts.check() 說謊、unicode-range 說不出本機字體、
# 比字體要比形狀)全部是文件,沒有一支工具體現它們。前面至少有兩輪各自寫過一支
# 一次性的探針,寫完留在暫存目錄裡,下一個人還是得從零寫。這支進 repo。
#
# 它跟 shoot.sh 站在同一個地基上:同樣先重編、同樣灌 fixture.py 的假資料和凍結時鐘,
# 所以量到的東西和截到的圖是同一個世界。沒有這一點,探針的數字沒辦法跟截圖對帳。
#
# <js檔> 裡的程式碼會在 iframe 的 document 上跑,拿得到 `d`(document)和 `w`(window),
# 回傳值會被 JSON.stringify 之後印到 stdout。
set -e
JS=${1:?用法: ./probe.sh <js檔>}
[ -f "$JS" ] || { echo "找不到 $JS" >&2; exit 1; }
H=$(cd "$(dirname "$0")" && pwd)
SRC=$H/../tokyo-trip
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=8998   # 跟 shoot.sh 的 8999 錯開

# 跟 shoot.sh 同一把鎖。兩支都會重編、都會寫 .work/,不能同時跑。
LOCK=$H/.lock
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "✗ 另一隻 shoot.sh / probe.sh 正在跑,這次不量。" >&2
  echo "  持有者: $(cat "$LOCK/owner" 2>/dev/null || echo 不明)" >&2
  exit 2
fi
echo "pid $$ · $(date '+%Y-%m-%d %H:%M:%S') · probe $(basename "$JS")" > "$LOCK/owner"
trap 'rm -rf "$LOCK"; [ -n "${SRV:-}" ] && kill "$SRV" 2>/dev/null; true' EXIT INT TERM

if [ -f "$SRC/app.css" ]; then
  ( cd "$H/../design-system" && ./build.sh ../tokyo-trip/app.css ../tokyo-trip/retro-modern.built.css ) >/dev/null
fi
rm -rf "$H/.work" && mkdir -p "$H/.work"
cp -r "$SRC/." "$H/.work/"

python3 - "$H" <<'PY'
import sys, importlib.util
h = sys.argv[1]
spec = importlib.util.spec_from_file_location("fixture", h + "/fixture.py")
fx = importlib.util.module_from_spec(spec); spec.loader.exec_module(fx)
p = h + "/.work/index.html"
s = open(p, encoding="utf-8").read()
s = s.replace('    return DAYS[0].date;\n  }', '    return "2026-10-05";\n  }', 1)
i = s.rindex("<script>")
open(p, "w", encoding="utf-8").write(s[:i] + fx.seed() + s[i:])
PY

cd "$H/.work" && python3 -m http.server $PORT >/dev/null 2>&1 &
SRV=$!
sleep 1

# 探針跑在 1100px 寬:桌機版把 <details class="board"> 之類的東西打開,盤點才涵蓋得到。
# 但 ——「量得到」不等於「截得到」,見 block-02-mono 登記的陷阱第 1 條。
{
  echo '<!doctype html><meta charset="utf-8"><body style="margin:0">'
  echo '<iframe id="f" src="/index.html" style="width:1100px;height:900px;border:0"></iframe>'
  echo '<pre id="r"></pre><script>'
  echo 'document.getElementById("f").onload = function(){'
  echo '  var d = this.contentDocument, w = this.contentWindow;'
  echo '  setTimeout(function(){'
  echo '    var out;'
  echo '    try { out = (function(){'
  cat "$JS"
  echo '    })(); } catch(e) { out = {error: String(e && e.stack || e)}; }'
  echo '    document.getElementById("r").textContent = JSON.stringify(out, null, 2);'
  echo '  }, 1800);'
  echo '};</script>'
} > "$H/.work/_p.html"

"$CHROME" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=25000 \
  --dump-dom "http://localhost:$PORT/_p.html" 2>/dev/null \
  | python3 -c '
import sys, re, html
s = sys.stdin.read()
m = re.search(r"<pre id=\"r\">(.*?)</pre>", s, re.S)
print(html.unescape(m.group(1)) if m else "✗ 探針沒有回傳任何東西(JS 可能在 iframe 裡就掛了)")
'
rm -rf "$H/.work"
