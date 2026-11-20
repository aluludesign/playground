#!/usr/bin/env python3
"""把本機裝的源泉圓體、全瀨體切成很多小塊 woff2，給 App 用（tokyo-trip/ds/fonts/）。

Storybook 的 src/fonts/ 是精簡版（只有展示頁用到的字），App 裡的地名、留言什麼字都有，
所以 App 用的是完整字型、照常用程度切塊：瀏覽器只下載頁面上用得到的那幾塊。
切法照 Google Fonts 給 Noto Sans TC 的 unicode-range（scripts/noto-sans-tc-ranges.txt），
字型裡有、但那份清單沒有的字（日文假名、罕用字…）另外依碼位排成幾塊放最後。

需要：pip install fonttools brotli
    python3 scripts/slice-fonts-app.py            # 字型預設在 ~/Library/Fonts
字型或切法改了才要重跑；產出的檔案要 commit。
"""
import os, re, sys, hashlib
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "..", "tokyo-trip", "ds", "fonts")
FONTS = os.environ.get("FONTS", os.path.expanduser("~/Library/Fonts"))
RANGES = os.path.join(ROOT, "scripts", "noto-sans-tc-ranges.txt")

# 元件用到的字重：400 regular、500 medium、600 semi-bold（源泉圓體沒有 600，用 B）、700 bold、900（Headline 的 H）
# 只重切其中幾個：ONLY=gensen-h python3 scripts/slice-fonts-app.py
FACES = [
    ("GenSenRounded2 TW", 400, "GenSenRounded2TW-R.otf", "gensen-r"),
    ("GenSenRounded2 TW", 500, "GenSenRounded2TW-M.otf", "gensen-m"),
    ("GenSenRounded2 TW", 700, "GenSenRounded2TW-B.otf", "gensen-b"),
    ("GenSenRounded2 TW", 900, "GenSenRounded2TW-H.otf", "gensen-h"),  # Headline 用 H
    ("cjkFonts", 400, "cjkFonts_allseto_v1.11.ttf", "allseto"),
]
REST = 400  # 清單外的字每幾個切一塊


def parse_ranges(text):
    groups = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        cps = set()
        for part in line.split(","):
            part = part.strip().upper().replace("U+", "")
            if "-" in part:
                a, b = part.split("-")
                cps.update(range(int(a, 16), int(b, 16) + 1))
            else:
                cps.add(int(part, 16))
        groups.append(cps)
    return groups


def to_range(cps):
    cps = sorted(cps)
    out, start, prev = [], cps[0], cps[0]
    for c in cps[1:] + [None]:
        if c is not None and c == prev + 1:
            prev = c
            continue
        out.append("U+%X" % start if start == prev else "U+%X-%X" % (start, prev))
        if c is not None:
            start = prev = c
    return ",".join(out)


def main():
    groups = parse_ranges(open(RANGES, encoding="utf8").read())
    os.makedirs(OUT, exist_ok=True)
    only = [x for x in os.environ.get("ONLY", "").split(",") if x]
    total = 0
    for family, weight, file, slug in FACES:
        if only and slug not in only:
            continue
        for f in os.listdir(OUT):
            if f.startswith(slug + "-") and f.endswith(".woff2"):
                os.remove(os.path.join(OUT, f))
        css = []
        path = os.path.join(FONTS, file)
        if not os.path.exists(path):
            sys.exit("找不到字型：" + path)
        have = set(TTFont(path, lazy=True).getBestCmap().keys())
        chunks = [g & have for g in groups]
        listed = set().union(*groups)
        rest = sorted(have - listed)
        chunks += [set(rest[i:i + REST]) for i in range(0, len(rest), REST)]
        chunks = [c for c in chunks if c]
        for i, cps in enumerate(chunks):
            opts = subset.Options()
            opts.flavor = "woff2"
            opts.layout_features = ["*"]
            opts.name_IDs = ["*"]
            opts.notdef_outline = False
            font = TTFont(path)
            s = subset.Subsetter(opts)
            s.populate(unicodes=cps)
            s.subset(font)
            name = "%s-%03d.woff2" % (slug, i)
            font.flavor = "woff2"
            font.save(os.path.join(OUT, name))
            total += os.path.getsize(os.path.join(OUT, name))
            css.append(
                '@font-face{font-family:"%s";font-weight:%d;font-display:swap;src:url("./fonts/%s") format("woff2");unicode-range:%s}'
                % (family, weight, name, to_range(cps))
            )
        open(os.path.join(OUT, slug + ".css"), "w", encoding="utf8").write("\n".join(css) + "\n")
        print(slug, len(chunks), "塊")
    # 每個字型一份 css，最後併成 ds/fonts.css（App 載這一支）
    parts = ["/* 由 storybook/scripts/slice-fonts-app.py 產生，不要手改。 */"]
    for _, _, _, slug in FACES:
        f = os.path.join(OUT, slug + ".css")
        if os.path.exists(f):
            parts.append(open(f, encoding="utf8").read().strip())
    open(os.path.join(OUT, "..", "fonts.css"), "w", encoding="utf8").write("\n".join(parts) + "\n")
    print("這次切了 %.1f MB" % (total / 1e6))


if __name__ == "__main__":
    main()
