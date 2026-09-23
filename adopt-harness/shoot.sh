#!/bin/sh
# 逐頁截圖。同一套資料、同一個流程,才比得出 CSS 有沒有壞。
#   ./shoot.sh <標籤>        例:./shoot.sh baseline / ./shoot.sh layered
# 來源預設取 tokyo-trip/ 的工作目錄現況。
#
# SRC= 可以改成別的來源樹(例如 `git worktree add` 出來的某個 commit):
#   git worktree add /tmp/wt-8b4ee7c 8b4ee7c
#   SRC=/tmp/wt-8b4ee7c/tokyo-trip ./shoot.sh pre-label-expform
# 以前這裡是硬編碼的,要截某個 commit 的樣子只能 `git stash` 或 checkout ——
# 也就是**動共用工作樹裡的 tokyo-trip/index.html**。這個 repo 同時有別的 session
# 在動那個檔,而且「一塊一個人」的時候常常被明確要求不准碰它。
# block-05 要拿新截圖回頭比對兩輪之前凍住的東西,沒有這個開關就只能二選一:
# 要嘛動別人的檔,要嘛手寫一支一次性的截圖腳本(ADOPTION「工具還缺什麼」第 1 條
# 那個累犯的形狀)。所以開關做進工具裡。
set -e
LABEL=${1:?用法: ./shoot.sh <標籤>}
H=$(cd "$(dirname "$0")" && pwd)
SRC=${SRC:-$H/../tokyo-trip}
SRC=$(cd "$SRC" && pwd)
OUT=$H/shots/$LABEL
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=8999

# 同一時間只准一隻在截圖。理由不是禮貌 —— 這支腳本碰的每一樣東西都是共用的:
# 硬編碼的單一 PORT、單一 .work/(而且第一件事就是 rm -rf 它)、
# 以及上面那行 build 直接寫進工作樹的那份被追蹤的 retro-modern.built.css。
# 兩隻同時跑,後跑的會 rm -rf 掉前一隻正在用的目錄,前一隻於是拍到一半舊一半新,
# 或者對著空目錄拍 —— 而兩邊都不會收到任何錯誤訊息。
# 那正是這整套工具存在的理由(無聲失敗),卻長在工具自己身上。
# 所以寧可大聲拒絕,不要安靜覆蓋。mkdir 是原子的,兩隻搶同一個只有一隻會成功。
LOCK=$H/.lock
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "✗ 另一隻 shoot.sh 正在跑,這次不截。" >&2
  echo "  持有者: $(cat "$LOCK/owner" 2>/dev/null || echo 不明)" >&2
  echo "  兩隻同時跑會無聲汙染彼此的截圖(共用 .work/、共用埠 ${PORT}、共用產出檔)。" >&2
  echo "  確定那一隻已經死了,就 rm -rf $LOCK 再試。" >&2
  exit 2
fi
echo "pid $$ · $(date '+%Y-%m-%d %H:%M:%S') · 標籤 $LABEL" > "$LOCK/owner"
# 中途死掉也要放鎖,順便把 http server 收乾淨(原本只在正常結束時 kill)。
# `A && B` 不能是這裡的最後一句,而且末尾補一個 `; true` 擋不住 —— set -e 在 trap
# 裡面照樣有效,kill 失敗時整個 `[ ] && kill` 複合句就是失敗,trap 在那裡中止,
# 後面的 true 根本沒跑到,腳本於是**成功收工卻回傳 1**。
# (shoot.sh 正常結束時會先 kill 一次 SRV,所以 trap 跑到時那個 pid 一定是死的
#  —— 也就是說這兩支腳本每一次成功都回傳 1,而輸出被 pipe 掉就看不見。)
# block-03 在 PROVENANCE 那個區塊修過同一個坑,三行外的 trap 裡還有一個。
trap 'rm -rf "$LOCK"; if [ -n "${SRV:-}" ]; then kill "$SRV" 2>/dev/null || true; fi' EXIT INT TERM

# 先重編再截圖。Tailwind 是 content-driven —— markup 用了新的 utility 而沒重編,
# 那個 class 就不存在,樣式安靜消失。這件事必須是工具的一部分,不是人要記得的。
if [ -f "$SRC/app.css" ]; then
  # 編到 $SRC 自己身上,不要寫死 ../tokyo-trip —— SRC= 指到別的樹時,
  # 寫死的話會「編主樹、截別的樹」,兩邊對不上而且不會有任何錯誤訊息。
  # 注意:app.css 的 `@import "../design-system/..."` 是相對 $SRC 解析的,
  # 所以 SRC= 指到 worktree 時用的是**那個 commit 的 design-system**,不是主樹的。
