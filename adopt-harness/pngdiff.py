#!/usr/bin/env python3
"""比對兩張 Chrome 截圖,回報差異的像素數和位置。
沒有 PIL,自己解 PNG(8-bit,RGB 或 RGBA,非交錯 —— Chrome 截圖就是這種)。

  ./pngdiff.py a.png b.png
      全圖逐像素比,回報差異列與列群。

  ./pngdiff.py a.png b.png --band <y0> <y1> [--x <x0> <x1>] [--shift <N>] [--shiftx <M>]
      只比 a 的 y0..y1 這一帶,並且在 b 上做位移搜尋,
      回答那個真正要問的問題:**這一帶的內容變了,還是只是被推走了?**
      --shift 搜垂直(±N 列)、--shiftx 搜水平(±M 行),兩個一起給就搜二維。

      每一塊轉換都會把下面的東西整片往下推,於是全圖比對一定是滿江紅,
      而「被推走」和「被改掉」在那個數字上長得一模一樣。
      `ADOPTION.md`「工具還缺什麼」第 2 條登記的就是這件事,
      而 block-04 為了診斷 01 的雙穩態**手寫過一支水平版的位移搜尋、用完就丟** ——
      那正是第 1 條那個累犯的形狀。這裡把它收進工具,並且改成垂直的
      (垂直才是常態:每一塊都會把下面的內容往下推)。

      block-05 需要它的理由很具體:`.who` 那一整組被第三塊和第四塊各凍了一次,
      兩輪都只有探針的 computed 值、沒有畫面。現在有畫面了,而它在三個 commit 的
      截圖裡位於**不同的 y**,所以「凍住有沒有守住」只能靠位移搜尋回答。

      **水平那一半是後來補的,而它補的是一個會給錯答案的洞。**
      01 的雙穩態是 `scrollLeft` 差 27px —— 水平的。只有垂直版的時候,
      拿 `--shift` 去問它,得到的是「沒有任何位移對得上,這一帶是真的被改掉了」:
      **一個很有自信的錯答案**,比沒有答案危險。geocode-retry 那一輪是另外
      手寫十幾行搜出來的(`dx=27,殘差 2.81%`),然後把「這應該進工具」寫下來 ——
      而這個 repo 有前科:寫下那句話跟真的放進去之間隔了一整輪。

      所以除了補上 `--shiftx`,**沒搜到的方向現在會自己講出來**:
      只搜了垂直而沒命中的時候,結論那一行會說「這一趟沒搜水平」。
      能力缺一半不可怕,**不知道自己缺一半才可怕**。

      01 那個雙穩態現在問得出答案了(而且比手寫那次乾淨,殘差是 0 不是 2.81%):

        pngdiff.py A/01-plan-mobile.png B/01-plan-mobile.png --band 460 640 --x 100 740 --shiftx 40
        → 最佳位移 dy=+0 dx=-27,差異像素 0/115200 —— 逐位元組相同,只是被推走了

      **`--x` 要框在捲動區的「裡面」。** 同一題用 `--x 60 780` 會說「沒有位移對得上」,
      因為那個範圍把不會跟著捲的邊緣也框進來了 —— 一個真的純位移,
      只要框到固定不動的東西,就會看起來像是被改掉了。
"""
import zlib, struct, sys

