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

**它第一次跑就抓到一個真的。** 這支還在一條沒合併的分支上,監督那個 session
拿去掃當時的 `main`,立刻報出 `shots/adminwish` 同時掛著 ⚠ 和 ✅ ——
那是最早那個缺陷,我的分支修了、而 `main` 沒有。**寫這支的那一輪只打算防止
再犯,結果它先找出了一個已經在的。** 這件事本身就是它存在的理由:
那兩列並存了好幾個 commit、經過好幾個人的眼睛,沒有人看出來。
"""
import io
import re
import sys

MARKS = "✅⚠🔸"
ROW = re.compile(r"^\|\s*`(shots/[^`]+)`\s*\|\s*(.)")


def main(path):
    text = io.open(path, encoding="utf-8").read()
    ptr_ok, ptr_msg = one_pointer(path, text)
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
    if not bad and ptr_ok:
        print("✓ %d 個名字、%d 列,沒有一個名字有兩個相反的判決。" % (len(rows), total))
        print(ptr_msg)
        return 0
    if not ptr_ok:
        print(ptr_msg, file=sys.stderr)
    if not bad:
        return 1
    print("✗ 同一個名字有相反的判決 —— 加一列不等於撤回一列:", file=sys.stderr)
    for name, hits in bad:
        where = "、".join("第 %d 行 %s" % (n, s) for n, s in hits)
        print("    %s  →  %s" % (name, where), file=sys.stderr)
    return 1



def one_pointer(path, text):
    """「下一塊的基準用 ___」只能有一行。

    **這一條是合併教的。** 兩個人各自更新了那一行,位置離得夠遠,git 沒有衝突 ——
    於是整張表最重要的那一行同時指向兩組不同的圖,而上面那個檢查只看表格列,
    完全看不到它。「合併乾淨」和「合起來講得通」是兩件事。
    """
    hits = [(i + 1, ln.strip()) for i, ln in enumerate(text.split("\n"))
            if ln.startswith("**下一塊的基準用")]
    if len(hits) == 1:
        return True, "✓ 「下一塊的基準用」只有一行:第 %d 行。" % hits[0][0]
    if not hits:
        return False, "✗ 找不到「下一塊的基準用 ___」那一行 —— 下一個人不知道該拿哪一組對帳。"
    return False, ("✗ 「下一塊的基準用」出現 %d 次,而它只能有一個答案:\n" % len(hits)
                   + "\n".join("    第 %d 行  %s" % (n, t[:70]) for n, t in hits))

if __name__ == "__main__":
    here = __file__.rsplit("/", 1)[0]
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else here + "/ADOPTION.md"))
