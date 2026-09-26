# 固定的測試資料。天氣和座標都預先灌進快取,跑截圖時不連網查 ——
# 否則每次的天氣數字都不一樣,比對會被那個淹沒,看不出 CSS 有沒有壞。
import json, os
STOPS = [
 {"id":"s1","day":"2026-10-05","time":"09:00","title":"淺草寺參拜","place":"淺草寺","note":"想看繪馬"},
 {"id":"s2","day":"2026-10-05","time":"11:30","title":"合羽橋道具街","place":"","note":""},
 {"id":"s3","day":"2026-10-05","time":"14:00","title":"築地市場吃海鮮","place":"築地市場","note":"官網 https://www.tsukiji.or.jp/ 有公休日"},
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
FAKE_FLIGHTS = [
  {"id": "f1", "no": "MM626", "dir": "去程", "airline": "樂桃航空", "depart": "2026-10-03T10:50", "from": "TPE 桃園 T1",
   "arrive": "2026-10-03T15:20", "to": "NRT 成田 T1", "note": "託運 1 件／人 · 手提 2 件 7kg"},
  {"id": "f2", "no": "MM631", "dir": "回程", "airline": "樂桃航空", "depart": "2026-10-08T21:50", "from": "NRT 成田 T1",
   "arrive": "2026-10-09T00:40", "to": "TPE 桃園 T1", "note": ""},
]
_OUT = {"chang_chiayu": "27A", "hsieh_chinhui": "27B", "chang_yalun": "27D", "chen_suchih": "27E", "chang_chihwei": "27F"}
_BACK = {"chang_chiayu": "27A", "hsieh_chinhui": "27B", "chang_chihwei": "27D", "chang_yalun": "27E", "chen_suchih": "27F"}
FAKE_SEATS = ([{"id": "so" + k, "flight": "MM626", "date": "2026-10-03", "passenger": k, "seat": v} for k, v in _OUT.items()] +
              [{"id": "sb" + k, "flight": "MM631", "date": "2026-10-08", "passenger": k, "seat": v} for k, v in _BACK.items()])
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
  var CODE = %(code)s, TRIP = %(trip)s, MEMBERS = %(members)s, ROWS = %(rows)s, ME_ID = %(me)s;
  var OFFLINE = %(offline)s;
  /* 沒帶團代號就補上 —— 截圖和大部分探針要的是「打開這一團」那個畫面。
     new(一團都沒有)要的是首頁,不補。 */
  if (mode !== "new" && !/[?&]t=/.test(q)) {
    history.replaceState(null, "", location.pathname + (q ? q + "&" : "?") + "t=" + CODE);
  }
  var real = window.fetch.bind(window), seq = 0;
  window.__rows = ROWS;   /* 探針要問「存下去了沒」就讀這裡(以前讀 localStorage 的 tokyo5-v1) */
  /* 呼叫紀錄跨頁面留著 —— 開團/加入成功會跳頁,跳過去之後還要看得到剛剛送了什麼 */
  window.__calls = []; try { window.__calls = JSON.parse(sessionStorage.getItem("fake-calls") || "[]"); } catch (e) {}
  if (mode === "member") { MEMBERS.forEach(function(m){ m.role = m.id === ME_ID ? "成員" : m.role; });
                           MEMBERS[1].role = "團主"; }
  var me = (mode === "anon" || mode === "app") ? null : { id: "U-fake-0001", name: "測試的人", avatar: "" };
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
    if (s.indexOf("/api/auth?go=code") >= 0) {
      var c = String(body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      return c === "ABCD2345" ? reply({ ok: true, user: { id: "U-fake-0001", name: "測試的人" } })
        : reply({ error: "這組登入碼不對,或已經過期(10 分鐘)—— 回瀏覽器重新登入一次" }, 403);
    }
    if (s.indexOf("/api/notion") < 0) return real(u, init);
    var r = param(s, "resource");
    if (!me) return reply({ error: "請先用 LINE 登入", why: "login" }, 401);
    var mine = MEMBERS.filter(function(m){ return m.id === ME_ID; })[0];
    if (r === "trips") {
      if (method === "POST") return reply({ code: "newtrip1", me: { id: "mnew01", name: body.myName, color: "#E60012", role: "團主" } });
      return reply({ trips: joined ? [{ code: CODE, name: TRIP.name, country: TRIP.country, city: TRIP.city,
        start: TRIP.start, end: TRIP.end, role: mine.role }] : [] });
    }
    if (r === "join") {
      if (method === "GET") return param(s, "code") === "q4wn8t"
        ? reply({ joined: false, trip: { code: CODE, name: TRIP.name }, host: "佳瑜" })
        : reply({ error: "邀請碼不對,或已經換掉了 —— 跟邀請你的人再要一次", why: "bad_invite" }, 403);
      if (body.invite !== "q4wn8t") return reply({ error: "邀請碼不對,或已經換掉了 —— 跟邀請你的人再要一次", why: "bad_invite" }, 403);
      joined = true;
      return reply({ joined: true, me: { id: ME_ID, name: body.name, color: "#E60012", role: "成員" }, trip: { code: CODE, name: TRIP.name } });
    }
    if (!joined) return reply({ error: "你還不是這一團的人 —— 要有邀請碼才能加入", why: "not_member" }, 403);
    if (r === "team") {
      if (method === "PATCH") { Object.keys(body).forEach(function(k){ if (k !== "can") TRIP[k] = body[k]; });
        if (body.can) Object.keys(body.can).forEach(function(k){ TRIP.can[k] = body.can[k]; });
        return reply({ trip: TRIP }); }
      return reply({ trip: TRIP, members: MEMBERS, me: { id: mine.id, name: mine.name, color: mine.color, role: mine.role, invite: "q4wn8t" } });
    }
    if (r === "me") {
      if (body.name) mine.name = body.name;
      if (body.color) mine.color = body.color;
      return reply({ me: { id: mine.id, name: mine.name, color: mine.color, role: mine.role, invite: body.invite ? "z9z9z9" : "q4wn8t" } });
    }
    var rows = ROWS[r];
    if (!rows) return reply({ error: "不認識的資料表:" + r }, 400);
    var id = param(s, "id");
    if (method === "GET") return reply({ rows: rows });
    if (method === "POST") { var row = Object.assign({ id: "new" + (++seq) }, body); rows.push(row); return reply({ row: row }); }
    var hit = rows.filter(function(x){ return x.id === id; })[0];
    if (!hit) return reply({ error: "這一團沒有這一筆" }, 404);
    if (method === "PATCH") { Object.assign(hit, body); return reply({ row: hit }); }
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
                      "rows": d(FAKE_ROWS), "me": d(ME_ID), "offline": "true" if offline else "false"}
    return CLOCK + ("<script>try{"
      "localStorage.setItem('trippps-wx',"+j(WX)+");"
      "localStorage.setItem('tokyo5-pin3',"+j(PINS)+");"
      + extra +
      "}catch(e){}</script>\n<script>" + fake + "</script>\n")
