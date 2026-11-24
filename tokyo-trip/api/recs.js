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
    const img = claim(e, "P18")[0];
    items.push({ n, a, la: +(+pla).toFixed(5), lo: +(+plo).toFixed(5), k: kind,
      ph: img ? "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(String(img).replace(/ /g, "_")) : "",
      w: Object.keys(e.sitelinks || {}).length });
  });
  items.sort((x, y) => y.w - x.w);
  const top = items.slice(0, 40);
  /* 查到東西才存:CDN 一週,過期後兩週內先給舊的、背景再查(stale-while-revalidate) */
  if (top.length) {
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("CDN-Cache-Control", "public, s-maxage=604800, stale-while-revalidate=1209600");
    res.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=604800, stale-while-revalidate=1209600");
  } else res.setHeader("Cache-Control", "no-store");
  return res.status(top.length ? 200 : 503).json({ items: top, from: { osm: !!osm, wiki: !!wiki } });
};
