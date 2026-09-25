/* api/notion.js 的 `resource=team` —— 「這一團是什麼、有誰」。用法:
 *     node adopt-harness/api-team-test.js
 *
 * 形狀照 api-auth-test.js:`global.fetch` 換成樁,測的是「Notion 這樣回的時候,
 * 我寫的那段做了什麼」。這裡沒有 Notion token,也不該有。
 *
 * **這一支盯的兩件事,探針都看不到**:
 *   1. 回給瀏覽器的東西裡**不能有任何人的 LINE ID**。那是別人的身分,
 *      畫面上一個字都用不到,而它一旦出去就再也收不回來。
 *   2. 「integration 沒被加到那一頁」和「這團真的沒有人」要分得出來。
 *      前者現在會大聲說出來 —— 安靜地回一張空名單的話,畫面上看起來
 *      只是「這團沒有人」,沒有任何地方會講一句。
 */
const path = require("path");
const SRC = process.env.SRC || path.join(__dirname, "..", "tokyo-trip", "api", "notion.js");
const SECRET = "test-channel-secret";

function mkres() {
  const r = { code: 200, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.getHeader = k => r.headers[k.toLowerCase()];
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.end = () => r;
  Object.defineProperty(r, "statusCode", { get() { return r.code; }, set(v) { r.code = v; } });
  return r;
}

const LINE_A = "U1111111111111111111111111111111";
const LINE_B = "U2222222222222222222222222222222";

const title = v => ({ title: [{ plain_text: v }] });
const text = v => ({ rich_text: v ? [{ plain_text: v }] : [] });
const тrip = null;

function tripPage(can) {
  return { properties: {
    "代號": title("tokyo"), "名稱": text("東京五人行"),
    "開始日": { date: { start: "2026-10-03" } }, "結束日": { date: { start: "2026-10-08" } },
    "匯率": { number: 0.21 }, "基金": { number: 30000 },
    "成員可管行程": { checkbox: !!(can && can.plan) },
    "成員可管分帳": { checkbox: !!(can && can.cost) },
    "成員可管機位": { checkbox: !!(can && can.seat) },
  } };
}
function memberPage(id, name, key, color, role, line, invite) {
  return { id: "page-" + id, properties: {
    "代號": title("tokyo:" + id), "團": text("tokyo"), "名字": text(name),
    "舊代號": text(key), "顏色": text(color), "角色": { select: { name: role } },
    "人": text(line), "邀請碼": text(invite),
  } };
}

let patches = [];
async function call(query, opts) {
  const o = opts || {};
  patches = [];
  process.env.NOTION_TOKEN = "ntn_test";
  process.env.LINE_CHANNEL_SECRET = SECRET;
  delete require.cache[require.resolve(SRC)];
  const handler = require(SRC);
  global.fetch = async (u, init) => {
    const url = String(u);
    const body = JSON.parse((init && init.body) || "{}");
    if (o.lost) return { ok: false, status: 404,
      json: async () => ({ message: "Could not find database with ID …", code: "object_not_found" }) };
    if (/\/databases\/9342c88d/.test(url)) {
      const want = body.filter && body.filter.title && body.filter.title.equals;
      const hit = want === "tokyo" && !o.noTrip;
      return { ok: true, status: 200, json: async () => ({ results: hit ? [tripPage(o.can)] : [], has_more: false }) };
    }
    if (/\/databases\/12f3ff46/.test(url)) {
      return { ok: true, status: 200, json: async () => ({ results: o.members || [], has_more: false }) };
    }
    if (/\/pages$/.test(url) && (init && init.method) === "POST") {
      patches.push({ page: "新的一列", body: body });
      return { ok: true, status: 200, json: async () => ({ id: "new", properties: {} }) };
    }
    if (/\/pages\//.test(url) && (init && init.method) === "PATCH") {
      patches.push({ page: url.slice(url.lastIndexOf("/") + 1), body: body });
      return { ok: true, status: 200, json: async () => ({ id: "ok" }) };
    }
    return { ok: false, status: 500, json: async () => ({ message: "樁沒認出這個網址: " + url }) };
  };
  const res = mkres();
  await handler({ method: o.method || "GET", query, body: o.post,
                  headers: { cookie: o.cookie || "", "x-trip-key": o.key || "" } }, res);
  return res;
}

const FIVE = [
  memberPage("chang_chiayu", "佳瑜", "Chiayu", "#F39700", "團主", LINE_A, "q4wn8t"),
  memberPage("hsieh_chinhui", "阿輝", "Chinhui", "#E60012", "成員", "", "hx7k2m"),
  memberPage("chen_suchih", "媽", "Suchih", "#9B7CB6", "成員", "", "n2fg7c"),
];

function cookieFor(sub) {
  const S = require("../tokyo-trip/api/_session.js");
  process.env.LINE_CHANNEL_SECRET = SECRET;
  const v = S.sign({ sub, name: "誰", pic: "", exp: Date.now() + 86400000 }, S.hmacKey());
  return "trip_u=" + encodeURIComponent(v);
}

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? "✓ " : "✗ ") + name + (cond ? "" : "   ← " + JSON.stringify(extra)));
  if (!cond) fails++;
}