# 重編的成敗**一定要看**。原本這裡是
#     ( cd ... && ./build.sh ... ) | sed 's/^/  build: /'
# —— `set -e` 之下,管線的結果是**最後一個指令**(sed)的結果,永遠是 0。
# 所以 build.sh 失敗時它照樣往下跑,拿**上一次留在樹裡的舊 retro-modern.built.css**
# 去截圖,而且一個字都不會多說。錯誤訊息確實有印出來,但它混在 build 的正常輸出裡,
# 而那一段一路都被 `| tail`、`| grep` 接走 —— 又一次「訊號活著,沒有人站在它的頻道上」。
# block-05 是這樣撞到的:SRC= 指到 git worktree,那棵樹的 design-system 沒有 node_modules,
# tailwind 解不到 `tailwindcss/theme.css`,**兩批歷史截圖全部是用舊產出截的,而腳本說成功**。
# (那一次結論沒被弄壞,是運氣:那幾個 commit 的 built.css 內容剛好一樣。)
  if ( cd "$H/../design-system" && ./build.sh "$SRC/app.css" "$SRC/retro-modern.built.css" ) \
       > "$H/.build.log" 2>&1; then
    sed 's/^/  build: /' "$H/.build.log"; rm -f "$H/.build.log"
  else
    sed 's/^/  build: /' "$H/.build.log"; rm -f "$H/.build.log"
    echo "✗ 重編失敗。這批不截 —— 再截下去用的是樹裡那份舊產出,而差異會被歸因到別的地方。" >&2
    echo "  SRC= 指到 git worktree 的話,那棵樹的 design-system/ 要有 node_modules:" >&2
    echo "    ln -s $H/../design-system/node_modules <worktree>/design-system/node_modules" >&2
    exit 3
  fi
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

rm -rf "$H/.work" "$OUT" && mkdir -p "$H/.work" "$OUT"
cp -r "$SRC/." "$H/.work/"

# 這支腳本截的是「工作目錄現在長什麼樣」,不是某個 tag 或 commit。
# 忘了這件事的症狀是「比對永遠通過」—— 比失敗危險得多,因為它看起來像成功。
# 所以每組截圖旁邊留一份出處,事後回頭看得出這批是站在哪裡截的。
#
# 出處要涵蓋「會被烘進這批截圖的每一個來源」,而那不只 tokyo-trip/。
# 這裡原本寫的是 `git -C "$SRC" status --porcelain -- .`:cwd 在 tokyo-trip/,
# `-- .` 把範圍限死在那個目錄。但上面那行 build 是從 design-system/ 編出來的,
# 而且是在 .work/ 複本拷貝**之前**就寫進樹裡 —— 所以 design-system/ 的未提交改動
# 會被編進產出、烘進每一張截圖,紀錄卻照樣印「0 個檔案有未提交的改動」。
# 「一輪進行中 design-system 要凍結」那條規則因此從來沒有儀器在背後撐著:
# 凍結被打破的時候,九張全部會變,而出處說一切乾淨。
R=$(git -C "$H" rev-parse --show-toplevel)
DIRTY_DS=$(git -C "$R" status --porcelain -- design-system)
{
  echo "截於      $(date '+%Y-%m-%d %H:%M:%S')"
  # 來源要自己講一句。下面的 HEAD / 工作樹統計問的是**主工作樹**,SRC= 指到別的樹時
  # 那幾行就跟這批圖無關了 —— 而它們看起來一模一樣。所以不是預設來源就大聲說,
  # 並且另外印那棵樹自己的 HEAD。
  echo "來源      $SRC"
  if [ "$SRC" != "$(cd "$H/../tokyo-trip" && pwd)" ]; then
    echo "⚠ 來源不是主工作樹 —— 下面的 HEAD / 工作樹是主樹的,不是這批圖的來源"
    echo "來源HEAD  $(git -C "$SRC" log --oneline -1)"
    echo "來源工作樹 $(git -C "$SRC" status --porcelain | wc -l | tr -d ' ') 個檔案有未提交的改動(含剛才重編的產出)"
  fi
  echo "HEAD      $(git -C "$R" log --oneline -1)"
  echo "工作樹    $(git -C "$R" status --porcelain | wc -l | tr -d ' ') 個檔案有未提交的改動(整個 repo)"
  git -C "$R" status --porcelain | sed 's/^/          /'
  echo "會烘進圖  $(git -C "$R" status --porcelain -- tokyo-trip design-system | wc -l | tr -d ' ') 個(只算 tokyo-trip/ 與 design-system/)"
  # 相依單獨列一行。build 是從 design-system/ 跑的,而且在 .work/ 複本拷貝之前
  # 就把產出寫進樹裡 —— 它的狀態完全決定這批圖長什麼樣,所以它要有自己的戳記。
  echo "相依      design-system @ $(git -C "$H/../design-system" log --oneline -1)"
  echo "相依工作樹 $(git -C "$R" status --porcelain -- design-system | wc -l | tr -d ' ') 個檔案有未提交的改動"
  echo "stash     $(git -C "$R" stash list | wc -l | tr -d ' ') 筆"
  # 注意 `&&` 不能是這個區塊的最後一句 —— set -e 之下,乾淨時它回非零,整支腳本會
  # 在這裡無聲結束。用 if 寫,不要省。
  if [ -n "$DIRTY_DS" ]; then
    echo "⚠ design-system/ 不乾淨 —— 這批圖裡有未提交的 design-system 改動,差異無法歸因"
  fi
} > "$OUT/PROVENANCE.txt"
echo "出處:"; sed 's/^/  /' "$OUT/PROVENANCE.txt"

