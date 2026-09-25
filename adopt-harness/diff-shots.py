#!/usr/bin/env python3
"""比兩組截圖,回報「差了幾個像素」,而不是「一不一樣」。

**為什麼不能用 cmp。** 同一個 commit 連拍兩次,02-plan-desktop 會差 21 個像素 ——
文字反鋸齒的抖動,顏色差一階,眼睛看不出來。用位元組比對的話,每一輪都會有一張
無意義的紅字,而「反正那張本來就會紅」正是一個真的改動可以躲進去的地方。

**只數「幾個像素不同」也不夠。** 2026-09-23 又量到一組:花費那一頁差了
31954 個像素,而兩張圖並排看**完全一樣** —— 整頁的字在次像素位置上差一點點,
每個字的邊緣都算進去,數量就這樣堆上來了。
一個真的移動剛好相反:**像素不多,但每一個都差很多**(白底上冒出一塊深色的字)。

所以現在數兩個數字:不同的像素數,以及其中**單一通道差超過 24** 的那些。
**判決看後者**,前者只印出來給人看。

**光看振幅還是會判錯,而且兩邊都判錯過。** 2026-09-25 量到:同一份程式碼連拍三次,
其中一次的 02-plan-desktop 有 4308 個「看得出來」的像素 —— 而那一帶
**位移 1 列之後逐位元組相同**:天氣那一行的子像素捨入翻了一格,內容一個字都沒變。
同一輪裡真正改了字的 20-signin-gate(「東京五人行」→「Trippps」)只有 3490 個,
反而低於門檻被判成抖動。**它把雜訊叫成改動,把改動叫成雜訊。**

所以在算振幅之前先問一句:**這一帶是被改掉了,還是只是被推走了。**
把有差異的列切成帶,每一帶試 ±2 列 / ±2 行的位移;位移之後看得出來的像素歸零,
就是推走了,不算改動(會印出推了幾列,你還是看得到它)。
剩下的才拿去比門檻。

分四級:
  0                完全一樣
  位移             內容一樣,只是移了一兩個像素 —— 印出來,不當成改動
  1 ~ 門檻          反鋸齒等級的抖動 —— 記下來,不當成改動
  > 門檻            真的變了,要去看圖

**門檻不是猜的。** 扣掉位移之後,同一份程式碼連拍三次量到的殘差是 0;
而最小的一個真改動(換三個字)是 3490。中間整個是空的,300 落在那裡面。
舊的 5000 是在「位移」這一級還不存在的時候訂的 —— 那時候它得同時容忍位移造成的
幾千個像素,於是只好訂得比真改動還高。**修掉源頭之後,門檻才降得下來。**

用法: ./diff-shots.py shots/舊 shots/新 [門檻]
兩邊檔名對不起來(多一張、少一張)一律當成要回報的事,不是靜靜跳過。
"""
import struct, zlib, sys, os

