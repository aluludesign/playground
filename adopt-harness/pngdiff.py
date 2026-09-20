#!/usr/bin/env python3
"""比對兩張 Chrome 截圖,回報差異的像素數和位置。
沒有 PIL,自己解 PNG(8-bit,RGB 或 RGBA,非交錯 —— Chrome 截圖就是這種)。"""
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
def main():
    w1, h1, bpp, p1 = load(sys.argv[1])
    w2, h2, _,   p2 = load(sys.argv[2])
    if (w1, h1) != (w2, h2):
        print(f"尺寸不同:{w1}x{h1} vs {w2}x{h2}"); sys.exit(1)

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
