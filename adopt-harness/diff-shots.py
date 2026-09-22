#!/usr/bin/env python3
"""比兩組截圖,回報「差了幾個像素」,而不是「一不一樣」。

**為什麼不能用 cmp。** 同一個 commit 連拍兩次,02-plan-desktop 會差 21 個像素 ——
文字反鋸齒的抖動,顏色差一階,眼睛看不出來。用位元組比對的話,每一輪都會有一張
無意義的紅字,而「反正那張本來就會紅」正是一個真的改動可以躲進去的地方。

所以這裡數像素,並且分三級:
  0                  完全一樣
  1 ~ 門檻(預設 200) 反鋸齒等級的抖動 —— 記下來,不當成改動
  > 門檻             真的變了,要去看圖

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
thr = int(sys.argv[3]) if len(sys.argv) > 3 else 200
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
    diff = 0
    for y in range(ha):
        if A[y] != B[y]:
            ra, rb = A[y], B[y]
            for x in range(0, wa*ch, ch):
                if ra[x:x+ch] != rb[x:x+ch]: diff += 1
    if diff == 0: print("一樣  %s" % n)
    elif diff <= thr: print("抖動  %s  %d 個像素(在 %d 以內,當成反鋸齒)" % (n, diff, thr))
    else: print("變了  %s  %d 個像素" % (n, diff)); real += 1
print("\n%d 張裡面,%d 張是真的變了" % (len(names), real))
sys.exit(1 if real else 0)