# PREFLIGHT=1 時把真正的 @layer base 注進這份複本來量影響。repo 不動。
if [ -n "$PREFLIGHT" ]; then
  python3 - "$H" <<'PP'
import sys
h = sys.argv[1]
p = h + "/.work/index.html"
s = open(p, encoding="utf-8").read()
pf = open("/tmp/preflight.css", encoding="utf-8").read()
s = s.replace("<style>",
              "<style>@layer properties,theme,base,components,utilities;\n@layer base{" + pf + "}\n", 1)
open(p, "w", encoding="utf-8").write(s)
print("  (已注入 preflight)")
PP
fi

python3 - "$H" <<'PY'
import sys, importlib.util
h = sys.argv[1]
spec = importlib.util.spec_from_file_location("fixture", h + "/fixture.py")
fx = importlib.util.module_from_spec(spec); spec.loader.exec_module(fx)
p = h + "/.work/index.html"
s = open(p, encoding="utf-8").read()
# 停在 DAY 3,才每次都截到同一天
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

# 差異式檢查(跟基準比)對「兩邊都是空的」完全無感 —— 工具自己壞掉的時候,
# 每一頁都一致地空白,比對照樣全綠。所以每張圖另外附一條正向斷言:
# 「這一頁至少要有這些東西」。絕對式的,不依賴任何基準。
shot () {  # shot <檔名> <寬> <高> <進站後要跑的 JS> <斷言 "選擇器:最少幾個,...">
  cat > "$H/.work/_f.html" <<HTML
<!doctype html><meta charset="utf-8"><body style="margin:0">
<iframe id="f" src="/index.html" style="width:${2}px;height:${3}px;border:0;display:block"></iframe>
<script>
document.getElementById('f').onload = function(){
  var d = this.contentDocument, w = this.contentWindow;
  // 過場動畫會讓同一個畫面在不同時間點長得不一樣,截圖比對就一直有假警報。
  // 這裡全部關掉 —— 它不影響版面,只影響「變化過程」,而我們比的是終態。
  var s = d.createElement('style');
  s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
  d.head.appendChild(s);
  // 地圖圖磚是外部資源,載入時機和內容都不保證一致。
  // **原本這裡是「等它載進來再把 src 換掉」,那是一場賽跑,而且會輸** ——
  // 同一個 commit 連拍兩次,有一次換成功(一片灰),有一次真的圖磚上了畫面。
  // 比對就在一個什麼都沒改的地方看到 612px 的差異。
  // 改成一條 CSS:不管圖磚什麼時候到、到了幾張,它一律不顯示,沒有時間差。
  // 標記的位置、標籤的讓位這些「我的 CSS 管的事」照樣看得到。
  s.textContent += 'img[src*="tile.openstreetmap.org"]{visibility:hidden!important}'
    + '.map,.seek-out .hit .thumb{background:#ececec!important}';
  setTimeout(function(){ try{ $4 }catch(e){} }, 1200);
};
</script>
HTML
  "$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor=2 --window-size=$(($2+30)),$(($3+20)) \
    --virtual-time-budget=25000 --screenshot="$OUT/$1.png" \
    "http://localhost:$PORT/_f.html" 2>/dev/null

  # 同樣的操作再跑一次,只為了問「畫面上真的有東西嗎」
  if [ -n "$5" ]; then
    cat > "$H/.work/_a.html" <<AHTML
<!doctype html><meta charset="utf-8"><body style="margin:0">
<iframe id="f" src="/index.html" style="width:${2}px;height:${3}px;border:0"></iframe>
<pre id="r"></pre>
<script>
document.getElementById('f').onload = function(){
  var d = this.contentDocument, w = this.contentWindow;
  setTimeout(function(){ try{ $4 }catch(e){}
    setTimeout(function(){
      var bad = [];
      "$5".split(",").forEach(function(spec){
        /* 從最後一個冒號切。用 split(":")[1] 的話,選擇器裡只要出現 :not() 之類的
           偽類,門檻就會被切成字串,parseInt 得到 NaN,而 n < NaN 永遠是 false ——
           斷言不會報錯,只是安靜地不再檢查任何東西。 */
        var q = spec.lastIndexOf(":"), sel = spec.slice(0, q), min = parseInt(spec.slice(q + 1), 10);
        if (!(min > 0)) { bad.push(spec + " 的門檻讀不出來"); return; }
        var n = d.querySelectorAll(sel).length;
        if (n < min) bad.push(sel + " 只有 " + n + " 個(至少要 " + min + ")");
      });
      document.getElementById('r').textContent = bad.length ? "FAIL " + bad.join(" · ") : "OK";
    }, 900);
  }, 1200);
};
</script>
AHTML
    RES=$("$CHROME" --headless=new --disable-gpu --no-sandbox \
      --virtual-time-budget=25000 --dump-dom "http://localhost:$PORT/_a.html" 2>/dev/null \
      | sed -n 's/.*<pre id="r">\(.*\)<\/pre>.*/\1/p')
    case "$RES" in
      OK)   echo "  $1.png  ✓ 有內容" ;;
      FAIL*) echo "  $1.png  ✗ 這頁是空的 —— $RES"; FAILED=1 ;;
      *)     echo "  $1.png  ? 斷言沒跑起來"; FAILED=1 ;;
    esac
  else
    echo "  $1.png"
  fi
}

