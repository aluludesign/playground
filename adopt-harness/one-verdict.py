#!/usr/bin/env python3
"""ADOPTION.md 的基準表:同一個名字不可以有兩個相反的判決。

  ./one-verdict.py                 # 檢查 ADOPTION.md
  ./one-verdict.py <檔案>

為什麼要有這支:這件事在兩個 commit 裡連續發生了兩次,第二次就發生在
**寫下「不可以這樣」那條規矩的同一個 commit 裡**。

    026c0e1  修掉 `shots/adminwish` 的兩列相反判決,並寫下判準
    f96fa42  對 `shots/adminwish-on-main` 做了一模一樣的事

形狀是:一組基準過期了,於是**加一列 ⚠ 說它作廢** —— 而底下那列 ✅
「最新的乾淨基準」還在。**加一列是補充,不是撤回。** 兩列相鄰、結論相反,
下一個人讀到哪一列取決於他從哪裡開始掃。

這個 repo 對畫面有截圖、對行為有探針,**而它一半的判斷寫在散文裡,沒有任何
東西在看那些散文有沒有自相矛盾**。這支補最便宜的那一半:名字對判決。

**只看第二欄開頭的那個符號,不要找整行有沒有出現 ✅。**
那個坑是實際踩到的:某一列的**內文引用**了「這一列以前是 ✅『最新的乾淨基準』」,
用整行比對就會把一列 ⚠ 讀成 ✅ —— 於是拿一個錯的量測去指正別人。
**自己寫的檢查也會量錯,而量錯的檢查比沒有檢查更糟:它會發出綠燈。**
"""
import io
import re
import sys

MARKS = "✅⚠🔸"
ROW = re.compile(r"^\|\s*`(shots/[^`]+)`\s*\|\s*(.)")


def main(path):
    rows = {}
    for n, line in enumerate(io.open(path, encoding="utf-8"), 1):
        m = ROW.match(line)
        if not m:
            continue
        name, mark = m.group(1), m.group(2)
        # 判決欄不是以符號開頭的,這支不管它 —— 寧可漏報也不要誤報
        if mark in MARKS:
            rows.setdefault(name, []).append((n, mark))

    bad = [(k, v) for k, v in rows.items() if len({s for _, s in v}) > 1]
    total = sum(len(v) for v in rows.values())
    if not bad:
        print("✓ %d 個名字、%d 列,沒有一個名字有兩個相反的判決。" % (len(rows), total))
        return 0
    print("✗ 同一個名字有相反的判決 —— 加一列不等於撤回一列:", file=sys.stderr)
    for name, hits in bad:
        where = "、".join("第 %d 行 %s" % (n, s) for n, s in hits)
        print("    %s  →  %s" % (name, where), file=sys.stderr)
    return 1


if __name__ == "__main__":
    here = __file__.rsplit("/", 1)[0]
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else here + "/ADOPTION.md"))
