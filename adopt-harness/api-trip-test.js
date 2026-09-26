/* api/notion.js 第 2 期:開團、加入、誰看得到哪一團、誰改得動什麼。用法:
 *     node adopt-harness/api-trip-test.js
 *
 * 取代第 1 期的 api-team-test.js(那一支測的是通行碼和「認領位子」,兩個都拿掉了)。
 *
 * 形狀跟 api-auth-test.js 一樣把 `global.fetch` 換成樁,但**這一支的樁是一個
 * 活的假 Notion**:寫進去的東西下一次讀得出來。第 2 期要測的幾乎都是
 * 「甲做了一件事之後,乙看到什麼」—— 回固定 JSON 的樁測不出這種事。
 *
 * **這一支盯的事,畫面上都看不到:**
 *   1. 別人的團讀不到,連「有誰」都讀不到。
 *   2. 拿得到別團某一筆的 id,也改不動它(甲團成員不能改乙團的帳)。
 *   3. 回給瀏覽器的東西裡沒有任何人的 LINE ID,也沒有別人的邀請碼。
 *   4. 「誰許的願」「誰按的 +1」由伺服器認人,前端送什麼都不算數。
 */
const path = require("path");
const SRC = process.env.SRC || path.join(__dirname, "..", "tokyo-trip", "api", "notion.js");
const SECRET = "test-channel-secret";

const LINE_A = "U" + "a".repeat(32);   // 開第一團的人(團主)
const LINE_B = "U" + "b".repeat(32);   // 拿 A 的邀請碼加入
const LINE_C = "U" + "c".repeat(32);   // 開另一團的陌生人
const LINE_D = "U" + "d".repeat(32);   // 也加入 A 那團,沒有任何權限

/* ---------- 活的假 Notion ---------- */
const DB = {
  trips: "4802c8eac4a14943bf41a38394031acc",
  members: "bee61d7fae604013968455412b2d57a5",
  itinerary: "fb55bb99d77749aea5b41cf897f566e7",
  expenses: "06b4de9448ff427eb0e68481a2b48a11",
  seats: "16c8f7cfc12c4e6d89cab63011295888",
  flights: "4c438316581d4cb89a08258f0ebbe57e",
};
const dash = id => id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
let pages = [];
let seq = 0;
let lost = false;
let writes = 0;

/* 寫進去的格式(`{ rich_text: [{ text: { content } }] }`)換成讀出來的格式
   (`{ rich_text: [{ plain_text }] }`)—— 真的 Notion 就是這樣,兩邊不對稱。 */
function stored(v) {
  if (v.title) return { title: v.title.map(t => ({ plain_text: t.text.content })) };
  if (v.rich_text) return { rich_text: v.rich_text.map(t => ({ plain_text: t.text.content })) };
  return v;
}
const plain = p => ((p && (p.title || p.rich_text)) || []).map(t => t.plain_text).join("");
function matches(page, f) {
  if (!f) return true;
  if (f.and) return f.and.every(x => matches(page, x));
  const p = page.properties[f.property];
  if (f.title) return plain(p) === f.title.equals;
  if (f.rich_text) return plain(p) === f.rich_text.equals;
  if (f.date && f.date.is_empty) return !(p && p.date && p.date.start);
  throw new Error("假 Notion 不認得這個 filter: " + JSON.stringify(f));
}
const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
const clone = x => JSON.parse(JSON.stringify(x));

async function fakeFetch(u, init) {
  const url = String(u);
  const method = (init && init.method) || "GET";
  const body = init && init.body ? JSON.parse(init.body) : {};
  if (lost) return reply(404, { message: "Could not find database with ID …", code: "object_not_found" });
  let m = /\/databases\/([0-9a-f]+)\/query$/.exec(url);
  if (m) {
    const rows = pages.filter(p => !p.archived && p.parent.database_id.replace(/-/g, "") === m[1] && matches(p, body.filter));
    return reply(200, { results: clone(rows), has_more: false });
  }
  if (/\/pages$/.test(url) && method === "POST") {
    writes++;
    const props = {};
    for (const [k, v] of Object.entries(body.properties)) props[k] = stored(v);
    const id = dash((++seq).toString(16).padStart(32, "0"));
    const page = { id, parent: { database_id: dash(body.parent.database_id) }, archived: false,
                   created_time: new Date().toISOString(), properties: props };
    pages.push(page);
    return reply(200, clone(page));
  }
  m = /\/pages\/([0-9a-f-]+)$/.exec(url);
  if (m) {
    const page = pages.find(p => p.id === m[1] || p.id.replace(/-/g, "") === m[1]);
    if (!page) return reply(404, { message: "Could not find page", code: "object_not_found" });
    if (method === "PATCH") {
      writes++;
      if (body.archived) page.archived = true;
      for (const [k, v] of Object.entries(body.properties || {})) page.properties[k] = stored(v);
    }
    return reply(200, clone(page));
  }
  return reply(500, { message: "假 Notion 沒認出這個網址: " + url });
}

