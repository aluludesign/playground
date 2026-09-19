#!/usr/bin/env python3
"""把 tokyo-trip 的內嵌樣式包進 @layer components。

為什麼要包:沒有 layer 的 CSS 在階層上永遠贏過 @layer utilities,
所以逐塊換 utility 的中間態裡,舊的組件 class 會安靜地蓋掉新的 utility。

刻意不做的兩件事:
1. 不寫 @layer 的順序宣告。那歸 design-system —— 兩邊都寫的話,
   誰的先載入誰說了算,又變成靠運氣。
2. :root 那條留在 layer 外面。自訂屬性一旦進了 layer,任何無層級的
   :root 都蓋得過它;留在外面則永遠是我說了算。名字目前不衝突
   (我的是 --paper,它的是 --rm-*),但這個失敗是全站變色,不值得賭。
"""
import re, sys

p = sys.argv[1] if len(sys.argv) > 1 else "tokyo-trip/index.html"
h = open(p, encoding="utf-8").read()

a = h.index("<style>") + len("<style>")
b = h.index("</style>")
css = h[a:b]
assert "@layer" not in css, "已經包過了"

# :root{...} 抓出來放外面
m = re.match(r"(\s*:root\{.*?\}\s*)", css, re.S)
assert m, "找不到開頭的 :root 區塊"
root, rest = m.group(1), css[m.end():]

indented = "\n".join(("  " + l if l.strip() else l) for l in rest.split("\n"))
new = (root.rstrip("\n") + "\n\n"
       + "  /* 組件全部收進 components 層。無層級的 CSS 贏過 @layer utilities,\n"
       + "     不收的話逐塊換 utility 時,舊樣式會安靜蓋掉新的。\n"
       + "     層的先後由 design-system 宣告,這裡不寫,免得兩邊搶。\n"
       + "     :root 留在外面 —— 自訂屬性進了層就會輸給任何無層級的 :root。 */\n"
       + "  @layer components {\n" + indented.rstrip() + "\n  }\n")

open(p, "w", encoding="utf-8").write(h[:a] + new + h[b:])
print(f"包好了:{rest.count(chr(10))} 行進 @layer components,:root {root.count(chr(10))} 行留在外面")