def rows(p):
    d = open(p, 'rb').read(); i = 8; idat = b''
    while i < len(d):
        ln = struct.unpack('>I', d[i:i+4])[0]; t = d[i+4:i+8]
        if t == b'IHDR': w, h, bd, ct = struct.unpack('>IIBB', d[i+8:i+18])
        if t == b'IDAT': idat += d[i+8:i+8+ln]
        i += 12 + ln
    raw = zlib.decompress(idat); ch = {0:1, 2:3, 3:1, 4:2, 6:4}[ct]; st = w*ch + 1
    out = []; prev = bytearray(w*ch)
    for y in range(h):
        f = raw[y*st]; line = bytearray(raw[y*st+1:(y+1)*st])
        if f:
            for x in range(len(line)):
                a = line[x-ch] if x >= ch else 0; b = prev[x]; c = prev[x-ch] if x >= ch else 0
                if f == 1: line[x] = (line[x]+a) & 255
                elif f == 2: line[x] = (line[x]+b) & 255
                elif f == 3: line[x] = (line[x]+(a+b)//2) & 255
                else:
                    pp = a+b-c; pa = abs(pp-a); pb = abs(pp-b); pc = abs(pp-c)
                    line[x] = (line[x] + (a if (pa <= pb and pa <= pc) else (b if pb <= pc else c))) & 255
        out.append(bytes(line)); prev = line
    return w, h, ch, out

old, new = sys.argv[1], sys.argv[2]
thr = int(sys.argv[3]) if len(sys.argv) > 3 else 300
AMP = 24    # 單一通道差多少才算「看得出來」
SHIFT = 2   # 位移最多試幾個像素。再大就不是捨入了,是真的搬家


def strong_of(A, B, w, ch, y0, y1, dy, dx):
    """A 的 y0..y1 這一帶,對上 B 往 (dy, dx) 位移之後的同一帶,看得出來的像素有幾個。
       超出邊界回 None。"""
    n = 0
    for y in range(y0, y1):
        yy = y + dy
        if yy < 0 or yy >= len(B): return None
        ra, rb = A[y], B[yy]
        if dx >= 0: sa, sb = ra[0:(w-dx)*ch], rb[dx*ch:w*ch]
        else:       sa, sb = ra[-dx*ch:w*ch], rb[0:(w+dx)*ch]
        if sa == sb: continue        # 這一列位移後完全一樣,不用逐點看
        for x in range(0, len(sa), ch):
            if sa[x:x+ch] != sb[x:x+ch]:
                if max(abs(sa[x+c] - sb[x+c]) for c in range(min(ch, 3))) > AMP: n += 1
    return n


def bands_of(ys, gap=4):
    """有差異的列切成連續的帶。隔 gap 列以內算同一帶 —— 一行字的上下緣中間
       常常有幾列剛好一樣,切太碎的話每一小段都要各自找位移,又慢又容易對錯。"""
    out = []
    for y in ys:
        if out and y - out[-1][1] <= gap: out[-1][1] = y + 1
        else: out.append([y, y + 1])
    return out
names = sorted(set(os.listdir(old)) | set(os.listdir(new)))
names = [n for n in names if n.endswith('.png')]
real = 0
for n in names:
    a, b = os.path.join(old, n), os.path.join(new, n)
    if not os.path.exists(a): print("新增  %s(舊的那一組沒有)" % n); real += 1; continue
    if not os.path.exists(b): print("不見  %s(新的那一組沒有)" % n); real += 1; continue
    wa, ha, ch, A = rows(a); wb, hb, _, B = rows(b)
    if (wa, ha) != (wb, hb):
        print("尺寸變了 %s  %dx%d → %dx%d" % (n, wa, ha, wb, hb)); real += 1; continue
    diff = 0; strong = 0; hot = []
    for y in range(ha):
        if A[y] != B[y]:
            hot.append(y)
            ra, rb = A[y], B[y]
            for x in range(0, wa*ch, ch):
                if ra[x:x+ch] != rb[x:x+ch]:
                    diff += 1
                    if max(abs(ra[x+c] - rb[x+c]) for c in range(min(ch, 3))) > AMP: strong += 1

    # 先問「是被改掉還是被推走」。只在有看得出來的差異時才問 —— 純反鋸齒的抖動
    # 本來就不會被當成改動,不值得為它跑一輪位移搜尋。
    moved = []
    if strong:
        rest = 0
        for y0, y1 in bands_of(hot):
            base = strong_of(A, B, wa, ch, y0, y1, 0, 0)
            if not base: continue
            best = None
            for dy in range(-SHIFT, SHIFT + 1):
                for dx in range(-SHIFT, SHIFT + 1):
                    if dy == 0 and dx == 0: continue
                    v = strong_of(A, B, wa, ch, y0, y1, dy, dx)
                    if v is None: continue
                    if best is None or v < best[0]: best = (v, dy, dx)
                    if v == 0: break
                if best and best[0] == 0: break
            if best and best[0] == 0:
                moved.append((y0, y1, best[1], best[2]))
            else:
                rest += base
        strong = rest

    if diff == 0: print("一樣  %s" % n)
    elif moved and strong <= thr:
        how = ",".join("y=%d..%d 推了 %+d 列 %+d 行" % (a, b, dy, dx) for a, b, dy, dx in moved)
        print("位移  %s  %s —— 位移之後逐位元組相同,內容沒變%s"
              % (n, how, ("(另外還有 %d 個看得出來的像素)" % strong) if strong else ""))
    elif strong <= thr:
        print("抖動  %s  %d 個像素,看得出來的只有 %d 個(門檻 %d)" % (n, diff, strong, thr))
    else:
        print("變了  %s  %d 個像素,扣掉位移之後還有 %d 個看得出來" % (n, diff, strong)); real += 1
print("\n%d 張裡面,%d 張是真的變了" % (len(names), real))
sys.exit(1 if real else 0)
