# 固定的測試資料。天氣和座標都預先灌進快取,跑截圖時不連網查 ——
# 否則每次的天氣數字都不一樣,比對會被那個淹沒,看不出 CSS 有沒有壞。
import json, os
STOPS = [
 {"id":"s1","day":"2026-10-05","time":"09:00","title":"淺草寺參拜","place":"淺草寺","note":"想看繪馬"},
 {"id":"s2","day":"2026-10-05","time":"11:30","title":"合羽橋道具街","place":"","note":""},
 # s3 是從願望排進來的(2026-09-30:by 還留著,所以退得回願望區)
 {"id":"s3","day":"2026-10-05","time":"14:00","title":"築地市場吃海鮮","place":"築地市場","note":"官網 https://www.tsukiji.or.jp/ 有公休日","by":"chang_chiayu","votes":["chang_chiayu","chen_suchih"]},
 {"id":"s4","day":"2026-10-06","time":"10:00","title":"明治神宮","place":"明治神宮","note":""},
]
WISHES = [
 {"id":"w1","title":"teamLab","place":"","by":"chang_chiayu","votes":["chang_chiayu","hsieh_chinhui"],"note":"要先訂票","createdAt":"2026-09-16T01:00:00Z"},
 {"id":"w2","title":"橫濱 港灣未來","place":"港灣未來","by":"hsieh_chinhui","votes":["hsieh_chinhui"],"note":"","createdAt":"2026-09-16T02:00:00Z"},
 {"id":"w3","title":"泡溫泉","place":"","by":"chen_suchih","votes":[],"note":"沒填地點的那種","createdAt":"2026-09-16T03:00:00Z"},
]
EXPENSES = [
 {"id":"e1","date":"2026-10-05","title":"晴空塔門票","category":"sight","amount":2400,"currency":"JPY",
  "payerId":"hsieh_chinhui","participants":["hsieh_chinhui","chang_chiayu","chang_chihwei","chang_yalun","chen_suchih"],"note":"","createdAt":"2026-10-05T10:00:00Z"},
 {"id":"e2","date":"2026-10-05","title":"一蘭拉麵","category":"food","amount":5800,"currency":"JPY",
  "payerId":"chang_chiayu","participants":["chang_chiayu","chang_yalun"],"note":"只有兩個人吃","createdAt":"2026-10-05T12:00:00Z"},
 {"id":"e3","date":"2026-09-15","title":"樂桃來回機票","category":"transport","amount":61100,"currency":"TWD",
  "payerId":"hsieh_chinhui","participants":["hsieh_chinhui","chang_chiayu","chang_chihwei","chang_yalun","chen_suchih"],"note":"訂單 PTETF3","createdAt":"2026-09-15T00:00:00Z"},
]
# 固定天氣:六天都給同一組,免得預報變動害比對失真
DAYS = ["2026-10-0%d" % d for d in range(3,9)]
WX = {"35.68,139.65":{"at":9e14,"days":{d:[40,24.0,18.0] for d in DAYS}},
      "35.23,139.11":{"at":9e14,"days":{d:[55,22.0,15.0] for d in DAYS}}}
