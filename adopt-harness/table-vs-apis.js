#!/usr/bin/env node
// 人工表 OUTSIDE 的每一條,拿去問 Google，逐筆比對距離。
//
// 為什麼要有這一支:「人工表可以不用了吧,都可以用 google map 了」這個問題,
// 在這個 repo 裡目前**一筆量測都沒有**。表存在的理由寫在 `275da9b`,
// 而那些證據(京都車站 → 東京車站大飯店、金閣寺 → 埼玉日立金屬熊谷工場)
// 全部是 **Nominatim** 那家,不是 Google。所以「Google 比較準」是合理猜測,
// 不是已知事實 —— 這支就是去把它變成已知。
//
//   TRIP_KEY=xxxx node outside-vs-google.js            # 只問,不改任何東西
//   TRIP_KEY=xxxx BASE=http://localhost:3000 node ...  # 指到別的部署
//
// **通行碼走環境變數,不要當參數打在命令列上** —— 參數會進 shell 的歷史紀錄。
// **每查一次都要錢,付的是 Lulu 的信用卡。** 這支會問 21 次,
// 以 Google Geocoding 的牌價算大約 US$0.11。跑之前想清楚,不要順手重跑。

const BASE = process.env.BASE || "https://playground-beta-liart.vercel.app";
/* 沒帶 TRIP_KEY 也跑得起來 —— 那時只問免費的兩家,一毛錢都不花。
   **這是刻意的**:要回答「人工表能不能被開放 API 取代」,
   免費那兩家才是該比的對象,而它們不需要任何人先去設金鑰。 */
const KEY = process.env.TRIP_KEY || "";

// index.html:1515 的那張表,一字不差搬過來
const OUTSIDE = [
  { keys: ["箱根"], lat: 35.232, lon: 139.107 },
  { keys: ["日光"], lat: 36.720, lon: 139.698 },
  { keys: ["鎌倉", "鐮倉"], lat: 35.319, lon: 139.547 },
  { keys: ["江之島", "江ノ島", "江島"], lat: 35.300, lon: 139.481 },
  { keys: ["橫濱", "横浜", "橫浜"], lat: 35.444, lon: 139.638 },
  { keys: ["川越"], lat: 35.925, lon: 139.486 },
  { keys: ["輕井澤", "軽井沢"], lat: 36.342, lon: 138.629 },
  { keys: ["河口湖", "富士"], lat: 35.517, lon: 138.753 },
  { keys: ["熱海"], lat: 35.096, lon: 139.072 },
  { keys: ["草津"], lat: 36.620, lon: 138.597 },
  { keys: ["迪士尼", "舞濱", "舞浜"], lat: 35.633, lon: 139.880 },
  { keys: ["成田", "NRT"], lat: 35.772, lon: 140.393 },
  { keys: ["桃園", "TPE"], lat: 25.080, lon: 121.234 },
];

// 問什麼:每一條的**第一個**關鍵字(那是中文主要寫法),
// 加上幾個「真實資料裡實際出現的字串」和兩個已登記的危害。
const EXTRA = [
  { q: "TPE 桃園 T1", 期望: [25.080, 121.234], 註: "真實資料的地點欄" },
  { q: "NRT 成田 T1", 期望: [35.772, 140.393], 註: "真實資料的地點欄" },
  { q: "富士電視台", 期望: [35.627, 139.775], 註: "**已登記的危害**:表會給河口湖,差 100km" },
  { q: "箱根湯本站", 期望: [35.232, 139.107], 註: "表只給箱根的概略中心,Google 應該更準" },
  { q: "樂桃 MM626 · 建議起飛前 2.5 小時", 期望: null, 註: "航班備註,不是地名 —— 該回查無" },
];

// index.html:1842 的 REGIONS。桃園／TPE 不在裡面,所以 app 實際上是用 jp 去問的。
const REGIONS = [
  { key: ["東京"], cc: "jp" },
  { key: ["大阪", "京都", "關西", "関西"], cc: "jp" },
  { key: ["北海道", "札幌"], cc: "jp" },
  { key: ["沖繩", "沖縄"], cc: "jp" },
  { key: ["首爾", "서울", "韓國"], cc: "kr" },
  { key: ["曼谷", "泰國"], cc: "th" },
];
const regionFor = s => (REGIONS.find(r => r.key.some(k => s.indexOf(k) >= 0)) || REGIONS[0]).cc;

