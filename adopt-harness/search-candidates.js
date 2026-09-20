#!/usr/bin/env node
// 「打關鍵字找地點」這件事,三家各自做得到什麼。
//
// 為什麼要有這一支:Lulu 要的流程是「像在 Google Maps 裡搜尋那樣 —— 打字、看候選、
// 選一個、加進來」。而現在串好的 Google **Geocoding** API 是「地址 → 座標」,
// 跟「關鍵字 → 一串候選」不是同一件事。後端 `notion.js:95` 還只留 `results[0]`。
//
// 所以要先回答兩個問題,而且都是量的不是猜的:
//   1. Geocoding 對「teamLab」「澀谷SKY」這種關鍵字答得出來嗎?
//   2. 免費的 Nominatim 答得出多少?(它本來就回多筆)
// 答案決定要不要多接一個 Places Text Search(另一個端點、另一種計價)。
//
//   TRIP_KEY=xxxx node search-candidates.js                    # 內建那幾個關鍵字
//   TRIP_KEY=xxxx node search-candidates.js "teamLab" "澀谷SKY"  # 自己指定
//
// **Google 那一欄每問一次要錢。** 內建清單是 8 個字串。

const BASE = process.env.BASE || "https://playground-beta-liart.vercel.app";
const KEY = process.env.TRIP_KEY || "";
const QS = process.argv.slice(2).length ? process.argv.slice(2) : [
  "teamLab", "teamLab 豐洲", "澀谷SKY", "一蘭拉麵 新宿",
  "鬼太郎茶屋", "麻布台之丘", "上野動物園", "藏前 咖啡",
];

async function google(q) {
  if (!KEY) return "(沒帶 TRIP_KEY,略過)";
  try {
    const res = await fetch(BASE + "/api/notion?resource=geocode&q=" + encodeURIComponent(q) + "&cc=jp",
      { headers: { "x-trip-key": KEY } });
    const b = await res.json();
    if (!res.ok) return "✗ " + (b.error || res.status);
    if (!b.found) return "查無";
    /* **後端只回一筆**(`notion.js:95` 的 `results[0]`)—— 這一欄印不出「候選清單」,
       不是因為 Google 只給一筆,是因為我們丟掉了其餘的。這件事本身就是答案的一部分。 */
    return "1 筆 · " + (b.label || "").slice(0, 46) + " · " + b.precision;
  } catch (e) { return "✗ " + e.message; }
}

async function osm(q) {
  try {
    const r = await (await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=3" +
      "&accept-language=zh-TW&countrycodes=jp&q=" + encodeURIComponent(q),
      { headers: { "User-Agent": "tokyo-trip-search-probe/1.0" } })).json();
    if (!r.length) return "查無";
    return r.length + " 筆 · " + r.map(x => x.display_name.split(",")[0]).join(" / ");
  } catch (e) { return "✗ " + e.message; }
}

(async () => {
  console.log("問 " + QS.length + " 個關鍵字" + (KEY ? "(含 Google,要錢)" : "(只問免費的)") + "\n");
  const rows = [];
  for (const q of QS) {
    const g = await google(q);
    const o = await osm(q);
    rows.push([q, g, o]);
    console.log("「" + q + "」\n   Google    " + g + "\n   Nominatim " + o);
    await new Promise(r => setTimeout(r, 1200));
  }
  console.log("\n\n| 關鍵字 | Google(Geocoding,只回 1 筆) | Nominatim(免費,回多筆) |");
  console.log("| --- | --- | --- |");
  rows.forEach(r => console.log("| " + r.join(" | ") + " |"));
  console.log("\n判讀:Google 大量「查無」→ 要多接 Places Text Search;");
  console.log("     Google 答得出來 → 後端只要改成回多筆,不必換 API。");
})();