# key 必須跟 index.html 的 PINLS 一字不差(現在是 tokyo5-pin3)。對不上不會報錯,
# 只是快取整份失效 —— 地圖改成去 Nominatim 現查,截圖就跟著網路快慢變。
PINS = {"淺草寺":{"la":35.7134,"lo":139.7955},"築地市場":{"la":35.6649,"lo":139.7669},
        "合羽橋道具街":{"la":35.7143,"lo":139.7889},"明治神宮":{"la":35.6748,"lo":139.6996},
        "teamLab":{"la":35.6620,"lo":139.7434},"港灣未來":{"la":35.4437,"lo":139.6380},
        "橫濱 港灣未來":{"la":35.4437,"lo":139.6380},"泡溫泉":None,
        # Lulu 那台裝置的狀態:人工表答得出來的 key,快取裡卻躺著一個線上查來的
        # 錯座標(這是東京車站,離桃園 2000 公里),而且沒有 `via`。
        # 開場那段對帳要把它換掉 —— 沒有這一筆,「舊資料自己修好」就沒有人測。
        # 它不會動到任何一張截圖:桃園在 inJapan() 之外,修好前後都畫不出來。
        "TPE 桃園 T1":{"la":35.6812,"lo":139.7671},
        # 表變了之後的孤兒:`富士` 曾經是 OUTSIDE 的 key,所以這一筆帶著 via、
        # 值是河口湖(離台場 151km)。拆掉 `富士` 之後表再也不認得它 ——
        # 對帳要 delete 它(不是寫 null),下次才會重新去問線上。
        "富士電視台":{"la":35.517,"lo":138.753,"via":"富士電視台"},
        # 地點搜尋那條路的兩筆對照。表的 key 是子字串,`箱根` 兩筆都會命中 ——
        # 差別只在有沒有 `by:"pick"`(人從候選清單裡親手選的)。
        # 開場對帳必須放過前者、接管後者。兩筆都沒有任何 item 指向它們,所以不上地圖。
        "箱根湯本站":{"la":35.2323,"lo":139.1069,"by":"pick"},
        "箱根神社":{"la":35.2050,"lo":139.0260}}
# 把時鐘凍住。出發倒數(「還有 N 天」)顯示在每一頁的標題列,跨過午夜就整批變動 ——
# 那會讓每一次跨日的比對都出現九張「有差異」,而且看起來很像真的改壞了。
FREEZE = "2026-09-19T03:00:00Z"
CLOCK = """<script>(function(){
  var F = new Date("%s").getTime(), D = Date;
  /* 參數要原樣轉交。寫成固定七個參數的話,new Date(ms) 會變成
     new Date(ms, undefined, ...) —— 那是多參數建構式,結果是 Invalid Date,
     整個 app 開機就掛。第一版就是這樣壞的,而且壞得很安靜:
     每一頁都一致地空白,截圖比對還是零差異。 */
  function K(){ return arguments.length ? Reflect.construct(D, arguments) : new D(F); }
  K.now = function(){ return F; }; K.parse = D.parse; K.UTC = D.UTC; K.prototype = D.prototype;
  window.Date = K;
})();</script>
""" % FREEZE

# ---------------------------------------------------------------------------
# 第 2 期:**沒有「沒有後端」這種模式了。** 以前每一張截圖都是「本機模式」拍的
# (fixture 灌 localStorage 的 tokyo5-v1,程式連不上後端就讀它)。第 2 期起沒登入什麼都
# 看不到,本機模式整個拿掉 —— 所以這裡改成在頁面自己身上裝一個**假的後端**,
# 預設扮演「已經登入的團主,打開東京五人行」,畫面上的資料跟以前那份一模一樣。
#
# 網址上的 `fake=` 換成別的角色(PAGE= 帶進去):
#   (沒帶)     團主,資料齊全 —— 所有截圖都在這個世界
#   anon        沒登入              → 登入卡
#   new         登入了、一團都沒有  → 開團卡
#   member      一般成員、團主一個開關都沒開 → 唯讀
#   join        登入了、不是這一團的人 → 加入卡(帶 i= 的話先看一眼)
#   visitor     沒登入、直接打開首頁(沒帶團代號)→ 介紹頁
# SNAP=1:後端整個連不上,這台裝置上有這一團的副本 → 離線唯讀。
TRIP_CODE = "fixture1"
ME_ID = "hsieh_chinhui"   # 以前 fixture 設的「我是誰」(tokyo5-me)也是他
CAT_ZH = {"transport": "交通", "stay": "住宿", "food": "餐飲", "sight": "景點", "shop": "購物", "other": "其他"}
FAKE_TRIP = {"code": TRIP_CODE, "name": "東京五人行", "country": "日本", "city": "東京", "currency": "JPY",
             "start": "2026-10-03", "end": "2026-10-08", "rate": 0.21, "kitty": 30000,
             "can": {"plan": False, "cost": False, "seat": False}}
