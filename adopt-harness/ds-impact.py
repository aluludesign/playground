#!/usr/bin/env python3
"""設計系統更新之後:**這次重編有沒有動到我們真的在用的東西?**

    ./adopt-harness/ds-impact.py 舊的產出.css 新的產出.css [消費端.html]

**為什麼需要這一支。** 逐像素比對答不了這個問題 —— 它會把「地圖取景那個已知的
不穩」一起算進去,而那幾張每一輪都會飄。2026-09-24 量過一次:只換 CSS 拍兩組,
三張有差;同一份 CSS 連拍兩組,其中兩張照樣有差。剩下那一張兩邊各一次,
**用截圖再拍幾輪也只是把機率往下壓,不會變成證明**。

這一支換一個問法:把消費端真正用到的 class 全部抓出來(`class="…"` 和 JS 裡
`classList.add/toggle/remove` 的那些),逐條比較它們在新舊產出裡的規則。
**一條都沒變 → 重編不可能改變畫面**,那是證明,不是樣本。

回傳 0 = 沒動到;1 = 有動到(名單印出來,那幾個要去看)。
"""
import re, sys, io

def rules_for(css, cls):
    out = []
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', css):
        sel, body = m.group(1), m.group(2)
        if re.search(r'\.' + re.escape(cls) + r'(?![\w-])', sel):
            out.append(sel.strip() + "{" + body.strip() + "}")
    return out

old = io.open(sys.argv[1], encoding="utf-8").read()
new = io.open(sys.argv[2], encoding="utf-8").read()
html = io.open(sys.argv[3] if len(sys.argv) > 3 else "tokyo-trip/index.html", encoding="utf-8").read()

used = set()
for m in re.finditer(r'class="([^"]+)"', html):
    for c in m.group(1).split():
        if c and not c.startswith("{"):
            used.add(c)
for m in re.finditer(r'classList\.(?:add|toggle|remove)\("([^"]+)"', html):
    used.add(m.group(1))

diff = [c for c in sorted(used) if rules_for(old, c) != rules_for(new, c)]
print("消費端用到的 class:", len(used), "個")
if diff:
    print("**規則有變的:**")
    for c in diff:
        print("  ." + c)
    print("\n→ 這幾個要去看畫面。")
    sys.exit(1)
print("規則有變的: 一個都沒有 → 這次重編不會改變畫面")
sys.exit(0)
