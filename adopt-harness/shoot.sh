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
{
  echo "截於      $(date '+%Y-%m-%d %H:%M:%S')"
  echo "HEAD      $(git -C "$SRC" log --oneline -1)"
  echo "工作樹    $(git -C "$SRC" status --porcelain -- . | wc -l | tr -d ' ') 個檔案有未提交的改動"
  git -C "$SRC" status --porcelain -- . | sed 's/^/          /'
  echo "stash     $(git -C "$SRC" stash list | wc -l | tr -d ' ') 筆"
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