(async () => {
  let r;

  r = await call({ resource: "team", t: "tokyo" }, { members: FIVE });
  ok("讀得到這一團", r.code === 200 && r.body.trip && r.body.trip.name === "東京五人行", r.body);
  ok("日期、匯率、基金都從「團」那一列來,不再寫死在程式裡",
    r.body.trip.start === "2026-10-03" && r.body.trip.end === "2026-10-08" &&
    r.body.trip.rate === 0.21 && r.body.trip.kitty === 30000, r.body.trip);
  ok("三個成員都在,名字/顏色/舊代號都帶著",
    r.body.members.length === 3 &&
    r.body.members[0].name === "佳瑜" && r.body.members[0].key === "Chiayu" &&
    r.body.members[0].color === "#F39700", r.body.members);
  ok("**舊代號要在** —— 沒有它,Notion 裡「付款人 = Chiayu」就對不回任何人",
    r.body.members.every(m => typeof m.key === "string"), r.body.members);

  /* ---- 最重要的一條 ---- */
  const dump = JSON.stringify(r.body);
  ok("**回給瀏覽器的東西裡一個 LINE ID 都沒有**",
    dump.indexOf(LINE_A) < 0 && dump.indexOf(LINE_B) < 0 && dump.indexOf("U11111") < 0, dump.slice(0, 300));
  ok("邀請碼也不會順手漏出去(那是可以拿來加入的東西)",
    dump.indexOf("q4wn8t") < 0 && dump.indexOf("hx7k2m") < 0, dump.slice(0, 300));
  ok("只說這個位子有沒有人認領",
    r.body.members[0].claimed === true && r.body.members[1].claimed === false,
    r.body.members.map(m => [m.name, m.claimed]));

  /* ---- 我是誰 ---- */
  ok("沒登入 → me 是 null(不是猜一個)", r.body.me === null, r.body.me);
  r = await call({ resource: "team", t: "tokyo" }, { members: FIVE, cookie: cookieFor(LINE_A) });
  ok("登入了 → 認得出我是哪一個位子,以及我是團主",
    r.body.me && r.body.me.id === "chang_chiayu" && r.body.me.role === "團主", r.body.me);
  r = await call({ resource: "team", t: "tokyo" }, { members: FIVE, cookie: cookieFor(LINE_B) });
  ok("登入了但沒認領任何位子 → me 還是 null", r.body.me === null, r.body.me);

  /* ---- 權限開關 ---- */
  r = await call({ resource: "team", t: "tokyo" }, { members: FIVE });
  ok("三個開關預設全關(沒設定不等於不設防)",
    r.body.trip.can.plan === false && r.body.trip.can.cost === false && r.body.trip.can.seat === false,
    r.body.trip.can);
  r = await call({ resource: "team", t: "tokyo" }, { members: FIVE, can: { plan: true } });
  ok("團主把「成員可管行程」打開 → 傳得到前端",
    r.body.trip.can.plan === true && r.body.trip.can.cost === false, r.body.trip.can);

  /* ---- 分得出「讀不到」和「沒有」 ---- */
  r = await call({ resource: "team", t: "tokyo" }, { lost: true });
  ok("**integration 沒被加進 Connections → 大聲說出來,不是回一張空名單**",
    r.code === 503 && /Connections/.test(r.body.error || ""), { code: r.code, body: r.body });

  r = await call({ resource: "team", t: "okinawa" }, { noTrip: true, members: [] });
  ok("沒有這一團 → 404,而且說出是哪一團",
    r.code === 404 && /okinawa/.test(r.body.error || ""), { code: r.code, body: r.body });

  r = await call({ resource: "team", t: "../../etc/passwd" }, { members: FIVE });
  ok("團的代號長得不對 → 400,不會拿去拼查詢",
    r.code === 400, { code: r.code, body: r.body });

  r = await call({ resource: "team", t: "tokyo" }, { members: FIVE, method: "POST" });
  ok("用 POST 打這支 → 405", r.code === 405, r.code);

  r = await call({ resource: "team" }, { members: FIVE });
  ok("沒帶 t → 預設 tokyo(現在只有這一團;第 2 期網址會一定帶)",
    r.code === 200 && r.body.trip.code === "tokyo", r.body && r.body.trip);

  /* ================= 認領位子 ================= */
  const CLAIM = { resource: "claim" };
  const post = (obj, extra) => Object.assign({ method: "POST", post: JSON.stringify(obj), members: FIVE }, extra);

  r = await call(CLAIM, post({ trip: "tokyo", member: "hsieh_chinhui" }));
  ok("沒登入就想認領 → 401,而且叫他先登入",
    r.code === 401 && /登入/.test(r.body.error || ""), { code: r.code, body: r.body });
  ok("而且一筆都沒寫進 Notion", patches.length === 0, patches);

  r = await call(CLAIM, post({ trip: "tokyo", member: "hsieh_chinhui" }, { cookie: cookieFor(LINE_B) }));
  ok("認領一個沒人的位子 → 成功,而且回的是那個位子",
    r.code === 200 && r.body.me && r.body.me.id === "hsieh_chinhui", { code: r.code, body: r.body });
  ok("**真的寫回 Notion 那一列**(不是只回一個成功)",
    patches.length === 1 && patches[0].page === "page-hsieh_chinhui", patches);
  ok("寫的是我的 LINE ID,還有加入時間",
    JSON.stringify(patches[0].body).indexOf(LINE_B) > 0 && !!patches[0].body.properties["加入時間"],
    patches[0].body);

  r = await call(CLAIM, post({ trip: "tokyo", member: "chang_chiayu" }, { cookie: cookieFor(LINE_B) }));
  ok("**認領已經有人的位子 → 409,不是默默蓋過去**",
    r.code === 409 && /已經有人/.test(r.body.error || ""), { code: r.code, body: r.body });
  ok("而且沒有寫任何東西", patches.length === 0, patches);

  r = await call(CLAIM, post({ trip: "tokyo", member: "chang_chiayu" }, { cookie: cookieFor(LINE_A) }));
  ok("認領自己已經占著的那個位子 → 不當成衝突", r.code === 200 && r.body.me.id === "chang_chiayu",
    { code: r.code, body: r.body });

  /* 換位子:A 占著佳瑜,改認阿輝 */
  r = await call(CLAIM, post({ trip: "tokyo", member: "hsieh_chinhui" }, { cookie: cookieFor(LINE_A) }));
  ok("換到另一個位子 → 成功", r.code === 200 && r.body.me.id === "hsieh_chinhui", r.body);
  ok("**先放掉舊的,再認新的**(一個人占兩個位子的話,分帳會把他算兩次)",
    patches.length === 2 && patches[0].page === "page-chang_chiayu" &&
    patches[1].page === "page-hsieh_chinhui", patches.map(x => x.page));
  ok("舊那一列的「人」被清空", JSON.stringify(patches[0].body.properties["人"]).indexOf(LINE_A) < 0,
    patches[0].body.properties["人"]);

  r = await call(CLAIM, post({ trip: "tokyo", member: "" }, { cookie: cookieFor(LINE_A) }));
  ok("放掉自己的位子 → me 變回 null", r.code === 200 && r.body.me === null, r.body);
  ok("而且只動自己那一列", patches.length === 1 && patches[0].page === "page-chang_chiayu", patches);

  r = await call(CLAIM, post({ trip: "tokyo", member: "" }, { cookie: cookieFor(LINE_B) }));
  ok("沒占任何位子的人放手 → 什麼都不做,也不報錯",
    r.code === 200 && r.body.me === null && patches.length === 0, { code: r.code, patches: patches });

  r = await call(CLAIM, post({ trip: "tokyo", member: "不存在的位子" }, { cookie: cookieFor(LINE_B) }));
  ok("位子代號長得不對 → 400", r.code === 400, { code: r.code, body: r.body });

  r = await call(CLAIM, post({ trip: "tokyo", member: "nobody_here" }, { cookie: cookieFor(LINE_B) }));
  ok("沒有這個位子 → 404", r.code === 404, { code: r.code, body: r.body });

  r = await call(CLAIM, Object.assign(post({ trip: "tokyo", member: "hsieh_chinhui" },
    { cookie: cookieFor(LINE_B) }), { method: "GET" }));
  ok("用 GET 打認領 → 405", r.code === 405, r.code);

  /* ================= 誰動得了什麼 ================= */
  process.env.TRIP_KEY = "the-passcode";
  const write = (resource, extra) => Object.assign({
    method: "POST", members: FIVE,
    post: JSON.stringify({ title: "測試", day: "2026-10-05" }),
  }, extra);
  const W = res => Object.assign({ resource: res, t: "tokyo" });

  r = await call(W("itinerary"), write("itinerary"));
  ok("沒登入也沒通行碼 → 擋下來,而且叫他去登入",
    r.code === 401 && /登入/.test(r.body.error || ""), { code: r.code, body: r.body });

  r = await call(W("itinerary"), write("itinerary", { key: "the-passcode" }));
  ok("通行碼還通(它是備援,不是退場) —— 五個人都還沒認領之前,沒有它就沒人編輯得了",
    r.code === 200, { code: r.code, body: r.body });

  r = await call(W("itinerary"), write("itinerary", { cookie: cookieFor(LINE_B) }));
  ok("登入了但沒認領位子 → 403,而且說得出下一步是認領",
    r.code === 403 && /認領/.test(r.body.error || ""), { code: r.code, body: r.body });

  /* 阿輝那個位子給 B,角色是成員 */
  const WITH_B = [
    memberPage("chang_chiayu", "佳瑜", "Chiayu", "#F39700", "團主", LINE_A, "q4wn8t"),
    memberPage("hsieh_chinhui", "阿輝", "Chinhui", "#E60012", "成員", LINE_B, "hx7k2m"),
  ];

  r = await call(W("itinerary"), write("itinerary", { cookie: cookieFor(LINE_B), members: WITH_B }));
  ok("**成員 + 開關關著 → 403**(預設只有團主動得了)",
    r.code === 403 && /團主/.test(r.body.error || ""), { code: r.code, body: r.body });

  r = await call(W("itinerary"), write("itinerary",
    { cookie: cookieFor(LINE_B), members: WITH_B, can: { plan: true } }));
  ok("團主打開「成員可管行程」→ 成員排得了行程", r.code === 200, { code: r.code, body: r.body });

  r = await call(W("expenses"), write("expenses",
    { cookie: cookieFor(LINE_B), members: WITH_B, can: { plan: true } }));
  ok("**但分帳那一塊沒開,他就動不了** —— 三個開關是分開的,不是一個",
    r.code === 403, { code: r.code, body: r.body });

  r = await call(W("expenses"), write("expenses", { cookie: cookieFor(LINE_A), members: WITH_B }));
  ok("團主不用任何開關,三塊都動得了", r.code === 200, { code: r.code, body: r.body });

  r = await call(W("seats"), write("seats", { cookie: cookieFor(LINE_A), members: WITH_B }));
  ok("團主也動得了機位", r.code === 200, { code: r.code, body: r.body });

  r = await call(W("wishes"), write("wishes", { cookie: cookieFor(LINE_B), members: FIVE }));
  ok("許願照舊誰都能許(**這一條沒有變**,那三個人本來就靠它)",
    r.code === 200, { code: r.code, body: r.body });

  r = await call(W("itinerary"), write("itinerary",
    { cookie: cookieFor(LINE_B), members: WITH_B, can: { plan: true }, lost: true }));
  ok("讀不到「成員」表的時候 → 擋下來並說清楚,不是默默放行",
    r.code === 503 && /不能編輯/.test(r.body.error || ""), { code: r.code, body: r.body });

  console.log(fails ? "\n✗ " + fails + " 項沒過" : "\n全部通過");
  process.exit(fails ? 1 : 0);
})();
