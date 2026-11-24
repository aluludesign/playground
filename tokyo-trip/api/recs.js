// Trippps · 許願搜尋的「推薦」清單(2026-11-25,Lulu:用維基＋OpenStreetMap,不用 Google)
//
// GET /api/recs?lat=35.68&lon=139.77  → { items: [{ n, a, la, lo, ph, k, w }] }
//   n 名字(繁中優先)、a 其他名字(日/英,打字比對用)、la/lo 座標、ph 維基共享資源照片頁、k 類型、w 有幾種語言的維基寫過(排序用)
//
// 為什麼在伺服器查、而且要存:
//   這幾個免費服務即時查都不穩(2026-11-25 實測:Overpass 三台都 30 秒沒回應或 502/504、Wikidata 查詢服務一次 5 秒一次 40 秒沒回應)。
//   所以同一個城市只查一次,查到就讓 Vercel 的 CDN 存一週(同一個網址大家共用);查不到回 503、不存,下一個人打開時再試。
//   維基和 OpenStreetMap 的資料可以合法存(CC0／ODbL),Google 的不行 —— 這也是不用 Google 的原因之一。
//
// 候選從兩邊來,合在一起用 Wikidata 的條目資料排:
//   OpenStreetMap(Overpass):城市方圓 8 公里內標了 wikidata 的景點、博物館、展望台、史蹟、公園、寺廟神社
//   維基(Wikidata 查詢服務):方圓 8 公里內、10 種語言以上的維基寫過的條目,只留景點類(見 KEEP)
//   排序:有幾種語言的維基寫過這個地方(sitelinks),越多越前面。

const UA = "Trippps/1.0 (trip planner; recs)";
const R_KM = 8;

/* 維基那邊的候選要是這幾種東西才留(OSM 那邊本來就是用景點類的標籤挑的,不再過濾) */
const KEEP = {
  Q570116: "景點", Q44539: "寺廟", Q5393308: "寺廟", Q160742: "寺廟", Q845945: "神社", Q697295: "神社",
  Q33506: "博物館", Q207694: "美術館", Q1007870: "美術館", Q17431399: "博物館", Q2087181: "博物館",
  Q22698: "公園", Q22746: "公園", Q1107656: "庭園", Q2977: "教堂", Q16970: "教堂",
  Q12518: "塔", Q1440300: "展望台", Q11166728: "電波塔", Q11303: "摩天大樓",
  Q23413: "城", Q92026: "城", Q16560: "宮殿", Q4989906: "紀念碑", Q5003624: "紀念館",
  Q194195: "遊樂園", Q2416723: "主題樂園", Q43501: "動物園", Q2281788: "水族館",
  Q11315: "購物中心", Q216107: "百貨公司", Q37654: "市場",
  Q12280: "橋", Q24354: "劇場", Q483110: "體育場", Q1329623: "文化中心",
  Q123705: "街區", Q174782: "廣場", Q39614: "墓園",
};
/* OSM 標籤 → 給人看的類型 */
const OSM_KIND = t => t.tourism === "museum" ? "博物館" : t.tourism === "gallery" ? "美術館" : t.tourism === "viewpoint" ? "展望台"
  : t.tourism === "theme_park" ? "主題樂園" : t.tourism === "zoo" ? "動物園" : t.tourism === "aquarium" ? "水族館"
  : t.leisure === "park" || t.leisure === "garden" ? "公園" : t.amenity === "place_of_worship" ? (t.religion === "shinto" ? "神社" : t.religion === "buddhist" ? "寺廟" : "教堂")
  : t.historic ? "史蹟" : "景點";