echo "截 $LABEL:"
shot 01-plan-mobile      390 1500 ""                                            ".stop:3+"
# 02 的名字留著(基準表上追得到),但它現在拍的是**「1100 長得跟手機一樣」**——
# 那正是這一輪要的結果:窄桌機不再有自己的一套版面。
shot 02-plan-desktop    1100  900 ""                                            ".stop:3+"
shot 03-cost-mobile      390 1400 "d.getElementById('tab-cost').click();"       ".exp:3+,.rm-chip:3+,.catrow:2+"
shot 04-split-mobile     390 1300 "d.getElementById('tab-split').click();"      ".fp:5+"
shot 05-wishes-mobile    390 1200 "d.getElementById('wishbox').open=true;"      ".wish:3+"
# 06 / 07 的門檻在「沒填地點就不查」那一輪重設過,而且**不是只把數字調低**:
#
# 1. 規則改了之後,兩顆本來靠「拿標題去查」得來的 pin 消失了(合羽橋道具街、teamLab)。
#    截圖上 06 是 3 顆、07 是 7 顆。
# 2. 但**斷言和截圖看的不是同一個時刻**:斷言那一趟在動作後 900ms 量,
#    截圖那一趟拍的是 virtual-time budget(25s)跑完的終態。
#    07 的三顆航班點當時要等 A1「樂桃 MM626 · …」那兩次 Nominatim 真的回來才畫得出來
#    (實測約 1.2s 才到),所以斷言在 900ms 只看得到 fixture 快取裡那 4 顆。
#    **門檻只認「不靠網路就一定在」的那幾顆** —— 所以當時是 4,不是截圖上的 7。
# 3. 數字調低會削弱「app 死掉也過」的防線(07 以前就是門檻 2 太低而漏接),
#    所以兩張各補一條 `.stop:3+` —— 那三筆是 fixture 的資料,app 沒真的跑起來就不存在。
#
# **07 現在是 7,而且它比 4 更強,不是更鬆。** 那兩次 Nominatim 的成因是
# A1 的地點欄裡填的是航班備註(`樂桃 MM626 · 建議起飛前 2.5 小時`),而規則一
# 把標題從候選裡拿掉的時候連帶讓 OUTSIDE 人工表也比對不到 —— 於是它掉到線上查詢。
# 修好之後(見 geocode-outside-and-notice.md),**許願地圖那條路一次網路都不碰**:
# 七顆全部來自 fixture 快取或 OUTSIDE 人工表,900ms 就全部到齊。
# 所以這裡把門檻設回截圖上的數字是合法的 —— **「不靠網路就一定在」這個判準沒有放寬,
# 是那條路真的不靠網路了。** 哪天它又需要一次網路往返,這條斷言會先紅,那是對的。
# **這三張的 pin 門檻在 2026-09-23 全部改小了,原因是同一個。**
# 那天併進來的 PR 讓行程頁預設**只亮「這一天」那一層**,願望的點要自己開 ——
# 所以圖上的點從「這一天 + 全部願望」縮成「這一天有地點的行程」。
# DAY 3 有三個行程,其中「合羽橋道具街」沒填地點,所以是 2 個。
# 舊的門檻(3 / 7 / 3)於是在一個正確的改動上把整批截圖判成「這頁是空的」,
# 而那句話會讓人去找一個不存在的破版。
shot 06-map-sheet        390 1000 ""                                            ".map .pin:2+,.stop:3+"
# 07 是從「許願」那顆進地圖的,所以除了那一天的兩個行程還多一個願望的點 = 3。
# **這張搬到 1440 了(2026-09-23)。** 它叫「抽屜」,而 1100 已經沒有抽屜 ——
# 那個寬度整段改成跟手機一樣(地圖是底、清單是三段式 sheet)。
# 在 1100 拍的話,拍到的是一張名字寫著抽屜、畫面上沒有抽屜的圖,
# 而那種圖會讓下一個人以為抽屜壞了。
shot 07-map-drawer      1440  900 "d.getElementById('lay-wish').click();"        ".map .pin:3+,.stop:3+"
shot 08-addstop-form     390 1100 "d.getElementById('add-stop-btn').click();"   "#stop-form:not([hidden]) input:3+,.stop:3+"
shot 09-edit-dialog      390  900 "d.querySelector('[data-edit-stop]').click();" "#edit-overlay:not([hidden]) #edit-form input:3+,.stop:3+"
# 10 / 11:花費的兩張表單。九張裡從來沒有一張打開過它們,而裡面有 16 個欄位、
# 10 個 .who 核取方塊、10 個成員膠囊 —— 第三塊(color / letter-spacing)和
# 第四塊(width / background / font-size / line-height)各「刻意凍住」過一次,
# 理由每次都一樣:「沒有截圖就驗不了」。債堆了兩輪,而驗收規則第 4 點
# (「清單上有但沒出現也是問題」)在一個沒有畫面的地方根本執行不了。
#
# 斷言挑的是 `.who label` 而不是 `#exp-form input`:`ef-who` / `xe-who` 在 markup 裡
# 是**空的 <div>**,那五個膠囊是 JS 跑起來才產生的(index.html:2447 / :2496)。
# 靜態 markup 不算數 —— 那正是 08 / 09 的斷言收緊過的理由。
# 再加 `:not([hidden])` 確認容器真的開了(`.click()` 丟例外會被 try/catch 吃掉)。
shot 10-exp-form         390 1700 "d.getElementById('tab-cost').click(); d.getElementById('add-exp-btn').click();" \
                                  "#exp-form:not([hidden]) .rm-input:7+,#exp-form .who label.rm-chip:4+"
