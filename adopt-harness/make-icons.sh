#!/bin/sh
# 從 tokyo-trip/icon.svg 算出 manifest 要的那幾個 PNG。
#   ./make-icons.sh
#
# 為什麼要有這支:這台機器上沒有 Pillow、沒有 ImageMagick、沒有 rsvg-convert,
# 而 sips 不吃 SVG。唯一會把 SVG 畫成點陣圖的東西是 Chrome —— shoot.sh 已經在用它了。
# 所以圖示走同一個渲染器,不為了四個檔另外長一條相依。
#
# 產出是**被追蹤的檔案**,跟 retro-modern.built.css 一樣:
# 部署時沒有人會跑這支,Vercel 送出去的就是 repo 裡那幾個 PNG。
# 改了 icon.svg 沒重跑,圖示就停在舊的 —— 而且不會有任何錯誤訊息。
# probes/pwa.js 會去比對兩邊,免得這件事無聲地爛掉。
set -e
H=$(cd "$(dirname "$0")" && pwd)
OUT=${1:-$H/../tokyo-trip}
OUT=$(cd "$OUT" && pwd)
SVG=$OUT/icon.svg
[ -f "$SVG" ] || { echo "找不到 $SVG" >&2; exit 1; }
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "找不到 Chrome:$CHROME" >&2; exit 1; }

# SVG 壞掉的話 Chrome 不會抱怨,它畫一個「圖片載不到」的小圖示然後照樣存檔 ——
# 出來是一張幾乎全是底色的 PNG,而這支腳本會說成功。第一次跑就是這樣:
# 註解裡寫了 `--board-bg`,XML 的註解不准出現連續兩個減號,整個檔解析失敗,
# 四個檔全是空的底色方塊,輸出的尺寸還完全正確。
# 所以渲染前先解析一次,壞了就停在這裡,而不是產出四個看起來很正常的空檔。
python3 - "$SVG" <<'PY' || exit 4
import sys, xml.dom.minidom
try:
    xml.dom.minidom.parse(sys.argv[1])
except Exception as e:
    print("✗ icon.svg 不是合法的 XML,這次不出圖:%s" % e, file=sys.stderr)
    print("  (最常見的原因:註解裡出現連續兩個減號,例如直接貼了 CSS 變數名)", file=sys.stderr)
    raise SystemExit(1)
PY

W=$(mktemp -d)
trap 'rm -rf "$W"' EXIT INT TERM
cp "$SVG" "$W/icon.svg"

# <樣式> 那格是套在 <img> 上的 CSS。maskable 版靠它把圖形縮進安全圈,
# 縮完露出來的四周由 background 補成同一個底色(#12141A),不然會是透明的。
shot () {  # shot <檔名> <邊長> <樣式>
  cat > "$W/_i.html" <<HTML
<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:#12141A}
  body{width:${2}px;height:${2}px;overflow:hidden}
  img{display:block;width:${2}px;height:${2}px;$3}
</style>
<img src="icon.svg">
HTML
  # --window-size 要跟邊長一模一樣,--force-device-scale-factor=1 也不能省:
  # shoot.sh 那邊用的是 2,照抄過來會得到雙倍尺寸的檔,而 manifest 裡寫的
  # "sizes" 還是 192x192 —— 瀏覽器不會抱怨,只是拿錯的圖去縮。
  "$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor=1 --window-size=$2,$2 \
    --virtual-time-budget=4000 --screenshot="$OUT/$1" \
    "file://$W/_i.html" 2>/dev/null
  echo "  $1  $(sips -g pixelWidth -g pixelHeight "$OUT/$1" 2>/dev/null | awk '/pixel/{printf "%s ", $2}')"
}

echo "出圖到 $OUT:"
shot icon-192.png          192 ""
shot icon-512.png          512 ""
# 0.68:Android 的安全圈是中心直徑 80%,方形圖形的對角線要塞進那個圓,
# 還得留一點邊 —— 畫滿的話塔腳和地平線兩端會被裁掉。
shot icon-maskable-512.png 512 "transform:scale(.68)"
# iOS 自己會把這張切圓角,所以要滿版、不要自帶圓角,也不要透明。
shot apple-touch-icon.png  180 ""

# 解析得過不等於畫得出來:路徑寫壞、顏色打錯、transform 把圖形推到畫面外,
# 出來一樣是一張純底色的方塊,而且尺寸正確、檔案存在、腳本回 0。
# 所以每張都數一次顏色 —— 塔的琥珀色至少要佔得到一點面積,不然就是沒畫上去。
python3 - "$OUT" <<'PY' || exit 5
import sys, zlib, struct, pathlib

def pixels(p):
    d = p.read_bytes()
    assert d[:8] == b"\x89PNG\r\n\x1a\n", "不是 PNG"
    i, idat, hdr = 8, b"", None
    while i < len(d):
        n, typ = struct.unpack(">I4s", d[i:i+8])
        body = d[i+8:i+8+n]
        if typ == b"IHDR": hdr = struct.unpack(">IIBBBBB", body)
        elif typ == b"IDAT": idat += body
        i += 12 + n
    w, h, depth, ctype, _, _, interlace = hdr
    assert depth == 8 and interlace == 0 and ctype in (2, 6), \
        "只認得 8-bit、非交錯的 RGB/RGBA(這張是 depth=%d ctype=%d)" % (depth, ctype)
    ch = 4 if ctype == 6 else 3
    raw, out, prev, k = zlib.decompress(idat), [], bytearray(w * ch), 0
    for _ in range(h):
        f, line = raw[k], bytearray(raw[k+1:k+1+w*ch]); k += 1 + w * ch
        for x in range(len(line)):
            a = line[x-ch] if x >= ch else 0
            b = prev[x]
            c = prev[x-ch] if x >= ch else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                pp = a + b - c
                pa, pb, pc = abs(pp-a), abs(pp-b), abs(pp-c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        out.append(bytes(line)); prev = line
    return w, h, ch, out

near = lambda v, t: all(abs(v[j] - t[j]) <= 12 for j in range(3))
AMBER, bad = (0xF0, 0xB4, 0x29), False
# 門檻分兩級。maskable 那張的圖形縮到 0.68,面積只剩 0.46 倍,琥珀色自然少一半 ——
# 拿滿版那張的門檻去套它會誤報。要擋的是「完全沒畫上去」(0%),不是「畫小了」,
# 所以兩個門檻都離 0 很近就夠,不必貼著實測值。
FLOOR = {"icon-192.png": 3.0, "icon-512.png": 3.0,
         "icon-maskable-512.png": 1.5, "apple-touch-icon.png": 3.0}
for name, floor in FLOOR.items():
    p = pathlib.Path(sys.argv[1]) / name
    w, h, ch, rows = pixels(p)
    hit = sum(1 for r in rows for x in range(0, w * ch, ch) if near(r[x:x+3], AMBER))
    pct = 100.0 * hit / (w * h)
    ok = pct >= floor
    print("  %-22s %dx%d  塔佔 %.1f%%(至少要 %.1f%%)  %s"
          % (name, w, h, pct, floor, "✓" if ok else "✗ 幾乎是空的底色"))
    bad |= not ok
if bad:
    print("✗ 有圖是空的 —— icon.svg 畫得出檔案但畫不出圖形,這批不能用。", file=sys.stderr)
    raise SystemExit(1)
PY

echo "好了。icon.svg 改過就要重跑這支,產出要一起 commit。"
