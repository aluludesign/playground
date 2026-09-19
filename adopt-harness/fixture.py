# 固定的測試資料。天氣和座標都預先灌進快取,跑截圖時不連網查 ——
# 否則每次的天氣數字都不一樣,比對會被那個淹沒,看不出 CSS 有沒有壞。
import json
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
STATE = {"version":3,"rate":0.21,"names":{},"expenses":EXPENSES,"stops":STOPS,"wishes":WISHES}
# 固定天氣:六天都給同一組,免得預報變動害比對失真
DAYS = ["2026-10-0%d" % d for d in range(3,9)]
WX = {"35.68,139.65":{"at":9e14,"days":{d:[40,24.0,18.0] for d in DAYS}},
      "35.23,139.11":{"at":9e14,"days":{d:[55,22.0,15.0] for d in DAYS}}}
# key 必須跟 index.html 的 PINLS 一字不差(現在是 tokyo5-pin3)。對不上不會報錯,
# 只是快取整份失效 —— 地圖改成去 Nominatim 現查,截圖就跟著網路快慢變。
PINS = {"淺草寺":{"la":35.7134,"lo":139.7955},"築地市場":{"la":35.6649,"lo":139.7669},
        "合羽橋道具街":{"la":35.7143,"lo":139.7889},"明治神宮":{"la":35.6748,"lo":139.6996},
        "teamLab":{"la":35.6620,"lo":139.7434},"港灣未來":{"la":35.4437,"lo":139.6380},
        "橫濱 港灣未來":{"la":35.4437,"lo":139.6380},"泡溫泉":None}
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

def seed():
    j = lambda o: json.dumps(json.dumps(o, ensure_ascii=False))
    return CLOCK + ("<script>try{"
      "localStorage.setItem('tokyo5-v1',"+j(STATE)+");"
      "localStorage.setItem('tokyo5-wx',"+j(WX)+");"
      "localStorage.setItem('tokyo5-pin3',"+j(PINS)+");"
      "localStorage.setItem('tokyo5-me','hsieh_chinhui');"
      "}catch(e){}</script>\n")