shot 11-exp-edit-dialog  390 1100 "d.getElementById('tab-cost').click(); d.querySelector('[data-edit-exp]').click();" \
                                  "#exp-edit-overlay:not([hidden]) .rm-input:7+,#exp-edit-overlay .who label.rm-chip:4+"

# 12:地點搜尋的候選清單。**這一張是為了不要重蹈 N2。**
# 上一輪新增的那兩個訊息槽「量到了位置、尺寸、色值、字級,但沒有任何一張截圖裡有它」——
# 因為它們預設 hidden,而「零差異」正是那一輪的驗收條件,兩件事互相排斥。
# 候選清單一模一樣:預設 hidden,十一張沒有一張拍得到。
#
# **樁裝在這裡,所以這張圖不碰網路。** Nominatim 是外部服務,回什麼、多快回都不保證 ——
# 直接查的話這張圖會變成「非決定性來源」那張表上的新一列。
# 回的三筆是真的(三間 teamLab,大阪／麻布台／京都),那正是這個功能存在的理由:
# 一個名字對到三個地方,**要人自己挑**。
shot 12-place-search     390 1100 "w.fetch=function(u){return String(u).indexOf('nominatim')<0?Promise.reject(new Error('擋掉')):Promise.resolve({ok:true,json:function(){return Promise.resolve([{lat:'34.6111',lon:'135.5205',display_name:'teamLab Botanical Garden, 長居公園, 東住吉區, 大阪市, 大阪府, 日本'},{lat:'35.6620',lon:'139.7434',display_name:'teamLab Borderless Museum, 麻布台ヒルズ, 虎ノ門, 港區, 東京都, 日本'},{lat:'34.9837',lon:'135.7654',display_name:'teamLab BioVortex, 八条通, 下京区, 京都市, 京都府, 日本'}])}})};d.getElementById('add-stop-btn').click();d.getElementById('sf-title').value='teamLab';d.querySelector('[data-seek=sf-title]').click();" \
                                  "#stop-form:not([hidden]) .seek-out .hit:3+"