const km = (a, b) => {
  const R = 6371, r = Math.PI / 180;
  const dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
  const h = Math.sin(dLa / 2) ** 2 +
    Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

async function askGoogle(q, cc) {
  if (!KEY) return { 略過: true };
  const url = BASE + "/api/notion?resource=geocode&q=" + encodeURIComponent(q) + "&cc=" + cc;
  const res = await fetch(url, { headers: { "x-trip-key": KEY } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { 錯: (body && body.error) || ("HTTP " + res.status) };
  return body;
}

/* open-meteo 的地名查詢。**天氣那條路現在用的就是它**(index.html:1604),
   免費、不用金鑰。`plausible()` 那層過濾是 app 自己加的,這裡不套 ——
   要量的是「這家回什麼」,不是「app 過濾完剩什麼」。 */
async function askOpenMeteo(q, cc) {
  const qq = q.split(/[·・→(（,、]/)[0].trim().slice(0, 20);   /* app 就是這樣切的 */
  const url = "https://geocoding-api.open-meteo.com/v1/search?count=5&language=ja&countryCode=" +
    cc.toUpperCase() + "&name=" + encodeURIComponent(qq);
  try {
    const r = await (await fetch(url)).json();
    const first = (r.results || [])[0];
    return first ? { found: true, la: first.latitude, lo: first.longitude,
                     label: [first.name, first.admin1].filter(Boolean).join(", ") } : { found: false };
  } catch (e) { return { 錯: String(e.message || e) }; }
}

/* Nominatim。**地圖那條路現在用的就是它**(index.html:1901)。
   一秒一次是它的使用條款,而且要帶 User-Agent —— 不帶會被擋。 */
async function askNominatim(q, cc) {
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=zh-TW" +
    "&countrycodes=" + cc + "&q=" + encodeURIComponent(q);
  try {
    const r = await (await fetch(url, { headers: { "User-Agent": "tokyo-trip-table-audit/1.0" } })).json();
    const f = (r || [])[0];
    return f ? { found: true, la: +f.lat, lo: +f.lon, label: (f.display_name || "").slice(0, 44) }
             : { found: false };
  } catch (e) { return { 錯: String(e.message || e) }; }
}

function 判(r, 期望) {
  if (r.略過) return { 判: "—", 距離: "" };
  if (r.錯) return { 判: "錯誤", 距離: r.錯.slice(0, 30) };
  if (!r.found) return { 判: 期望 === null ? "查無 ✅" : "查無 ❌", 距離: "" };
  if (期望 === null) return { 判: "硬給 ❌", 距離: (r.label || "").slice(0, 24) };
  const dkm = km(期望, [r.la, r.lo]);
  return { 判: dkm < 2 ? "✅" : dkm < 15 ? "⚠" : "❌", 距離: dkm.toFixed(2) };
}

(async () => {
  const jobs = OUTSIDE.map(o => ({ q: o.keys[0], 期望: [o.lat, o.lon], 註: "" })).concat(EXTRA);
  jobs.push({ q: "桃園", 期望: [25.080, 121.234], cc: "tw", 註: "改用 cc=tw" });
  jobs.push({ q: "TPE 桃園 T1", 期望: [25.080, 121.234], cc: "tw", 註: "改用 cc=tw" });

  console.log("問 " + jobs.length + " 組" + (KEY ? "(含 Google,要錢)" : "(只問免費的兩家)") + "\n");
  const rows = [];
  for (const j of jobs) {
    const cc = j.cc || regionFor(j.q);
    const om = await askOpenMeteo(j.q, cc);
    const nm = await askNominatim(j.q, cc);
    const gg = await askGoogle(j.q, cc);
    const a = 判(om, j.期望), b = 判(nm, j.期望), c = 判(gg, j.期望);
    rows.push({ 查: j.q, cc, om: a, nm: b, gg: c, 註: j.註,
                omL: (om.label || "").slice(0, 26), nmL: (nm.label || "").slice(0, 26) });
    console.log([j.q.slice(0, 22), cc,
      "open-meteo " + a.判 + (a.距離 ? " " + a.距離 : ""),
      "nominatim " + b.判 + (b.距離 ? " " + b.距離 : ""),
      KEY ? "google " + c.判 + (c.距離 ? " " + c.距離 : "") : ""].filter(Boolean).join("  ·  "));
    await new Promise(r2 => setTimeout(r2, 1100));   /* Nominatim 一秒一次 */
  }

  const 欄 = KEY ? " Google |" : "";
  console.log("\n\n| 查的字 | cc | open-meteo | Nominatim |" + 欄 + " 註 |");
  console.log("| --- | --- | --- | --- |" + (KEY ? " --- |" : "") + " --- |");
  rows.forEach(r => console.log("| " + [r.查, r.cc,
    r.om.判 + (r.om.距離 ? " " + r.om.距離 + "km" : ""),
    r.nm.判 + (r.nm.距離 ? " " + r.nm.距離 + "km" : "")]
    .concat(KEY ? [r.gg.判 + (r.gg.距離 ? " " + r.gg.距離 + "km" : "")] : [])
    .concat([r.註]).join(" | ") + " |"));

  const 數 = k => ["✅", "⚠", "❌"].map(m =>
    m + " " + rows.filter(r => r[k].判.indexOf(m) >= 0).length).join(" · ");
  console.log("\nopen-meteo: " + 數("om"));
  console.log("Nominatim : " + 數("nm"));
  if (KEY) console.log("Google    : " + 數("gg"));
  console.log("\n判準:✅ 2km 內 · ⚠ 2–15km · ❌ 超過 15km,或查無/該查無卻硬給答案");
})();