const timed = (url, init, ms) => {
  const ac = new AbortController(), id = setTimeout(() => ac.abort(), ms);
  return fetch(url, Object.assign({}, init, { signal: ac.signal, headers: Object.assign({ "User-Agent": UA }, (init || {}).headers || {}) }))
    .then(r => { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
    .finally(() => clearTimeout(id));
};

async function fromOSM(la, lo) {
  const a = "(around:" + R_KM * 1000 + "," + la + "," + lo + ")";
  const q = "[out:json][timeout:15];(" +
    'nwr[tourism~"^(attraction|museum|viewpoint|theme_park|zoo|aquarium|gallery)$"][wikidata]' + a + ";" +
    "nwr[historic][wikidata]" + a + ";" +
    'nwr[leisure~"^(park|garden)$"][wikidata]' + a + ";" +
    "nwr[amenity=place_of_worship][wikidata]" + a + ";" +
    ");out center tags 500;";
  /* 一台不回就換下一台;都不回就算了(維基那邊還有) */
  for (const host of ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"]) {
    try {
      const j = await timed(host, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } }, 9000);
      const out = {};
      (j.elements || []).forEach(e => {
        const t = e.tags || {}, id = String(t.wikidata || "").trim();
        if (!/^Q\d+$/.test(id) || out[id]) return;
        const la2 = e.lat != null ? e.lat : e.center && e.center.lat, lo2 = e.lon != null ? e.lon : e.center && e.center.lon;
        out[id] = { k: OSM_KIND(t), la: la2, lo: lo2, osm: t["name:zh-Hant"] || t["name:zh-TW"] || t["name:zh"] || "", ja: t["name:ja"] || t.name || "" };
      });
      return out;
    } catch (_) { /* 換下一台 */ }
  }
  return null;
}