FAKE_MEMBERS = [
  {"id": "hsieh_chinhui", "name": "阿輝", "color": "#E60012", "role": "團主"},
  {"id": "chang_chiayu",  "name": "佳瑜", "color": "#F39700", "role": "成員"},
  {"id": "chang_chihwei", "name": "志偉", "color": "#009944", "role": "成員"},
  {"id": "chang_yalun",   "name": "雅倫", "color": "#00A7DB", "role": "成員"},
  {"id": "chen_suchih",   "name": "媽",   "color": "#9B7CB6", "role": "成員"},
]
# 加入時間(2026-09-29 起有「新成員加入」的通知):五個人都在團主上次看過通知之前就加入了
for _i, _m in enumerate(FAKE_MEMBERS):
    _m["joinedAt"] = "2026-09-0%dT08:00:00.000Z" % (_i + 1)
OWNER_SEEN = "2026-09-10T00:00:00.000Z"
FAKE_FLIGHTS = [
  {"id": "f1", "no": "MM626", "dir": "去程", "airline": "樂桃航空", "depart": "2026-10-03T10:50", "from": "TPE 桃園 T1",
   "arrive": "2026-10-03T15:20", "to": "NRT 成田 T1", "note": "託運 1 件／人 · 手提 2 件 7kg"},
  {"id": "f2", "no": "MM631", "dir": "回程", "airline": "樂桃航空", "depart": "2026-10-08T21:50", "from": "NRT 成田 T1",
   "arrive": "2026-10-09T00:40", "to": "TPE 桃園 T1", "note": ""},
  # 交通不是只有飛機(2026-09-28):一段火車(有座位,車次是人話)、一段租車(沒有座位,有駕駛)
  {"id": "f3", "kind": "火車", "no": "成田特快 N'EX 41", "dir": "其他", "airline": "JR 東日本", "depart": "2026-10-03T16:19",
   "from": "成田機場", "arrive": "2026-10-03T17:20", "to": "東京", "note": "", "code": ""},
  {"id": "f4", "kind": "租車", "no": "", "dir": "其他", "airline": "TOYOTA 租車", "depart": "2026-10-06T09:00",
   "from": "河口湖站前店", "arrive": "2026-10-07T18:00", "to": "河口湖站前店", "note": "", "code": "TY-88231",
   "drivers": ["hsieh_chinhui", "chang_chihwei"]},
]
_OUT = {"chang_chiayu": "27A", "hsieh_chinhui": "27B", "chang_yalun": "27D", "chen_suchih": "27E", "chang_chihwei": "27F"}
_BACK = {"chang_chiayu": "27A", "hsieh_chinhui": "27B", "chang_chihwei": "27D", "chang_yalun": "27E", "chen_suchih": "27F"}
FAKE_SEATS = ([{"id": "so" + k, "flight": "MM626", "date": "2026-10-03", "passenger": k, "seat": v} for k, v in _OUT.items()] +
              [{"id": "sb" + k, "flight": "MM631", "date": "2026-10-08", "passenger": k, "seat": v} for k, v in _BACK.items()] +
              [{"id": "st" + k, "flight": "成田特快N'EX41", "date": "2026-10-03", "passenger": k, "seat": v}
               for k, v in {"chang_chiayu": "9車 3A", "hsieh_chinhui": "9車 3B"}.items()])
def _exp_row(e):
    return {"id": e["id"], "date": e["date"], "title": e["title"], "category": CAT_ZH[e["category"]],
            "amount": e["amount"], "currency": e["currency"], "payer": e["payerId"],
            "participants": e["participants"], "note": e["note"], "createdAt": e["createdAt"]}
FAKE_ROWS = {
  "expenses": [_exp_row(e) for e in EXPENSES],
  "itinerary": STOPS,
  "wishes": WISHES,
  "seats": FAKE_SEATS,
  "flights": FAKE_FLIGHTS,
}

# 副本(SNAP=1)。故意多一筆後端沒有的行程:兩份長得一樣的話,探針分不出
# 「畫面上是副本」還是「副本根本沒被讀到」—— 後者正是要防的 bug。
SNAP_ONLY = {"id":"snap1","day":"2026-10-05","time":"16:30",
             "title":"只有離線副本裡才有的行程","place":"","note":""}