# 13:「改我的願望」。理由跟 10 / 11 同形 —— **沒有截圖的介面等於沒有人看過**,
# 而 block-05 那一輪一打開 #exp-form 就當場發現十顆膠囊壞了、壞了兩輪。
#
# fixture 的 tokyo5-me 是 hsieh_chinhui,而 w2(「橫濱 港灣未來」)正是他許的。
#
# **這裡以前寫的是「整份清單裡只有那一筆有 [data-edit-wish],querySelector 不會挑錯」,
# 而那個前提在「管理員改得動任何人的願望」之後沒了。** 三筆都有「改」,
# `querySelector` 挑到的變成 w1(teamLab,沒有地點)—— 於是 `.said.ok` 那條斷言紅了,
# 而它紅得對:這張圖本來就是要拍「既有的 place 講出來」,拍到一筆沒有 place 的等於沒拍到。
# 現在直接指名 `w2`,跟清單上有幾顆「改」無關。
#
# 「別人的願望沒有那顆按鈕」那件事**搬到 probes/geofix.js 的 14e** —— 那裡是唯讀
# (沒有通行碼)的情境,那條規則只在那裡還成立。
#
# 三條斷言各自釘一件事:
#   .rm-input:2+        兩個欄位真的畫出來了(標題 + 想說的)
#   .said.ok            **既有的 place 講出來了**。w2 的 place 是「港灣未來」、
#                       title 是「橫濱 港灣未來」—— 兩欄合併之後 place 沒有欄位可住,
#                       它只活在這一行上。這條掛掉就是「合併把位置藏起來」回來了。
#   #we-again           **「再查一次」真的搬到這裡了**。它是這一輪的入口搬家,
#                       而搬家最容易的失敗是舊的拿掉了、新的沒接上。
#                       (w2 的快取座標沒有 via,所以這一筆的按鈕該是畫出來的。)
# **`#we-again` 那一條斷言換掉了。** 那顆「再查一次」在 `feat/search-escalate`
# 被收進搜尋按鈕的第 3 段,元素不存在了 —— 斷言改成「這張表裡有一顆搜尋鈕」。
#
# 留著不改的話,它會在一個**正確的改動**上變紅,而下一個人看到紅燈的第一反應
# 是把改動退回去。那跟陷阱 12 是同一件事的另一半:
# **斷言不只會保護舊的 bug,也會保護舊的設計。**
shot 13-wish-edit        390 1000 "d.getElementById('wishbox').open=true; d.querySelector('[data-edit-wish=w2]').click();" \
                                  "#wish-edit-overlay:not([hidden]) .rm-input:2+,#wish-edit-overlay .seek-out .said.ok:1+,#wish-edit-overlay [data-seek]:1+"