def load(path):
    d = open(path, 'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n', path + " 不是 PNG"
    i, idat, w, h, bd, ct = 8, b'', None, None, None, None
    while i < len(d):
        ln = struct.unpack('>I', d[i:i+4])[0]
        typ = d[i+4:i+8]; body = d[i+8:i+8+ln]
        if typ == b'IHDR': w, h, bd, ct = struct.unpack('>IIBB', body[:10])
        elif typ == b'IDAT': idat += body
        elif typ == b'IEND': break
        i += 12 + ln
    assert bd == 8 and ct in (2, 6), f"{path}: 不支援 bd={bd} ct={ct}"
    bpp = 4 if ct == 6 else 3
    raw = zlib.decompress(idat)
    stride = w * bpp
    out = bytearray(); prev = bytearray(stride); pos = 0
    for _ in range(h):
        f = raw[pos]; pos += 1
        line = bytearray(raw[pos:pos+stride]); pos += stride
        if f:
            for x in range(stride):
                a = line[x-bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x-bpp] if x >= bpp else 0
                if f == 1:   line[x] = (line[x] + a) & 255
                elif f == 2: line[x] = (line[x] + b) & 255
                elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
                else:
                    p = a + b - c; pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                    line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        out += line; prev = line
    return w, h, bpp, bytes(out)


# 主程式包進 __main__。load() 以前跟它黏在同一層,一 import 就會去讀 sys.argv[1]
# 然後炸掉,所以別的工具重用不了(crop.py 就是為了這個才踩到)。
# 直接執行的行為完全不變。
def rgb_rows(p, w, h, bpp):
    """把整張圖切成一列一個 bytes,並且把 alpha 丟掉(全圖比對也是只看 RGB)。
    `del ba[3::4]` 是 C 層做掉的,用 Python 迴圈剝 alpha 會慢到不能用。"""
    if bpp == 4:
        ba = bytearray(p); del ba[3::4]; p = bytes(ba)
    return [p[y * w * 3:(y + 1) * w * 3] for y in range(h)]


def _order(m):
    """由內往外(0, -1, +1, -2, +2 ...)。這樣第一個完全命中的就是位移最小的那個 ——
    從 -m 一路掃到 +m 的話,命中好幾個位移時報出來的會是最負的那個,
    而「0 就已經相同」跟「要退 37 才相同」意思差很多。"""
    return [0] + [s * d for d in range(1, m + 1) for s in (-1, 1)]


def band_compare(a, b, w, h, bpp, y0, y1, x0, x1, maxshift, maxshiftx=0):
    """把 a 的 y0..y1 這一帶,拿去跟 b 的同一帶 ±maxshift 列 / ±maxshiftx 行比,
    找最合的位移。

    回報的重點不是「差幾 %」,是**有沒有一個位移讓它逐位元組相同** ——
    那一句才等於「這一帶的內容沒被改到,只是被推走了」。

    **兩個方向都要能搜。** 只有垂直版的時候,水平的位移(01 那個 scrollLeft
    差 27px 的雙穩態)會被答成「這一帶是真的被改掉了」—— 錯的,而且講得很有自信。"""
    ra, rb = rgb_rows(a, w, h, bpp), rgb_rows(b, w, h, bpp)
    band = [ra[y][x0 * 3:x1 * 3] for y in range(y0, y1)]

    # 二維時由「總位移量」由小到大掃:先問「動得最少的解釋」,那才是要的答案。
    pairs = sorted([(dy, dx) for dy in _order(maxshift) for dx in _order(maxshiftx)],
                   key=lambda p: (abs(p[0]) + abs(p[1]), abs(p[0]), abs(p[1])))
    best = None
    for dy, dx in pairs:
        if y0 + dy < 0 or y1 + dy > h or x0 + dx < 0 or x1 + dx > w:
            continue
        nrow = sum(1 for i, r in enumerate(band)
                   if r != rb[y0 + dy + i][(x0 + dx) * 3:(x1 + dx) * 3])
        if best is None or nrow < best[0]:
            best = (nrow, dy, dx)
        if nrow == 0:
            break
    if best is None:
        print("  ✗ 位移範圍內沒有任何合法的位移(帶狀超出圖邊了)"); return

    nrow, dy, dx = best
    npx = 0
    for i, r in enumerate(band):
        s = rb[y0 + dy + i][(x0 + dx) * 3:(x1 + dx) * 3]
        npx += sum(1 for x in range(0, len(r), 3) if r[x:x + 3] != s[x:x + 3])
    tot = (y1 - y0) * (x1 - x0)
    mv = f"dy={dy:+d} dx={dx:+d}"
    print(f"帶狀比對  a 的 y={y0}..{y1}  x={x0}..{x1}  ({y1-y0} 列 × {x1-x0} 行)")
    print(f"  搜尋範圍  垂直 ±{maxshift} 列 · 水平 ±{maxshiftx} 行")
    print(f"  最佳位移 {mv}  差異列 {nrow}/{y1-y0}  差異像素 {npx}/{tot} ({npx/tot*100:.4f}%)")
    if nrow == 0:
        print(f"  → 位移 {mv} 之後**逐位元組相同**:這一帶的內容沒有變,只是被推走了。")
    elif (dy, dx) != (0, 0):
        print(f"  → 位移 {mv} 最接近,但仍有 {nrow} 列不同 —— 是位移**加上**改變,不是純位移。")
        print("     (殘差集中在邊緣、比例零點幾到幾 % 的話先想次像素相位,見 ADOPTION 陷阱 9。)")
    else:
        # **這句話以前是無條件印的,而它在水平位移上是錯的。** 現在只有兩個方向
        # 都真的搜過才敢這樣講;沒搜過的方向要自己講出來,不要讓讀的人以為搜過了。
        miss = [n for n, m in (("水平(--shiftx N)", maxshiftx), ("垂直(--shift N)", maxshift)) if not m]
        if miss:
            print(f"  → 在搜過的範圍裡沒有位移對得上。**但這一趟沒搜 {' 和 '.join(miss)}** ——")
            print("     在下結論說「這一帶被改掉了」之前先把那個方向也搜一次(01 的雙穩態就是水平的)。")
        else:
            print("  → 兩個方向都搜過,沒有任何位移對得上,這一帶是真的被改掉了。")


def main():
    argv = sys.argv[1:]

    def opt(name, n):
        if name not in argv:
            return None
        i = argv.index(name)
        vals = [int(v) for v in argv[i + 1:i + 1 + n]]
        if len(vals) != n:
            print(f"{name} 要 {n} 個數字"); sys.exit(2)
        del argv[i:i + 1 + n]
        return vals

    band = opt('--band', 2)
    xr = opt('--x', 2)
    sh = opt('--shift', 1)
    shx = opt('--shiftx', 1)
    if xr is not None and band is None:
        print("--x 要跟 --band 一起用"); sys.exit(2)
    if sh is not None and band is None:
        print("--shift 要跟 --band 一起用"); sys.exit(2)
    if shx is not None and band is None:
        print("--shiftx 要跟 --band 一起用"); sys.exit(2)
    if len(argv) < 2:
        print(__doc__); sys.exit(2)

    w1, h1, bpp, p1 = load(argv[0])
    w2, h2, _,   p2 = load(argv[1])
    if (w1, h1) != (w2, h2):
        print(f"尺寸不同:{w1}x{h1} vs {w2}x{h2}"); sys.exit(1)

    if band:
        y0, y1 = band
        x0, x1 = xr if xr else (0, w1)
        if not (0 <= y0 < y1 <= h1 and 0 <= x0 < x1 <= w1):
            print(f"帶狀範圍超出圖片({w1}x{h1})"); sys.exit(2)
        band_compare(p1, p2, w1, h1, bpp, y0, y1, x0, x1,
                     sh[0] if sh else 0, shx[0] if shx else 0)
        return

    rows = {}
    for y in range(h1):
        o = y * w1 * bpp
        n = sum(1 for x in range(0, w1*bpp, bpp) if p1[o+x:o+x+3] != p2[o+x:o+x+3])
        if n: rows[y] = n
    tot = sum(rows.values())
    print(f"{w1}x{h1}  不同像素 {tot} / {w1*h1}  ({tot/(w1*h1)*100:.4f}%)")
    if not rows:
        return
    ys = sorted(rows)
    print(f"  出現在 y={ys[0]}..{ys[-1]},共 {len(ys)} 列")
    top = sorted(rows.items(), key=lambda kv: -kv[1])[:6]
    print("  差最多:", ", ".join(f"y={y}({n}px)" for y, n in top))

    # 連續的列切成群。只講「y=a..b」對帳不了 ——「差異出現在 793..2089」可能是
    # 一整片往下推,也可能是四個分開的小塊,兩者意思完全不同。
    # (`ADOPTION.md`「工具還缺什麼」第 2 條。給列群,還沒給 x 方向的區域。)
    groups, start, prev = [], ys[0], ys[0]
    for y in ys[1:]:
        if y - prev > 3:
            groups.append((start, prev)); start = y
        prev = y
    groups.append((start, prev))
    print(f"  切成 {len(groups)} 群:")
    for a, b in groups:
        n = sum(rows[y] for y in range(a, b + 1) if y in rows)
        print(f"    y={a}..{b}  ({b-a+1} 列, {n}px)")


if __name__ == "__main__":
    main()