SNAP_AT = "2026-09-19T01:30:00Z"   # 凍住的時鐘往前 1.5 小時

def snap():
    d = {"version": 4, "rate": 0.21, "names": {}, "expenses": EXPENSES, "stops": STOPS + [SNAP_ONLY],
         "wishes": WISHES, "seats": FAKE_SEATS, "flights": FAKE_FLIGHTS, "trip": FAKE_TRIP,
         "members": [{"id": m["id"], "def": m["name"], "key": m["id"], "full": m["name"], "color": m["color"], "role": m["role"]}
                     for m in FAKE_MEMBERS],
         "me": {"id": ME_ID, "name": "阿輝", "color": "#E60012", "role": "團主", "invite": "q4wn8t"}}
    # SNAPCAN=1:新版存的副本多帶「那一刻能不能記帳」(離線記帳看它)。
    # 預設不帶 = 舊版存下來的副本 —— 更新之後、還沒連上網重存之前,手機上躺的就是這種,那時候還是唯讀
    if os.environ.get("SNAPCAN"):
        d["can"] = {"plan": True, "cost": True, "seat": True}
    return {"at": SNAP_AT, "data": d}

FAKE_JS = r"""(function(){
  /* 頁面上沒被接住的錯誤都記下來。**程式在開機時當掉,畫面不會說** —— 一整塊空白
     看起來跟「還沒載入」一樣。探針回傳 window.__errors 就問得出來。 */
  window.__errors = [];
  window.addEventListener("error", function(e){ window.__errors.push(String(e.message || e)); });
  window.addEventListener("unhandledrejection", function(e){ window.__errors.push("promise: " + String(e.reason && e.reason.message || e.reason)); });
  var q = location.search, mode = (/[?&]fake=([a-z]+)/.exec(q) || [])[1] || "owner";
  /* app:從主畫面打開的 App、還沒登入。iOS 用 navigator.standalone 講這件事 */
  if (mode === "app") { try { Object.defineProperty(navigator, "standalone", { value: true, configurable: true }); } catch (e) {} }
  /* touch=1:扮成手機/平板(觸控螢幕)。要在程式開機之前換掉 —— 「有沒有拍照鈕」是開機時決定的 */
  if (/[?&]touch=1/.test(q)) { var mm0 = window.matchMedia.bind(window);
    window.matchMedia = function (x) { return /pointer:\s*coarse/.test(x) ? { matches: true, media: x, addEventListener: function(){}, removeEventListener: function(){}, addListener: function(){}, removeListener: function(){} } : mm0(x); }; }
  var CODE = %(code)s, TRIP = %(trip)s, MEMBERS = %(members)s, ROWS = %(rows)s, ME_ID = %(me)s;
  var OFFLINE = %(offline)s;
  /* 沒帶團代號就補上 —— 截圖和大部分探針要的是「打開這一團」那個畫面。
     new(一團都沒有)要的是首頁,不補。 */
  /* visitor:沒登入、直接打開首頁(沒帶團代號)的人 —— 介紹頁就是給他看的 */
  if (mode !== "new" && mode !== "visitor" && !/[?&]t=/.test(q)) {
    history.replaceState(null, "", location.pathname + (q ? q + "&" : "?") + "t=" + CODE);
  }
  var real = window.fetch.bind(window), seq = 0;
  window.__rows = ROWS;   /* 探針要問「存下去了沒」就讀這裡(以前讀 localStorage 的 tokyo5-v1) */
  /* 呼叫紀錄跨頁面留著 —— 開團/加入成功會跳頁,跳過去之後還要看得到剛剛送了什麼 */
  window.__calls = []; try { window.__calls = JSON.parse(sessionStorage.getItem("fake-calls") || "[]"); } catch (e) {}
  if (mode === "member") { MEMBERS.forEach(function(m){ m.role = m.id === ME_ID ? "成員" : m.role; });
                           MEMBERS[1].role = "團主"; }
  /* member 配 can=plan,cost…:團主只開了其中幾個開關(第 2 期以前三個全開才算數,現在一塊一塊看) */
  /* newbie=1:團主上次看過通知之後,又有一個人(小美)加入了。noflights=1:這一團還沒有交通 */
  if (/[?&]newbie=1/.test(q)) MEMBERS.push({ id: "new_friend", name: "小美", color: "#E4007F", role: "成員", joinedAt: "2026-09-18T09:00:00.000Z" });
  if (/[?&]noflights=1/.test(q)) { ROWS.flights = []; ROWS.seats = []; }
  var SEEN = { at: %(seen)s };
  var canQ = (/[?&]can=([a-z,]*)/.exec(q) || [])[1];
  if (canQ !== undefined) canQ.split(",").forEach(function(k){ if (k in TRIP.can) TRIP.can[k] = true; });
  /* 2026-10-01 起 can 是**副團主**的權限,一般成員只能許願 —— 帶 can= 的成員就是副團主(deputy=0 可以關掉) */
  if (mode === "member" && canQ !== undefined && !/[?&]deputy=0/.test(q)) MEMBERS.forEach(function(m){ if (m.id === ME_ID) m.role = "副團主"; });
  /* ai=剩幾次/共幾次(例如 ai=3/20):AI 的每人次數。沒帶 = 讀不到(那一行不出現) */
  /* ended=1:這一團已經結束(最後一天過了);started=1:旅程進行中(第一天到了)。伺服器照當地時間算好給的 */
  if (/[?&]ended=1/.test(q)) { TRIP.started = true; TRIP.ended = true; }
  else if (/[?&]started=1/.test(q)) { TRIP.started = true; TRIP.ended = false; }
  var stQ = /[?&]strong=(\d+)\/(\d+)/.exec(q), STQ = stQ ? { left: +stQ[1], limit: +stQ[2], used: +stQ[2] - +stQ[1], resetAt: "2026-09-19T07:00:00.000Z", when: "下午三點" } : null;
  var aiQ = /[?&]ai=(\d+)\/(\d+)/.exec(q), AIQ = aiQ ? { left: +aiQ[1], limit: +aiQ[2], used: +aiQ[2] - +aiQ[1], resetAt: "2026-09-19T07:00:00.000Z", when: "下午三點" } : null;
  var me = (mode === "anon" || mode === "app" || mode === "visitor") ? null : { id: "U-fake-0001", name: "測試的人", avatar: "" };
  var joined = mode !== "join" && mode !== "new";
  function reply(body, status){ status = status || 200; return Promise.resolve({ ok: status < 400, status: status,
    json: function(){ return Promise.resolve(JSON.parse(JSON.stringify(body))); } }); }
  function param(s, k){ var m = new RegExp("[?&]" + k + "=([^&]*)").exec(s); return m ? decodeURIComponent(m[1]) : ""; }
  window.fetch = function(u, init){
    var s = String(u), method = (init && init.method) || "GET", body = {};
    try { body = JSON.parse((init && init.body) || "{}"); } catch (e) {}
    if (s.indexOf("/api/") < 0) return real(u, init);
    window.__calls.push({ url: s, method: method, body: body });
    try { sessionStorage.setItem("fake-calls", JSON.stringify(window.__calls)); } catch (e) {}
    if (OFFLINE) return Promise.reject(new TypeError("Failed to fetch"));
    if (s.indexOf("/api/auth?go=me") >= 0) return reply({ user: me, ready: true });
    /* App 先問 LINE 的網址再自己走過去。回一個站內的空錨點,探針不必真的離開這一頁 */
    if (s.indexOf("/api/auth?go=login") >= 0 && s.indexOf("json=1") >= 0) return reply({ url: "#line-login" });
    if (s.indexOf("/api/auth?go=code") >= 0) {
      var c = String(body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      return c === "ABCD2345" ? reply({ ok: true, user: { id: "U-fake-0001", name: "測試的人" } })
        : reply({ error: "這組登入碼不對,或已經過期(10 分鐘)—— 回瀏覽器重新登入一次" }, 403);
    }
    /* strong=剩幾次/共幾次:強力搜的每人次數(2026-10-02)。POST ?strong=1 用掉一次,沒了回 429 */
    if (s.indexOf("/api/ai") >= 0 && s.indexOf("strong=1") >= 0 && method === "POST") {
      if (!STQ) return reply({ ok: true, strong: null });
      /* 退回:收據是「t+第幾次」,只有最後那一次退得了 */
      if (s.indexOf("refund=1") >= 0) {
        if (body.ticket !== "t" + STQ.used) return reply({ ok: false, strong: null }, 409);
        STQ.left++; STQ.used--; return reply({ ok: true, strong: STQ });
      }
      if (STQ.left <= 0) return reply({ why: "strong", strong: STQ, error: "你今天的強力搜用完了,下午三點後再用" }, 429);
      STQ.left--; STQ.used++; return reply({ ok: true, strong: STQ, ticket: "t" + STQ.used });
    }
    if (s.indexOf("/api/ai") >= 0 && method === "GET") return reply({ mine: AIQ, strong: STQ });
    if (s.indexOf("/api/notion") < 0) return real(u, init);
    var r = param(s, "resource");
    if (!me) return reply({ error: "請先用 LINE 登入", why: "login" }, 401);
    var mine = MEMBERS.filter(function(m){ return m.id === ME_ID; })[0];
    /* admin=1:最高權限(2026-10-02)。hidden=1:這一團被隱藏了(不是最高權限就進不去) */
    var ADMIN = /[?&]admin=1/.test(q), HID = /[?&]hidden=1/.test(q);
    window.__adminTrips = window.__adminTrips || [
      { code: CODE, name: TRIP.name, country: TRIP.country, city: TRIP.city, start: TRIP.start, end: TRIP.end, ended: false, hidden: false, owner: "佳瑜", people: MEMBERS.length },
      { code: "other123", name: "別人的團", country: "台灣", city: "高雄", start: "2026-11-01", end: "2026-11-03", ended: false, hidden: true, owner: "阿輝", people: 2 }];
    if (r === "admin") {
      if (!ADMIN) return reply({ error: "只有最高權限能用" }, 403);
      if (method === "GET") return reply({ trips: window.__adminTrips });
      var at = window.__adminTrips.filter(function(t){ return t.code === body.code; })[0];
      if (!at) return reply({ error: "沒有這一團,或它已經被刪掉了" }, 404);
      if (body.action === "delete") {
        if (body.confirm !== at.name) return reply({ error: "團名打得不一樣,沒有刪" }, 400);
        window.__adminTrips = window.__adminTrips.filter(function(t){ return t !== at; }); return reply({ ok: true, deleted: 9 });
      }
      at.hidden = body.action === "hide"; return reply({ ok: true, hidden: at.hidden });
    }
    if (r === "trips") {
      if (method === "POST") return reply({ code: "newtrip1", me: { id: "mnew01", name: body.myName, color: "#E60012", role: "團主" } });
      return reply({ trips: joined ? [{ code: CODE, name: TRIP.name, country: TRIP.country, city: TRIP.city,
        start: TRIP.start, end: TRIP.end, role: mine.role, hidden: HID && !ADMIN }] : [], admin: ADMIN });
    }
    if (r === "join") {
      if (method === "GET") return param(s, "code") === "q4wn8t"
        ? reply({ joined: false, trip: { code: CODE, name: TRIP.name }, host: "佳瑜" })
        : reply({ error: "邀請碼不對,或已經換掉了 —— 跟邀請你的人再要一次", why: "bad_invite" }, 403);
      if (body.invite !== "q4wn8t") return reply({ error: "邀請碼不對,或已經換掉了 —— 跟邀請你的人再要一次", why: "bad_invite" }, 403);
      joined = true;
      return reply({ joined: true, me: { id: ME_ID, name: body.name, color: "#E60012", role: "成員" }, trip: { code: CODE, name: TRIP.name } });
    }
    if (HID && !ADMIN) return reply({ error: "這一團暫時關閉了", why: "hidden" }, 403);
    if (!joined) return reply({ error: "你還不是這一團的人 —— 要有邀請碼才能加入", why: "not_member" }, 403);
    if (r === "team") {
      if (method === "PATCH") {
        if (body.deputy !== undefined) {
          if (TRIP.deputyLocked) return reply({ why: "deputy_today", error: "今天已經換過副團主了,台灣時間 15:00 之後才能再換" }, 409);
          var had = MEMBERS.filter(function(m){ return m.role === "副團主"; })[0];
          MEMBERS.forEach(function(m){ if (m.role === "副團主") m.role = "成員"; if (m.id === body.deputy) m.role = "副團主"; });
          if (had) TRIP.deputyLocked = true;
        }
        Object.keys(body).forEach(function(k){ if (k !== "can" && k !== "deputy") TRIP[k] = body[k]; });
        if (body.can) Object.keys(body.can).forEach(function(k){ TRIP.can[k] = body.can[k]; });
        return reply({ trip: TRIP }); }
      /* 測試環境的「用成員身分看」:跟伺服器同一條規則(只有團主能降級;prod=1 模擬正式站,整個不理) */
      var dev = !/[?&]prod=1/.test(q);
      var asM = dev && mine.role === "團主" && /(?:^|;\s*)trip_as=member/.test(document.cookie);
      return reply({ trip: TRIP, members: MEMBERS, dev: dev, admin: ADMIN, viewAs: asM ? "member" : "",
        me: { id: mine.id, name: mine.name, color: mine.color, role: asM ? "成員" : mine.role, realRole: mine.role, invite: "q4wn8t",
              joinedAt: mine.joinedAt, seenAt: mine.role === "團主" ? SEEN.at : "" } });
    }
    if (r === "me") {
      if (body.name) mine.name = body.name;
      if (body.color) mine.color = body.color;
      if (body.seen === true) SEEN.at = new Date().toISOString();
      return reply({ me: { id: mine.id, name: mine.name, color: mine.color, role: mine.role, invite: body.invite ? "z9z9z9" : "q4wn8t", seenAt: SEEN.at } });
    }
    var rows = ROWS[r];
    if (!rows) return reply({ error: "不認識的資料表:" + r }, 400);
    var id = param(s, "id");
    if (method === "GET") return reply({ rows: rows });
    if (method === "POST") { var row = Object.assign({ id: "new" + (++seq) }, body); rows.push(row); return reply({ row: row }); }
    var hit = rows.filter(function(x){ return x.id === id; })[0];
    if (!hit) return reply({ error: "這一團沒有這一筆" }, 404);
    if (method === "PATCH") {
      Object.assign(hit, body);
      /* 行程清掉日期 = 退回願望區。真的後端是同一張表,這裡是兩個陣列,所以要搬過去 */
      if (r === "itinerary" && body.day === null) { rows.splice(rows.indexOf(hit), 1); hit.votes = hit.votes || []; ROWS.wishes.push(hit); }
      return reply({ row: hit });
    }
    if (method === "DELETE") { rows.splice(rows.indexOf(hit), 1); return reply({ ok: true }); }
    return reply({ error: "不支援的方法" }, 405);
  };
})();"""

def seed():
    j = lambda o: json.dumps(json.dumps(o, ensure_ascii=False))
    offline = bool(os.environ.get("SNAP"))
    extra = ("localStorage.setItem('trippps-snap:" + TRIP_CODE + "'," + j(snap()) + ");" if offline else "")
    d = lambda o: json.dumps(o, ensure_ascii=False)
    fake = FAKE_JS % {"code": d(TRIP_CODE), "trip": d(FAKE_TRIP), "members": d(FAKE_MEMBERS),
                      "rows": d(FAKE_ROWS), "me": d(ME_ID), "offline": "true" if offline else "false", "seen": d(OWNER_SEEN)}
    return CLOCK + ("<script>try{"
      "localStorage.setItem('trippps-wx',"+j(WX)+");"
      "localStorage.setItem('tokyo5-pin3',"+j(PINS)+");"
      + extra +
      "}catch(e){}</script>\n<script>" + fake + "</script>\n")
