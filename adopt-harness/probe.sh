#!/bin/sh
# 在真實 DOM 上量東西。
#   ./probe.sh <js檔>              例:./probe.sh probes/labels.js
#   WIDTH=390 ./probe.sh <js檔>    在手機寬度量(見下面 WIDTH 那段)
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
# SRC= 可以指到別的來源樹(`git worktree add` 出來的某個 commit),跟 shoot.sh 同一個開關:
#   SRC=/tmp/wt/tokyo-trip WIDTH=390 ./probe.sh probes/who.js
# 沒有它的話,要量「兩輪之前那個值是多少」只能去動共用工作樹裡的 index.html。
SRC=${SRC:-$H/../tokyo-trip}
SRC=$(cd "$SRC" && pwd)
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
# `A && B` 不能是這裡的最後一句,而且末尾補一個 `; true` 擋不住 —— set -e 在 trap
# 裡面照樣有效,kill 失敗時整個 `[ ] && kill` 複合句就是失敗,trap 在那裡中止,
# 後面的 true 根本沒跑到,腳本於是**成功收工卻回傳 1**。
# (shoot.sh 正常結束時會先 kill 一次 SRV,所以 trap 跑到時那個 pid 一定是死的
#  —— 也就是說這兩支腳本每一次成功都回傳 1,而輸出被 pipe 掉就看不見。)
# block-03 在 PROVENANCE 那個區塊修過同一個坑,三行外的 trap 裡還有一個。
trap 'rm -rf "$LOCK"; if [ -n "${SRV:-}" ]; then kill "$SRV" 2>/dev/null || true; fi' EXIT INT TERM

if [ -f "$SRC/app.css" ]; then
  # 編到 $SRC 自己身上。寫死 ../tokyo-trip 的話,SRC= 指到別的樹時會變成
  # 「編主樹、量別的樹」,而兩邊對不上不會有任何錯誤訊息。
# 重編的成敗**一定要看**。原本這裡是
#     ( cd ... && ./build.sh ... ) | sed 's/^/  build: /'
# —— `set -e` 之下,管線的結果是**最後一個指令**(sed)的結果,永遠是 0。
# 所以 build.sh 失敗時它照樣往下跑,拿**上一次留在樹裡的舊 retro-modern.built.css**
# 去量,而且一個字都不會多說。錯誤訊息確實有印出來,但它混在 build 的正常輸出裡,
# 而那一段一路都被 `| tail`、`| grep` 接走 —— 又一次「訊號活著,沒有人站在它的頻道上」。
# block-05 是這樣撞到的:SRC= 指到 git worktree,那棵樹的 design-system 沒有 node_modules,
# tailwind 解不到 `tailwindcss/theme.css`,**兩批歷史截圖全部是用舊產出截的,而腳本說成功**。
# (那一次結論沒被弄壞,是運氣:那幾個 commit 的 built.css 內容剛好一樣。)
  if ! ( cd "$H/../design-system" && ./build.sh "$SRC/app.css" "$SRC/retro-modern.built.css" ) \
         > "$H/.build.log" 2>&1; then
    sed 's/^/  build: /' "$H/.build.log" >&2; rm -f "$H/.build.log"
    echo "✗ 重編失敗。這次不量 —— 再量下去問到的是樹裡那份舊產出。" >&2
    exit 3
  fi
  rm -f "$H/.build.log"
fi
# 埠先確認沒有人佔。佔住的話 python3 -m http.server 會立刻失敗(而它被丟進背景、
# 輸出又導去 /dev/null,所以一個字都不會出現),Chrome 去打那個埠拿到的是**別人的**
# 伺服器 —— 通常是上一輪留下來、服務目錄早就被刪掉的孤兒,回 404。
# 然後這支腳本會說「探針沒有回傳任何東西(JS 可能在 iframe 裡就掛了)」,
# 把人送去查一支完全正常的探針。實際發生過,查了兩輪才發現埠上躺著兩隻
# 跑在 /tmp/wt-dr2/.work(已刪除)的 server。
# 孤兒的成因是 trap 裡的 kill 失敗:worktree 那邊跑的腳本,鎖和 .work 都在
# 它自己的目錄下,主樹這邊看不到,所以連「有人在跑」都問不出來。
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✗ 埠 $PORT 已經有人在聽,這次不跑。" >&2
  lsof -nP -iTCP:$PORT -sTCP:LISTEN 2>/dev/null | sed 's/^/  /' >&2
  echo "  如果那是上一輪留下來的孤兒(對應的 .work 目錄已經不在了),就:" >&2
  echo "    kill \$(lsof -tnP -iTCP:$PORT -sTCP:LISTEN)" >&2
  exit 4
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

# `cd X && python3 ... &` 的 $! 是**那個子 shell** 的 pid,不是 python 的 ——
# `&&` 讓 shell 一定要留著子 shell 去判斷前一句的結果,python 是它的子行程。
# 所以 trap 裡的 kill "$SRV" 殺掉子 shell,python 原地變孤兒繼續聽著那個埠,
# 而且 kill 回 0,看起來收乾淨了。下一輪起不來,Chrome 打到孤兒身上拿 404,
# 腳本則說「探針沒有回傳任何東西」。兩隻活了好幾小時的孤兒就是這樣來的。
# 加一個 exec:子 shell 被 python 取代,$! 拿到的就是 python 自己。
( cd "$H/.work" && exec python3 -m http.server $PORT >/dev/null 2>&1 ) &
SRV=$!
sleep 1

# 預設跑在 1100px 寬:桌機版把 <details class="board"> 之類的東西打開,盤點才涵蓋得到。
# 但 ——「量得到」不等於「截得到」,見 block-02-mono 登記的陷阱第 1 條。
#
# WIDTH= 可以改寬度,而這不是方便功能,是正確性:`index.html` 有一整段
# @media (max-width:640px) 的覆寫,而**九張裡有七張是 390px**(含 08 / 09 這兩張
# 表單圖)。只能在 1100px 量的探針,量到的是那七張根本看不到的那一套值 ——
# block-04 的主角就是 :521 那條手機覆寫,在 1100px 上它不存在。
#   WIDTH=390 ./probe.sh probes/inputs.js
WIDTH=${WIDTH:-1100}
{
  echo '<!doctype html><meta charset="utf-8"><body style="margin:0">'
  echo '<iframe id="f" src="/index.html" style="width:'"$WIDTH"'px;height:900px;border:0"></iframe>'
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
