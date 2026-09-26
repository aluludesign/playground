/* 第 2 期:按下去之後。PAGE= 帶 fake= 切角色,FLOW= 沒辦法傳進來,所以看網址決定跑哪一段。 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var wait = ms => new Promise(r => w.setTimeout(r, ms));
var set = (id, v) => { var e = q("#" + id); e.value = v; e.dispatchEvent(new w.Event("input", { bubbles: true })); e.dispatchEvent(new w.Event("change", { bubbles: true })); };
/* requestSubmit 會跑瀏覽器的必填檢查 —— 自己丟一個 submit 事件會繞過它,量到的是真人按不出來的路 */
var submit = id => q("#" + id).requestSubmit();
var calls = () => (w.__calls || []).filter(c => c.method !== "GET").map(c => c.method + " " + c.url.replace(/^.*resource=/, "") + " " + JSON.stringify(c.body));
var mode = (/[?&]fake=([a-z]+)/.exec(w.location.search) || [])[1] || "owner";
var hrefs = [];
return (async function () {
  if (mode === "new") {
    submit("h-create"); await wait(50);
    var emptyErr = txt("#home-err") || "(瀏覽器擋:required)";
    set("h-country", "台灣");
    var cityPh = q("#h-city").placeholder;
    set("h-name", "台南吃吃吃"); set("h-start", "2026-11-01"); set("h-me", "小陳");
    var endAuto = q("#h-end").value;
    w.sessionStorage.setItem("probe-before", JSON.stringify({ emptyErr, cityPh, endAuto }));
    w.sessionStorage.setItem("probe-calls", "1");
    submit("h-create"); await wait(300);
    return { stayed: true, err: txt("#home-err"), calls: calls() };
  }
  if (mode === "join") {
    set("h-code", "wrong1"); submit("h-join"); await wait(300);
    var bad = txt("#home-err");
    w.sessionStorage.setItem("probe-before", JSON.stringify({ bad }));
    w.sessionStorage.setItem("probe-calls", "1");
    set("h-code", "q4wn8t"); set("h-me", "阿輝"); submit("h-join"); await wait(300);
    return { stayed: true, err: txt("#home-err"), calls: calls() };
  }
  /* 開團/加入成功會跳頁,跳過來之後在這裡交代前半段量到的東西 */
  var before = w.sessionStorage.getItem("probe-before");
  if (before) { w.sessionStorage.removeItem("probe-before");
    return { landedOn: w.location.search, before: JSON.parse(before), h1: txt("#trip-name"), sent: calls() }; }
  /* 團主:加航班、改座位、團的設定、邀請 */
  q("[data-flight-add]").click(); await wait(50);
  var formOpen = !q("#flight-overlay").hidden, dirDefault = q("#fl-dir").value, seatInputs = qa("#fl-seats input").length;
  set("fl-no", "br 198"); set("fl-dir", "其他"); set("fl-depart", "2026-10-06T08:00"); set("fl-arrive", "2026-10-06T07:00");
  submit("flight-form"); await wait(100);
  var backwards = txt("#fl-err");
  set("fl-arrive", "2026-10-06T09:30"); set("fl-from", "HND 羽田"); set("fl-to", "CTS 新千歲");
  set("fl-seat-hsieh_chinhui", "12c");
  submit("flight-form"); await wait(400);
  var legs = qa("#board-wrap .leg-no").map(x => x.textContent.replace(/\s+/g, " ").trim());
  var anchors6 = (function () { return txt("#route"); })();
  q("#cloud-set").click(); await wait(50);
  var setOpen = !q("#settings-overlay").hidden, setName = q("#st-name").value, myName = q("#st-myname").value;
  set("st-name", "東京六人行"); q("#st-can-plan").checked = true;
  submit("settings-form"); await wait(500);
  var h1 = txt("#trip-name");
  q("#cloud-invite").click(); await wait(50);
  return { formOpen, dirDefault, seatInputs, backwards, legs, setOpen, setName, myName, h1,
           inviteUrl: txt("#inv-url"), inviteCode: txt("#inv-code"), line: (q("#inv-line").href || "").slice(0, 60),
           calls: calls() };
})();