/* ---------- 呼叫 ---------- */
function mkres() {
  const r = { code: 200, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.getHeader = k => r.headers[k.toLowerCase()];
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.end = () => r;
  return r;
}
let S;
function cookieFor(sub) {
  const v = S.sign({ sub, name: "誰", pic: "", exp: Date.now() + 864e5 }, S.hmacKey());
  return "trip_u=" + encodeURIComponent(v);
}
async function call(who, method, query, body) {
  process.env.NOTION_TOKEN = "ntn_test";
  process.env.LINE_CHANNEL_SECRET = SECRET;
  delete process.env.TRIP_KEY;
  ["NOTION_DB_EXPENSES", "NOTION_DB_ITINERARY", "NOTION_DB_SEATS", "NOTION_DB_FLIGHTS", "NOTION_DB_TRIPS", "NOTION_DB_MEMBERS"]
    .forEach(k => delete process.env[k]);
  delete require.cache[require.resolve(SRC)];
  const handler = require(SRC);
  global.fetch = fakeFetch;
  const res = mkres();
  await handler({ method, query, body: body === undefined ? undefined : JSON.stringify(body),
                  headers: { cookie: who ? cookieFor(who) : "" } }, res);
  return res;
}

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? "✓ " : "✗ ") + name + (cond ? "" : "   ← " + JSON.stringify(extra)));
  if (!cond) fails++;
}
const rowsIn = db => pages.filter(p => !p.archived && p.parent.database_id.replace(/-/g, "") === db);
const memberRow = (code, sub) => rowsIn(DB.members).find(p => plain(p.properties["團"]) === code && plain(p.properties["人"]) === sub);