# 14:第 3 段的樣子 —— 橘色提示 + 「強力搜」按鈕。
# **這一張是為了不要重蹈 N2。** Lulu 回報那句提示「超不明顯」,我改了位置和顏色,
# 而在這之前**沒有任何一張截圖拍得到它** —— 12 那張只搜一次,停在第 1 段。
# 「我改好了」和「你看得到我改成什麼樣」是兩件事。
#
# 樁裝在這裡,所以這張圖不碰網路(跟 12 同一個做法)。
# 連按兩次再點「好」:第 1 次給「加地點名」、第 2 次問「要不要強力搜」、
# 點了「好」按鈕才變橘。**升級是使用者點頭,不是按滿次數** —— 所以這張圖
# 要拍的是「他點過頭之後」的樣子。
#
# **斷言只能檢查「表單開著、搜尋鈕在」,檢查不到提示本身。**
# 斷言那一趟是在 JS 開跑後固定 900ms 檢查的,而三次搜尋要排 3×1100ms 的佇列
# (Nominatim 的使用條款),再快也趕不上。**登記成工具缺口:斷言的等待時間
# 應該能逐張指定**,不然「需要多步驟才到得了的狀態」永遠只能用弱斷言守。
shot 14-seek-strong      390 1000 "(async function(){var R=[{lat:'35.6',lon:'139.7',display_name:'某個地方, 東京都, 日本'}];w.fetch=function(u){return String(u).indexOf('nominatim')<0?Promise.reject(new Error('擋掉')):Promise.resolve({ok:true,json:function(){return Promise.resolve(R)}})};d.getElementById('add-stop-btn').click();d.getElementById('sf-title').value='泡溫泉';var b=d.querySelector('[data-seek=sf-title]');var nap=function(){return new Promise(function(r){w.setTimeout(r,50)})};for(var i=0;i<2;i++){b.click();for(var k=0;k<40&&!b.disabled;k++){await nap()}for(var m=0;m<120&&b.disabled;m++){await nap()}}var okb=d.querySelector('[data-arm=sf-title]');if(okb){okb.click();await nap();await nap()}})();" \
                                  "#stop-form:not([hidden]) [data-seek]:1+"

# 15:改**別人**那一筆的樣子 —— 暖色那一條說得出是誰許的。
# 理由跟 13 / 14 同形:這條提示是「管理員改得動任何人的願望」唯一的煞車,
# 而**沒有截圖的介面等於沒有人看過**。
#
# **理由要寫準**:清單那一列印得出「佳瑜 許的」(renderWishes 的 `.by`),別人的
# 願望不是沒有名字 —— 是**這張表蓋住了那一列**。打開之後畫面上只剩兩個欄位,
# 跟自己那一筆長得一模一樣。這一張要證的就是「不一樣」。
#
# w1(teamLab)是 chang_chiayu(佳瑜)許的,而 fixture 的 tokyo5-me 是 hsieh_chinhui(阿輝)。
# 兩條斷言:那一條真的沒有 hidden、而且標題改口了(不再說「我的」)。
shot 15-wish-edit-other  390 1000 "d.getElementById('wishbox').open=true; d.querySelector('[data-edit-wish=w1]').click();" \
                                  "#wish-edit-overlay:not([hidden]) #we-whose:not([hidden]):1+,#wish-edit-overlay .note:1+"

# 16:**上膛之前**那句話 —— 句子裡那三個字是橘紅、加粗、有底線的按鈕。
# 14 那張拍的是按下去**之後**,所以這句問話本身一直沒有人看過,
# 而它才是這一輪真正改掉的東西(旁邊一顆「好」→ 句子裡的連結)。
#
# 跟 14 同一段腳本,只是**不點下去**。顏色由這張回答,探針只量得到 class。
#
# **編號從 16 起跳不是手滑**:15 當初留給了 `feat/admin-edit-wish`,兩支分開做的時候
# 都叫 15 的話合併會撞檔名,而 `shoot.sh` 不會抱怨 —— 它只是後寫的蓋掉先寫的。
# (那支現在就在上面,兩張並存,洞補起來了。)
#
# **斷言只能問「這一頁有東西嗎」,問不了那句話在不在。** 斷言那一趟在動作後 900ms 量,
# 而兩次搜尋走的是 Nominatim 那條有節流的佇列,900ms 到不了第 2 段。
# 跟 14 那張註解講的(斷言和截圖不是同一個時刻)是同一件事;截圖那一趟有
# virtual-time-budget,看得到完整狀態。**顏色和字樣由這張圖回答,那句話在不在
# 由 `probes/escalate.js` 回答** —— 兩邊各做各擅長的,不要逼一邊做另一邊的事。
#
# (這段註解一開始寫在下面那個 `shot` 的續行中間。`\` 接到 `#` 那一行,
#  斷言參數就沒了,而最後那一行變成一個叫 `"#stop-form…"` 的指令,整支 exit 127。
#  **續行裡不能夾註解** —— 而錯誤訊息只說 command not found,沒提到續行。)
shot 16-seek-hint      390 1000 "(async function(){var R=[{lat:'35.6',lon:'139.7',display_name:'某個地方, 東京都, 日本'}];w.fetch=function(u){return String(u).indexOf('nominatim')<0?Promise.reject(new Error('擋掉')):Promise.resolve({ok:true,json:function(){return Promise.resolve(R)}})};d.getElementById('add-stop-btn').click();d.getElementById('sf-title').value='泡溫泉';var b=d.querySelector('[data-seek=sf-title]');var nap=function(){return new Promise(function(r){w.setTimeout(r,50)})};for(var i=0;i<2;i++){b.click();for(var k=0;k<40&&!b.disabled;k++){await nap()}for(var m=0;m<120&&b.disabled;m++){await nap()}}})();" \
                                  "#stop-form:not([hidden]) [data-seek]:1+"