async function fromWiki(la, lo) {
  const q = 'SELECT ?item ?links WHERE { SERVICE wikibase:around { ?item wdt:P625 ?c. bd:serviceParam wikibase:center "Point(' + lo + " " + la +
    ')"^^geo:wktLiteral. bd:serviceParam wikibase:radius "' + R_KM + '". } ?item wikibase:sitelinks ?links. FILTER(?links >= 10) } ORDER BY DESC(?links) LIMIT 300';
  try {
    const j = await timed("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), { headers: { Accept: "application/sparql-results+json" } }, 15000);
    return (j.results && j.results.bindings || []).map(b => b.item.value.split("/").pop()).filter(id => /^Q\d+$/.test(id));
  } catch (_) { return null; }
}

/* Wikidata 的條目資料(這個 API 很穩,一次 50 筆):幾種語言寫過、各語言名字、照片、座標、是什麼 */
async function entities(ids) {
  const out = {}, urls = [];
  for (let i = 0; i < ids.length; i += 50)
    urls.push("https://www.wikidata.org/w/api.php?format=json&maxlag=5&action=wbgetentities&props=labels|claims|sitelinks&languages=zh-tw|zh-hant|zh-hk|zh|ja|en&ids=" + ids.slice(i, i + 50).join("|"));
  /* 一次最多兩批(一次全丟會被回 429「太多次」);一批沒拿到等 1.5 秒再試一次
     (實測偶爾一批逾時,東京晴空塔、東京鐵塔就整個不見) */
  const one = u => timed(u, {}, 10000).catch(() => new Promise(r => setTimeout(r, 1500)).then(() => timed(u, {}, 10000)))
    .then(j => Object.assign(out, j.entities || {})).catch(() => { /* 兩次都沒拿到就少這一批 */ });
  const lane = async () => { while (urls.length) await one(urls.shift()); };
  await Promise.all([lane(), lane()]);
  return out;
}
/* 維基上只有簡體名字的(「上野动物园」):拿中文維基那一頁的台灣用字標題(中文維基自己會轉) */
async function twTitles(titles) {
  const out = {}, jobs = [];
  for (let i = 0; i < titles.length; i += 50) {
    const url = "https://zh.wikipedia.org/w/api.php?format=json&action=query&prop=info&inprop=varianttitles&titles=" + encodeURIComponent(titles.slice(i, i + 50).join("|"));
    jobs.push(timed(url, {}, 8000).then(j => {
      const norm = {}; ((j.query && j.query.normalized) || []).forEach(x => { norm[x.to] = x.from; });
      Object.values((j.query && j.query.pages) || {}).forEach(p => { const tw = p.varianttitles && (p.varianttitles["zh-tw"] || p.varianttitles["zh-hant"]); if (tw) out[norm[p.title] || p.title] = tw; });
    }).catch(() => {}));
  }
  await Promise.all(jobs);
  return out;
}
const claim = (e, p) => { try { return e.claims[p].map(c => c.mainsnak.datavalue.value); } catch (_) { return []; } };
const label = (e, langs) => { for (const l of langs) if (e.labels && e.labels[l]) return e.labels[l].value; return ""; };

/* 常去的國家直接寫好(維基回 429 的時候國家名稱整個拿不到,實測東京 40 筆全空);其他國家才問 */
const COUNTRY = { Q17: "日本", Q884: "南韓", Q865: "台灣", Q148: "中國", Q8646: "香港", Q14773: "澳門", Q869: "泰國", Q881: "越南",
  Q334: "新加坡", Q833: "馬來西亞", Q252: "印尼", Q928: "菲律賓", Q30: "美國", Q16: "加拿大", Q408: "澳洲", Q664: "紐西蘭",
  Q145: "英國", Q142: "法國", Q183: "德國", Q38: "義大利", Q29: "西班牙", Q45: "葡萄牙", Q39: "瑞士", Q40: "奧地利", Q55: "荷蘭", Q31: "比利時",
  Q213: "捷克", Q41: "希臘", Q43: "土耳其", Q668: "印度", Q711: "蒙古", Q424: "柬埔寨", Q836: "緬甸", Q819: "寮國", Q96: "墨西哥", Q155: "巴西" };

/* 國家、第一級行政區(日本＝都道府縣)(Lulu 11-25:推薦跟熱門地點一樣寫「日本，三重縣 · 主題樂園」)。
   條目的「所在行政區」(P131)往上找,找到上一層就是國家的那一層;一層一層批次問(最多 5 層) */
async function placeNames(items, ents) {
  const all = Object.assign({}, ents);
  const want = ids => { const need = Array.from(new Set(ids.filter(id => id && !all[id]))); return need.length ? entities(need).then(x => Object.assign(all, x)) : null; };
  const zh = e => e ? label(e, ["zh-tw", "zh-hant", "zh-hk", "zh", "ja", "en"]) : "";
  const first = (e, p) => { const v = claim(e || {}, p)[0]; return v && v.id; };
  const walk = items.map(x => { const e = all[x._id]; return { x, land: first(e, "P17"), cur: first(e, "P131"), last: "" }; });
  await want(walk.map(w => w.cur));
  for (let round = 0; round < 5; round++) {
    const go = walk.filter(w => w.cur && !w.done);
    if (!go.length) break;
    go.forEach(w => {
      const e = all[w.cur]; if (!e) { w.done = true; return; }
      const up = first(e, "P131");
      if (!w.land) w.land = first(e, "P17");
      w.last = w.cur;
      if (!up || up === w.land) w.done = true; else w.cur = up;
    });
    await want(walk.filter(w => !w.done).map(w => w.cur));
  }
  /* 國家的條目很大(日本整份資料 10 秒內常常拿不完),國家只要名字:另外問,只拿名字 */
  const lands = Array.from(new Set(walk.map(w => w.land).filter(id => id && !COUNTRY[id] && !(all[id] && all[id].labels))));
  if (lands.length) {
    try {
      const u = "https://www.wikidata.org/w/api.php?format=json&action=wbgetentities&props=labels&languages=zh-tw|zh-hant|zh-hk|zh|ja|en&ids=" + lands.join("|");
      /* 被回 429(太多次)就等 1.5 秒再試一次 */
      const j = await timed(u, {}, 8000).catch(() => new Promise(r => setTimeout(r, 1500)).then(() => timed(u, {}, 8000)));
      Object.assign(all, j.entities || {});
    } catch (_) { /* 拿不到就不寫國家 */ }
  }
  walk.forEach(w => {
    w.x.c = COUNTRY[w.land] || zh(all[w.land]);
    const s = w.last && w.last !== w.land ? zh(all[w.last]) : "";
    if (s && s !== w.x.c) w.x.s = s;
    delete w.x._id;
  });
}

/* 照片最多 3 張(Lulu 11-25):條目上的主圖(可能不只一張)→ 景觀 → 夜景 → 內部 → 空拍;
   不夠 3 張再從這個地方在維基共享資源的分類(P373)補 */
const PHOTO_PROPS = ["P18", "P8517", "P3451", "P5775", "P8592"];
const filePage = f => "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(String(f).replace(/ /g, "_"));
const PHOTO_OK = f => /\.(jpe?g|png|webp)$/i.test(f) && !/(map|karte|plan|logo|diagram|location|locator|seal|emblem|flag|coat.of.arms|位置|地図)/i.test(f);
function wdFiles(e) {
  const out = [];
  PHOTO_PROPS.forEach(p => claim(e, p).forEach(f => { if (typeof f === "string" && PHOTO_OK(f) && out.indexOf(f) < 0) out.push(f); }));
  return out.slice(0, 3);
}
async function fillFromCategory(items) {
  const todo = items.filter(x => x.ps.length < 3 && x.cat);
  const one = async x => {
    try {
      const j = await timed("https://commons.wikimedia.org/w/api.php?format=json&action=query&list=categorymembers&cmtype=file&cmlimit=20&cmtitle=" +
        encodeURIComponent("Category:" + x.cat), {}, 6000);
      ((j.query && j.query.categorymembers) || []).map(m => String(m.title || "").replace(/^File:/, "")).filter(PHOTO_OK).forEach(f => {
        const u = filePage(f);
        if (x.ps.length < 3 && x.ps.indexOf(u) < 0) x.ps.push(u);
      });
      if (!x.ph && x.ps[0]) x.ph = x.ps[0];
    } catch (_) { /* 補不到就照原本的張數 */ }
  };
  const lane = async () => { while (todo.length) await one(todo.shift()); };
  await Promise.all([lane(), lane(), lane()]);
  items.forEach(x => { delete x.cat; });
}

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "只收 GET" });
  /* 座標取到小數第 2 位(約 1 公里):同一個城市的人打同一個網址,CDN 存的那份大家共用 */
  const la = Math.round(parseFloat(req.query.lat) * 100) / 100, lo = Math.round(parseFloat(req.query.lon) * 100) / 100;
  if (!isFinite(la) || !isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return res.status(400).json({ error: "座標不對" });

  const [osm, wiki] = await Promise.all([fromOSM(la, lo), fromWiki(la, lo)]);
  if (!osm && !wiki) { res.setHeader("Cache-Control", "no-store"); return res.status(503).json({ error: "維基和 OpenStreetMap 現在都沒回應" }); }

  const ids = Array.from(new Set(Object.keys(osm || {}).concat(wiki || [])));
  const ents = await entities(ids);
  /* 沒有繁中名字的,用中文維基那一頁轉台灣用字 */
  const needTw = ids.map(id => ents[id]).filter(e => e && e.labels && !label(e, ["zh-tw", "zh-hant", "zh-hk"]) && e.sitelinks && e.sitelinks.zhwiki).map(e => e.sitelinks.zhwiki.title);
  const tw = needTw.length ? await twTitles(needTw) : {};
  const items = [];
  ids.forEach(id => {
    const e = ents[id]; if (!e || !e.labels) return;
    const o = osm && osm[id];
    const kinds = claim(e, "P31").map(v => v && v.id).filter(Boolean);
    const kind = o ? o.k : (kinds.map(k => KEEP[k]).find(Boolean) || "");
    if (!kind) return;   /* 維基那邊不是景點類的(行政區、公司、活動、大學…)不要 */
    const c = claim(e, "P625")[0];
    const pla = o && isFinite(o.la) ? o.la : c && c.latitude, plo = o && isFinite(o.lo) ? o.lo : c && c.longitude;
    if (!isFinite(pla) || !isFinite(plo)) return;
    const zw = e.sitelinks && e.sitelinks.zhwiki && tw[e.sitelinks.zhwiki.title];
    const n = label(e, ["zh-tw", "zh-hant", "zh-hk"]) || zw || (o && o.osm) || label(e, ["zh", "ja", "en"]);
    if (!n) return;
    /* 「街區」裡會混進行政區(豐島區、某某市):不要 */
    if (kind === "街區" && /[區区市町村縣県都]$/.test(n)) return;
    const a = Array.from(new Set([label(e, ["zh"]), label(e, ["ja"]), label(e, ["en"]), o && o.ja, o && o.osm].filter(x => x && x !== n)));
    const imgs = wdFiles(e);
    items.push({ n, a, la: +(+pla).toFixed(5), lo: +(+plo).toFixed(5), k: kind,
      ph: imgs[0] ? filePage(imgs[0]) : "", ps: imgs.map(filePage), cat: claim(e, "P373")[0] || "", web: (claim(e, "P856").find(u => /^https?:\/\//.test(u)) || ""),
      w: Object.keys(e.sitelinks || {}).length, _id: id });
  });
  items.sort((x, y) => y.w - x.w);
  const top = items.slice(0, 40);
  await placeNames(top, ents);
  await fillFromCategory(top);
  /* 查到東西才存:CDN 一週,過期後兩週內先給舊的、背景再查(stale-while-revalidate) */
  if (top.length) {
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("CDN-Cache-Control", "public, s-maxage=604800, stale-while-revalidate=1209600");
    res.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=604800, stale-while-revalidate=1209600");
  } else res.setHeader("Cache-Control", "no-store");
  return res.status(top.length ? 200 : 503).json({ items: top, from: { osm: !!osm, wiki: !!wiki } });
};