(async () => {
  process.env.LINE_CHANNEL_SECRET = SECRET;
  S = require(path.join(path.dirname(SRC), "_session.js"));
  let r;

  /* ================= 我的團、開團 ================= */
  r = await call(null, "GET", { resource: "trips" });
  ok("沒登入 → 401,並說是「要登入」(前端靠 why 決定畫哪一張卡)",
    r.code === 401 && r.body.why === "login", r.body);

  r = await call(LINE_A, "GET", { resource: "trips" });
  ok("登入了、還沒有任何團 → 空清單(這就是「引導開團」那個畫面)",
    r.code === 200 && Array.isArray(r.body.trips) && r.body.trips.length === 0, r.body);

  const good = { name: "東京五人行", country: "日本", city: "", start: "2026-10-03", end: "2026-10-08", myName: "佳瑜" };
  for (const [why, patch] of [
    ["沒有團名", { name: "  " }], ["國家不是日本或台灣", { country: "韓國" }],
    ["結束日比開始日早", { end: "2026-10-01" }], ["超過 60 天", { end: "2026-12-31" }],
    ["日期格式不對", { start: "10/3" }], ["沒填自己叫什麼", { myName: "" }],
  ]) {
    const before = writes;
    r = await call(LINE_A, "POST", { resource: "trips" }, { ...good, ...patch });
    ok("開團:" + why + " → 400,而且 Notion 一筆都沒寫", r.code === 400 && writes === before, r.body);
  }

  r = await call(LINE_A, "POST", { resource: "trips" }, good);
  const T1 = r.body.code;
  ok("開團成功,回一個 8 碼、猜不到的代號(沒有 0/o/1/l/i)",
    r.code === 200 && /^[a-hj-km-np-z2-9]{8}$/.test(T1 || ""), r.body);
  const tripRow = rowsIn(DB.trips).find(p => plain(p.properties["代號"]) === T1);
  ok("「團」那一列:名稱、國家、日期、建立者都寫進去了,匯率照國家帶預設",
    tripRow && plain(tripRow.properties["名稱"]) === "東京五人行" &&
    tripRow.properties["國家"].select.name === "日本" && tripRow.properties["匯率"].number === 0.21 &&
    plain(tripRow.properties["建立者"]) === LINE_A, tripRow && tripRow.properties);
  const aRow = memberRow(T1, LINE_A);
  ok("開團的人就是團主,名字是他填的,有自己的 6 碼邀請碼",
    aRow && aRow.properties["角色"].select.name === "團主" && plain(aRow.properties["名字"]) === "佳瑜" &&
    /^[a-z2-9]{6}$/.test(plain(aRow.properties["邀請碼"])), aRow && aRow.properties);
  const inviteA = plain(aRow.properties["邀請碼"]);

  r = await call(LINE_A, "GET", { resource: "trips" });
  ok("我的團:列出剛開的那一團,角色是團主",
    r.body.trips.length === 1 && r.body.trips[0].code === T1 && r.body.trips[0].role === "團主", r.body);

  /* ================= 這一團:誰看得到 ================= */
  r = await call(null, "GET", { resource: "team", t: T1 });
  ok("沒登入看這一團 → 401", r.code === 401 && r.body.why === "login", r.body);
  r = await call(LINE_B, "GET", { resource: "team", t: T1 });
  ok("登入了但不是這一團的人 → 403 not_member(連有誰都看不到)",
    r.code === 403 && r.body.why === "not_member" && !r.body.members && !r.body.trip, r.body);
  r = await call(LINE_A, "GET", { resource: "team", t: "zzzzzzzz" });
  ok("沒有這一團 → 404 no_trip", r.code === 404 && r.body.why === "no_trip", r.body);
  r = await call(LINE_A, "GET", { resource: "team", t: T1 });
  ok("團主看得到:團名、國家、城市(沒填就是東京)、幣別",
    r.code === 200 && r.body.trip.name === "東京五人行" && r.body.trip.country === "日本" &&
    r.body.trip.city === "東京" && r.body.trip.currency === "JPY", r.body);
  ok("回我自己的邀請碼(團主要複製它傳給朋友)", r.body.me && r.body.me.invite === inviteA, r.body.me);

  /* ================= 加入 ================= */
  r = await call(LINE_B, "GET", { resource: "join", t: T1, code: "wrong1" });
  ok("邀請碼不對 → 403 bad_invite", r.code === 403 && r.body.why === "bad_invite", r.body);
  let before = writes;
  r = await call(LINE_B, "GET", { resource: "join", t: T1, code: inviteA });
  ok("用 A 的碼先看一眼:團名、是誰邀請的,**不寫任何東西**",
    r.code === 200 && r.body.trip.name === "東京五人行" && r.body.host === "佳瑜" &&
    r.body.joined === false && writes === before, r.body);
  ok("先看一眼的時候拿不到成員名單和日期", !r.body.members && !r.body.trip.start, r.body);

  r = await call(LINE_B, "POST", { resource: "join" }, { trip: T1, invite: inviteA, name: "佳瑜" });
  ok("名字跟團裡的人重複 → 409(分帳上會分不出來)", r.code === 409, r.body);
  r = await call(LINE_B, "POST", { resource: "join" }, { trip: T1, invite: inviteA, name: "阿輝" });
  const B_ID = r.body.me && r.body.me.id;
  ok("B 加入成功,角色是成員", r.code === 200 && r.body.joined && r.body.me.role === "成員", r.body);
  const bRow = memberRow(T1, LINE_B);
  ok("記下是 A 邀請的;B 有自己的邀請碼,顏色跟 A 不一樣",
    bRow && plain(bRow.properties["邀請人"]) === LINE_A &&
    plain(bRow.properties["邀請碼"]) !== inviteA &&
    plain(bRow.properties["顏色"]) !== plain(aRow.properties["顏色"]), bRow && bRow.properties);
  before = writes;
  r = await call(LINE_B, "POST", { resource: "join" }, { trip: T1, invite: inviteA, name: "阿輝2" });
  ok("已經在團裡的人再點一次邀請 → 直接放行,不會多一列", r.code === 200 && r.body.joined && writes === before, r.body);

  r = await call(LINE_B, "GET", { resource: "team", t: T1 });
  ok("B 現在看得到這一團,名單有兩個人", r.code === 200 && r.body.members.length === 2, r.body);
  const flat = JSON.stringify(r.body);
  ok("**回給瀏覽器的東西裡沒有任何人的 LINE ID**", flat.indexOf(LINE_A) < 0 && flat.indexOf(LINE_B) < 0, flat);
  ok("**也沒有別人的邀請碼**(只有自己的)", flat.indexOf(inviteA) < 0, flat);
  ok("也沒有 Notion 的頁面編號", !/"page"/.test(flat), flat);

  r = await call(LINE_D, "POST", { resource: "join" }, { trip: T1, invite: plain(bRow.properties["邀請碼"]), name: "媽" });
  const D_ID = r.body.me && r.body.me.id;
  ok("D 用 B 的碼加入 → 邀請人記的是 B", r.code === 200 &&
    plain(memberRow(T1, LINE_D).properties["邀請人"]) === LINE_B, r.body);

  /* ================= 團的設定 ================= */
  r = await call(LINE_B, "PATCH", { resource: "team", t: T1 }, { name: "被改掉了" });
  ok("成員改團的設定 → 403", r.code === 403, r.body);
  r = await call(LINE_A, "PATCH", { resource: "team", t: T1 }, { name: "東京行", city: "大阪", end: "2026-10-01" });
  ok("團主改日期但結束日比開始日早 → 400,**其他欄位也沒被改**",
    r.code === 400 && plain(tripRow.properties["名稱"]) === "東京五人行", r.body);
  r = await call(LINE_A, "PATCH", { resource: "team", t: T1 }, { name: "東京行", city: "大阪", rate: 0.22 });
  ok("團主改團名、城市、匯率", r.code === 200 && r.body.trip.name === "東京行" &&
    r.body.trip.city === "大阪" && r.body.trip.rate === 0.22, r.body);

  /* ================= 資料分團 ================= */
  r = await call(LINE_A, "POST", { resource: "itinerary", t: T1 }, { title: "淺草寺", day: "2026-10-04" });
  const stopA = r.body.row && r.body.row.id;
  ok("團主加行程 → 那一列蓋上了這一團的代號", r.code === 200 &&
    plain(pages.find(p => p.id === stopA).properties["團"]) === T1, r.body);

  r = await call(LINE_C, "POST", { resource: "trips" }, { ...good, name: "台南吃吃吃", country: "台灣", myName: "小陳" });
  const T2 = r.body.code;
  r = await call(LINE_C, "GET", { resource: "team", t: T2 });
  ok("台灣的團:城市沒填就是台北、幣別台幣、匯率 1",
    r.body.trip.city === "台北" && r.body.trip.currency === "TWD" && r.body.trip.rate === 1, r.body.trip);
  r = await call(LINE_C, "POST", { resource: "itinerary", t: T2 }, { title: "赤崁樓", day: "2026-10-04" });
  const stopC = r.body.row.id;

  r = await call(LINE_A, "GET", { resource: "itinerary", t: T1 });
  ok("**讀行程只拿到自己那一團的**(同一張表裡有別團的資料)",
    r.code === 200 && r.body.rows.length === 1 && r.body.rows[0].title === "淺草寺", r.body);
  r = await call(LINE_A, "GET", { resource: "itinerary", t: T2 });
  ok("讀別團的行程 → 403 not_member", r.code === 403 && r.body.why === "not_member", r.body);
  r = await call(LINE_A, "PATCH", { resource: "itinerary", t: T1, id: stopC }, { title: "被甲團改了" });
  ok("**拿別團某一筆的 id、掛自己團的代號去改 → 404,而且沒改到**",
    r.code === 404 && plain(pages.find(p => p.id === stopC).properties["項目"]) === "赤崁樓", r.body);
  r = await call(LINE_A, "DELETE", { resource: "itinerary", t: T1, id: stopC });
  ok("刪別團那一筆 → 404,而且沒刪到", r.code === 404 && !pages.find(p => p.id === stopC).archived, r.body);
  r = await call(LINE_A, "PATCH", { resource: "expenses", t: T1, id: stopA }, { title: "x" });
  ok("拿行程那一筆的 id 去打花費 → 404(表不對也不行)", r.code === 404, r.body);

  /* ================= 三個開關 ================= */
  r = await call(LINE_B, "POST", { resource: "itinerary", t: T1 }, { title: "晴空塔", day: "2026-10-05" });
  ok("成員加行程、團主還沒開「成員可管行程」→ 403", r.code === 403, r.body);
  await call(LINE_A, "PATCH", { resource: "team", t: T1 }, { can: { plan: true } });
  r = await call(LINE_B, "POST", { resource: "itinerary", t: T1 }, { title: "晴空塔", day: "2026-10-05" });
  ok("團主打開之後 → 成員加得了", r.code === 200, r.body);
  r = await call(LINE_B, "POST", { resource: "expenses", t: T1 }, { title: "拉麵", amount: 1200 });
  ok("但分帳那個開關沒開 → 花費還是加不了", r.code === 403, r.body);

  r = await call(LINE_A, "POST", { resource: "expenses", t: T1 },
    { title: "拉麵", amount: 1200, currency: "JPY", payer: B_ID, participants: [B_ID, D_ID, B_ID, "壞 東西"] });
  ok("花費:付款人、分攤者記成員代號,重複的和格式不對的拿掉",
    r.code === 200 && r.body.row.payer === B_ID &&
    JSON.stringify(r.body.row.participants) === JSON.stringify([B_ID, D_ID]), r.body.row);

  /* ================= 航班(第 2 期以前寫死在前端) ================= */
  r = await call(LINE_B, "POST", { resource: "flights", t: T1 }, { no: "mm626", dir: "去程" });
  ok("成員加航班、團主沒開「成員可管機位」→ 403", r.code === 403, r.body);
  r = await call(LINE_A, "POST", { resource: "flights", t: T1 },
    { no: "mm 626", dir: "去程", airline: "樂桃航空", depart: "2026-10-03T10:50", from: "TPE 桃園 T1",
      arrive: "2026-10-03T15:20", to: "NRT 成田 T1" });
  ok("團主加航班:航班號轉大寫去空白,起降時間照登機證上的當地時間存(不換時區)",
    r.code === 200 && r.body.row.no === "MM626" && r.body.row.dir === "去程" &&
    r.body.row.depart === "2026-10-03T10:50" && r.body.row.arrive === "2026-10-03T15:20", r.body);
  const fl = r.body.row.id;
  r = await call(LINE_A, "PATCH", { resource: "flights", t: T1, id: fl }, { dir: "亂寫", depart: "10:50" });
  ok("方向不認得就當「其他」;時間格式不對就清掉,不存一個讀不懂的字串",
    r.code === 200 && r.body.row.dir === "其他" && r.body.row.depart === null && r.body.row.no === "MM626", r.body);
  await call(LINE_A, "PATCH", { resource: "team", t: T1 }, { can: { seat: true } });
  r = await call(LINE_B, "GET", { resource: "flights", t: T1 });
  ok("成員讀得到航班", r.code === 200 && r.body.rows.length === 1, r.body);
  r = await call(LINE_B, "POST", { resource: "flights", t: T1 }, { no: "MM631", dir: "回程" });
  ok("團主打開機位開關之後,成員加得了航班", r.code === 200, r.body);
  r = await call(LINE_C, "GET", { resource: "flights", t: T2 });
  ok("別團讀不到這一團的航班", r.code === 200 && r.body.rows.length === 0, r.body);

  /* ================= 許願 ================= */
  await call(LINE_A, "PATCH", { resource: "team", t: T1 }, { can: { plan: false } });
  r = await call(LINE_B, "POST", { resource: "wishes", t: T1 },
    { title: "築地", place: "築地場外", note: "早上去", by: "chang_chiayu", votes: ["別人", B_ID] });
  const wish = r.body.row;
  ok("成員都能許願(不用開關)", r.code === 200, r.body);
  ok("**「誰許的」是伺服器認的:前端說是別人,存下來的還是 B**", wish && wish.by === B_ID, wish);
  ok("許願時的票只留自己那一票", wish && JSON.stringify(wish.votes) === JSON.stringify([B_ID]), wish);

  r = await call(LINE_D, "PATCH", { resource: "wishes", t: T1, id: wish.id }, { votes: [D_ID] });
  ok("D 按 +1:加上 D,**B 的票還在**(前端送的清單裡沒有 B 也一樣)",
    r.code === 200 && r.body.row.votes.indexOf(B_ID) >= 0 && r.body.row.votes.indexOf(D_ID) >= 0, r.body);
  ok("只送 votes 的 +1 不會把標題、地點、備註清掉",
    r.body.row.title === "築地" && r.body.row.place === "築地場外" && r.body.row.note === "早上去", r.body.row);
  r = await call(LINE_D, "PATCH", { resource: "wishes", t: T1, id: wish.id }, { votes: [] });
  ok("D 收回 +1:只拿掉 D 自己那一票", r.body.row.votes.join() === B_ID, r.body.row);
  r = await call(LINE_D, "PATCH", { resource: "wishes", t: T1, id: wish.id }, { title: "D 改的" });
  ok("**D 不是許願的人、也沒有管行程的權限 → 改不了內容**(以前這只是介面上的規則)",
    r.code === 403 && plain(pages.find(p => p.id === wish.id).properties["項目"]) === "築地", r.body);
  r = await call(LINE_B, "PATCH", { resource: "wishes", t: T1, id: wish.id }, { title: "築地市場", by: D_ID });
  ok("許願的人自己改得了;順手想改「誰許的」→ 沒用", r.code === 200 &&
    r.body.row.title === "築地市場" && r.body.row.by === B_ID, r.body);
  r = await call(LINE_A, "PATCH", { resource: "wishes", t: T1, id: wish.id }, { note: "團主補一句" });
  ok("團主改得了別人的願望", r.code === 200 && r.body.row.note === "團主補一句", r.body);
  r = await call(LINE_D, "DELETE", { resource: "wishes", t: T1, id: wish.id });
  ok("D 刪別人的願望 → 403", r.code === 403, r.body);
  r = await call(LINE_C, "PATCH", { resource: "wishes", t: T2, id: wish.id }, { votes: ["x"] });
  ok("別團的人掛自己團的代號來 +1 → 404", r.code === 404, r.body);
  r = await call(LINE_B, "DELETE", { resource: "wishes", t: T1, id: wish.id });
  ok("許願的人自己刪得掉", r.code === 200 && pages.find(p => p.id === wish.id).archived, r.body);

  /* ================= 我自己 ================= */
  r = await call(LINE_B, "PATCH", { resource: "me", t: T1 }, { name: "佳瑜" });
  ok("改名改成團裡別人的名字 → 409", r.code === 409, r.body);
  r = await call(LINE_B, "PATCH", { resource: "me", t: T1 }, { color: "red" });
  ok("顏色格式不對 → 400", r.code === 400, r.body);
  const oldInviteB = plain(memberRow(T1, LINE_B).properties["邀請碼"]);
  r = await call(LINE_B, "PATCH", { resource: "me", t: T1 }, { invite: "renew", color: "#123456" });
  ok("換邀請碼、改顏色", r.code === 200 && r.body.me.invite !== oldInviteB && r.body.me.color === "#123456", r.body);
  r = await call(LINE_C, "GET", { resource: "join", t: T1, code: oldInviteB });
  ok("**換掉之後,舊的碼就不能用了**(斷掉那一條擴散線)", r.code === 403 && r.body.why === "bad_invite", r.body);
  r = await call(LINE_C, "GET", { resource: "join", t: T1, code: inviteA });
  ok("別人的碼不受影響", r.code === 200 && r.body.host === "佳瑜", r.body);

  /* ================= 拿掉的東西、出事的時候 ================= */
  for (const res of ["claim", "auth"]) {
    r = await call(LINE_A, "GET", { resource: res, t: T1 });
    ok("第 1 期的 resource=" + res + " 已經拿掉 → 400", r.code === 400, r.body);
  }
  lost = true;
  r = await call(LINE_A, "GET", { resource: "team", t: T1 });
  ok("Notion 那邊讀不到(integration 沒加進新表)→ 503,**並說出是哪一種**",
    r.code === 503 && /Connections/.test(r.body.error), r.body);
  lost = false;
  const ticket = cookieFor(LINE_A);   // 票要在拿掉密鑰之前簽,不然簽不出來
  delete process.env.LINE_CHANNEL_SECRET;
  r = await (async () => {
    delete require.cache[require.resolve(SRC)];
    const handler = require(SRC);
    const res = mkres();
    await handler({ method: "GET", query: { resource: "itinerary", t: T1 }, headers: { cookie: ticket } }, res);
    return res;
  })();
  ok("伺服器沒設 LINE_CHANNEL_SECRET → 誰都是沒登入,讀不到任何一團", r.code === 401, r.body);

  console.log(fails ? "\n有 " + fails + " 項沒過" : "\n全部通過");
  process.exit(fails ? 1 : 0);
})();
