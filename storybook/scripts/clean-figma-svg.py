#!/usr/bin/env python3
"""把 Figma 匯出的 icon SVG（download_assets 的 export）整理成只有 icon 本身。

Figma 匯出單一 variant 時會連外層 section／component set 的底色、虛線框一起畫進來，
真正的 icon 在 <g id="Style=…"> 裡。這裡只取那個 g（加上根層 defs），
再拿掉沒被 url(#…) 參照的 id。

用法：python3 scripts/clean-figma-svg.py <輸入資料夾> <輸出資料夾>
輸入檔名：<組名>__<樣式>.svg → 輸出：icon_<組名>_<樣式>.svg
"""
import glob, os, re, sys
import xml.etree.ElementTree as ET

NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
src, out = sys.argv[1], sys.argv[2]
for f in sorted(glob.glob(os.path.join(src, "*__*.svg"))):
    name, style = os.path.basename(f)[:-4].split("__")
    root = ET.parse(f).getroot()
    g = [e for e in root.iter("{%s}g" % NS) if e.get("id", "").startswith("Style=")]
    if len(g) != 1:
        sys.exit(f"{f}: 找不到唯一的 <g id=\"Style=…\">")
    svg = ET.Element("{%s}svg" % NS, {k: root.get(k) for k in ("width", "height", "viewBox")})
    svg.set("fill", "none")
    svg.append(g[0])
    for d in root.findall("{%s}defs" % NS):
        svg.append(d)
    s = ET.tostring(svg, encoding="unicode")
    refs = set(re.findall(r"url\(#([^)]+)\)", s)) | set(re.findall(r'href="#([^"]+)"', s))
    s = re.sub(r' id="([^"]*)"', lambda m: m.group(0) if m.group(1) in refs else "", s)
    with open(os.path.join(out, f"icon_{name}_{style}.svg"), "w") as fh:
        fh.write(s + "\n")
    print("ok", name, style)
