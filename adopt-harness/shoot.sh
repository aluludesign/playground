#!/bin/sh
# 逐頁截圖。同一套資料、同一個流程,才比得出 CSS 有沒有壞。
#   ./shoot.sh <標籤>        例:./shoot.sh baseline / ./shoot.sh layered
# 來源固定取 tokyo-trip/ 的工作目錄現況;要截某個 commit 就先 git stash 或 checkout。
set -e
LABEL=${1:?用法: ./shoot.sh <標籤>}
H=$(cd "$(dirname "$0")" && pwd)
SRC=$H/../tokyo-trip
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
  ( cd "$H/../design-system" && ./build.sh ../tokyo-trip/app.css ../tokyo-trip/retro-modern.built.css ) \
    | sed 's/^/  build: /'
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

cd "$H/.work" && python3 -m http.server $PORT >/dev/null 2>&1 &
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
  // 地圖圖磚是外部資源,載入時機和內容都不保證一致。擋掉之後
  // 標記的位置、標籤的讓位這些「我的 CSS 管的事」照樣看得到。
  var mo = new w.MutationObserver(function(){
    d.querySelectorAll('img.tile[src^="http"]').forEach(function(i){
      i.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAO7u7////yH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==';
    });
  });
  mo.observe(d.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['src']});
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
shot 02-plan-desktop    1100  900 ""                                            ".stop:3+"
shot 03-cost-mobile      390 1400 "d.getElementById('tab-cost').click();"       ".exp:3+,.rm-chip:3+,.catrow:2+"
shot 04-split-mobile     390 1300 "d.getElementById('tab-split').click();"      ".fp:5+"
shot 05-wishes-mobile    390 1200 "d.getElementById('wishbox').open=true;"      ".wish:3+"
shot 06-map-sheet        390 1000 "d.getElementById('day-map-btn').click();"    ".map .pin:4+"
shot 07-map-drawer      1100  900 "d.getElementById('wish-map-btn').click();"   ".map .pin:6+"
shot 08-addstop-form     390 1100 "d.getElementById('add-stop-btn').click();"   "#stop-form:not([hidden]) input:3+,.stop:3+"
shot 09-edit-dialog      390  900 "d.querySelector('[data-edit-stop]').click();" "#edit-overlay:not([hidden]) #edit-form input:3+,.stop:3+"

kill $SRV 2>/dev/null || true
if [ -n "$FAILED" ]; then
  echo
  echo "⚠ 有畫面是空的。這一批截圖不能拿來比對 —— 差異式檢查對「兩邊都空」全綠。"
fi
rm -rf "$H/.work"
echo "→ $OUT"
