/* 東京五人行 · service worker
 *
 * 它只負責一件事:**沒網路的時候,網頁本身還打得開**。
 * 行程、花費、分帳那些「資料」不歸它管 —— 那是 index.html 把每次讀到的內容
 * 存一份在 localStorage(`tokyo5-snap`),兩條路各走各的。
 *
 * 分開的理由是失敗模式不一樣:網頁檔案是固定的幾個,快取起來永遠正確;
 * Notion 的資料會變,快取起來就有「這是什麼時候的」這個問題,必須講給人聽。
 * 混在一起的話,畫面上沒有任何地方說得出那份資料多舊。
 */

/* 改了 SHELL 的內容就把版號 +1。舊版的快取會在 activate 時整個丟掉。
   版號不動也不會壞(下面是 network-first,線上永遠拿得到新的),
   +1 只是讓離線的人也早一點換掉手上那份。 */
const CACHE = "tokyo5-shell-v1";

/* 要離線打得開就得備齊的檔。**這份清單會無聲地爛掉** ——
   檔名改了、新增了一個要載入的檔,這裡沒跟著改,線上完全正常,
   只有真的斷線的人會看到半個網站,而那個人在東京的地鐵裡。
   所以 adopt-harness/probes/pwa.js 會把這份清單抓出來,逐個 fetch 對答案。 */
const SHELL = [
  "./",
  "./index.html",
  "./retro-modern.built.css",
  "./config.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", e => {
  /* skipWaiting:新版不要排隊等所有分頁關掉。手機上的分頁可以幾個月不關,
     沒有這行,改好的東西要等到下次重開機才生效。 */
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      /* claim:立刻接管已經開著的分頁,不用等下一次導覽 */
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  /* 跨網域的東西一律不碰:Google Fonts、OSM 的地圖圖磚、Nominatim、Open-Meteo。
     它們回的是 opaque response —— **狀態碼讀不到**,一個失敗的請求和一個成功的
     長得一模一樣。存進快取等於把「載不到」凍起來反覆播放,而且永遠看不出是壞的。
     (地圖離線是下一輪的事,要做就得另外處理 opaque 這件事,不是把這行刪掉。) */
  if (url.origin !== self.location.origin) return;

  /* `/api/` 絕對不進快取。快取一份 Notion 的回應,下次離線時它會以 200 回來 ——
     畫面上看起來就是「連上了、資料是新的」,而實際上是三天前的。
     讓它照常失敗,index.html 自己的離線那條路才會啟動,而那條路會說清楚
     資料是什麼時候抓的。 */
  if (url.pathname.indexOf("/api/") > -1) return;

  /* network-first,不是 cache-first。
     這個專案的節奏是改完就 push、馬上要在手機上看到。cache-first 的話,
     五個人的手機會停在舊版,而且**沒有任何跡象** —— 畫面是完整的、資料是新的,
     只有版面和修好的 bug 是舊的。那是這個 repo 記過太多次的形狀。
     代價是線上時不會變快。可以接受:要的是離線打得開,不是快。 */
  e.respondWith(
    fetch(req)
      .then(res => {
        /* 只存正常的、完整的回應。206(部分內容)存起來會在下次被當成完整檔案送出。 */
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => {
          if (hit) return hit;
          /* 導覽請求(打開網站、重新整理)要有退路。網址帶了查詢字串或 hash 時
             上面那個 match 會落空,但要給的其實都是同一份 index.html。 */
          if (req.mode === "navigate") return caches.match("./index.html");
          return Response.error();
        })
      )
  );
});