# 17:寬桌機的三塊 —— 行程 ｜ 許願 ｜ 地圖。
# **這張是被 02 拍不到逼出來的。** 02 是在 1100px 拍的,而三欄的門檻是 1280
# (量出來的:願望那一排在 1100 只剩 182px 會換行,1280 是 234px 一行)。
# 也就是說整個三欄版面**在既有的十六張裡一張都拍不到** —— 而「沒有任何一張
# 截圖拍得到它」正是 `#map-fix` 躲了四輪的那個機制。
# 不必點任何東西:寬桌機的行程分頁預設就是三塊,那正是這張要證明的事。
shot 17-plan-three-cols 1440  900 ""                                            ".stop:3+,.map .pin:2+"

# 18:手機上「許願地點」那張對話框。
# **以前它不是對話框,是就地展開的表單,所以沒有任何一張圖需要拍它。**
# 現在它蓋在滿版的許願 sheet 上面,而「蓋在上面」正是要用眼睛確認的事 ——
# 蓋錯一層(例如被地圖蓋住)在斷言上看起來完全正常:元素在、值也對,只是沒人看得到。
# 先把許願 sheet 打開再按,拍的才是真的那一層疊在真的那一層上面。
shot 18-wish-add        390 1000 "d.getElementById('wishbox').open=true; d.getElementById('add-wish-btn').click();" \
                                  "#wish-add-overlay:not([hidden]) .rm-input:3+"

# 19:手機上的「搭機」分頁。
# **這一頁一張都沒拍過** —— 它是這一輪才從行程頁分出去的,
# 而它剛改成「進來就是攤開的」。那件事只有眼睛看得出來:
# 斷言問得到 open 和高度,問不到「人進來第一眼看到的是航班還是一條標題」。
shot 19-fly-mobile      390  900 "d.getElementById('tab-fly').click();" \
                                  "#panel-fly .leg:2+"

# 20:還沒進來的人看到的那一扇門,而且是在地圖抽屜開著的寬桌機上。
# **這一層一張都沒拍過** —— 它是每個人看到的第一個畫面,卻沒有任何一張圖證明
# 它蓋得住後面。她在 iPad 上拍到的正是這個:門旁邊擺著一張清清楚楚、
# 還能拖能點的地圖。矩形和 z 軸是兩件事,而兩件事都只有眼睛看得出來。
shot 20-signin-gate    1440  900 "d.getElementById('signin-overlay').hidden=false;" \
                                  "#signin-overlay:not([hidden]) .signin:1+"

# 21:窄桌機(1100)的「許願」分頁。
# **這個寬度的許願以前是一條釘在底部的 bar,現在是分頁** —— 而 02 拍的是行程頁,
# 05 拍的是手機。中間這個寬度的許願,沒有任何一張圖拍得到。
# 它要看得到的三件事:分頁列上有「許願」而且排在「行程」後面、
# 上面那一排日期在(每個人都有,不分管理員)、以及底部沒有那條浮著的 bar。
shot 21-wish-narrow    1100  900 "d.getElementById('tab-wish').click();" \
                                  "#wishbox .wish:2+,#days .day:3+"

kill $SRV 2>/dev/null || true
rm -rf "$H/.work"
echo "→ $OUT"
# 正向斷言掛掉的時候要**回傳非零**,不能只印一行警告。
# block-04 把「每一次成功都回傳 1」修掉了,但沒有人檢查反過來的那一半:
# 在那之後,不管幾張印 ✗,這支都還是回傳 0。也就是說 `./shoot.sh a && 比對`
# 會在一批「有畫面是空的」的截圖上**照樣往下跑**,而差異式檢查對兩邊都空全綠 ——
# 那正是這整套工具的「最貴的一個教訓」那一節在防的東西,而它的出口是開著的。
# (block-05 用 SRC= 截歷史 commit 時看到的:10 / 11 印 ✗,腳本回傳 0。)
if [ -n "$FAILED" ]; then
  echo
  echo "⚠ 有畫面是空的。這一批截圖不能拿來比對 —— 差異式檢查對「兩邊都空」全綠。" >&2
  exit 4
fi
