#!/usr/bin/env python3
"""把兩張截圖的同一塊區域並排切出來,人眼看得到差別在哪。

pngdiff.py 只回報「差異出現在 y=a..b」,要判斷「那是我要的改變嗎」還是得看圖。
`ADOPTION.md`「工具還缺什麼」第 2 條講的就是這件事 —— 這支先補上最便宜的一半:
給定 y 範圍,把 before / after 並排成一張,中間畫一條分隔線。

  ./crop.py <before.png> <after.png> <y0> <y1> <out.png> [dy]

`dy` 把右邊那張往下位移 dy 列再切。每一塊轉換都會把下面的東西整片往下推,
所以「同一個 y 切兩張」切到的常常根本不是同一個元件 —— 看起來像「整個變了」,
其實只是錯位。先用 `pngdiff.py --band ... --shift N` 問出最佳位移,再把那個數字
帶進來,兩邊就對齊了,眼睛看到的才是**同一個東西的前後**。
"""
import sys, zlib, struct

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from pngdiff import load


def write_png(path, w, h, rows, bpp):
    raw = b''.join(b'\x00' + bytes(r) for r in rows)
    def chunk(t, b):
        c = t + b
        return struct.pack('>I', len(b)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6 if bpp == 4 else 2, 0, 0, 0)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
                           + chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b''))


def main():
    a_path, b_path, y0, y1, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
    dy = int(sys.argv[6]) if len(sys.argv) > 6 else 0
    aw, ah, abpp, apx = load(a_path)
    bw, bh, bbpp, bpx = load(b_path)
    assert aw == bw and abpp == bbpp, "兩張圖的寬度或色彩格式不同,沒辦法並排"
    y1 = min(y1, ah, bh - dy)
    y0 = max(y0, -dy)
    gap, bpp = 8, abpp
    w = aw * 2 + gap
    rows = []
    for y in range(y0, y1):
        ar = apx[y * aw * bpp:(y + 1) * aw * bpp]
        br = bpx[(y + dy) * bw * bpp:(y + dy + 1) * bw * bpp]
        sep = bytes([255, 0, 0] + ([255] if bpp == 4 else [])) * gap
        rows.append(bytes(ar) + sep + bytes(br))
    write_png(out, w, len(rows), rows, bpp)
    print(f"→ {out}  ({w}x{len(rows)})  左=before 右=after(往下位移 {dy} 列),中間紅線")


main()
