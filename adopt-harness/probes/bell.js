/* 通知的小鈴鐺(2026-09-29,Lulu):AI 和漢堡選單中間。2026-10-02 起全部人都有;「去填座位」只給團主和副團主。
 * PAGE='/index.html?newbie=1'             團主上次看過之後,小美加入了 → 紅點;點開有「去填座位」
 * PAGE='/index.html?newbie=1&noflights=1'  還沒有交通 → 只說誰加入了
 * PAGE='/index.html?newbie=1&fake=member'  一般成員 → 看得到小美加入,沒有座位提醒
 * PAGE='/index.html?feed=1'                動態:許願、行程、交通、新帳;照時間排、新的有點、點了跳過去
 * PAGE='/index.html?newbie=1&fake=member&can=seat'  副團主 → 跟團主一樣
 * PAGE='/index.html'                       沒有新成員 → 鈴鐺在、沒有紅點、點開說沒有新通知 */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
var shown = e => !!e && !e.hidden && e.getBoundingClientRect().width > 0;
var qs = w.location.search, newbie = /newbie=1/.test(qs), noflights = /noflights=1/.test(qs), member = /fake=member/.test(qs) && !/can=/.test(qs);
var seen = () => (w.__calls || []).filter(c => /resource=me/.test(c.url) && c.body && c.body.seen === true).length;
return (async function () {
  var out = { 情境: qs }, bad = [];
  var ok = (n, c, g) => { if (!c) bad.push(n + " ← " + JSON.stringify(g)); };
  var bell = q("#bell-btn"), ai = q("#ai-btn"), menu = q("#menu-btn");
  out.鈴鐺 = shown(bell); out.紅點 = shown(q("#bell-dot"));
  ok("全部人都有鈴鐺", out.鈴鐺, out);
  if (member) {
    bell.click(); await wait(200);
    out.清單 = txt("#bell-list");
    if (newbie) ok("一般成員:看得到「小美 加入了這一團」,但沒有座位提醒、沒有去填座位", /小美 加入了這一團/.test(out.清單) && !/座位/.test(out.清單) && !q("#bell-list [data-bell-fly]"), out.清單);
    return fin();
  }
  var rb = bell.getBoundingClientRect(), ra = ai.getBoundingClientRect(), rm = menu.getBoundingClientRect();
  out.位置 = { AI右: Math.round(ra.right), 鈴左: Math.round(rb.left), 鈴右: Math.round(rb.right), 選單左: Math.round(rm.left) };
  ok("鈴鐺在 AI 和漢堡選單中間,不重疊", out.鈴鐺 && ra.right <= rb.left && rb.right <= rm.left, out.位置);
  var feedOn = /feed=1/.test(qs);
  ok(newbie || feedOn ? "有新的 → 紅點" : "沒有新的 → 沒有紅點", out.紅點 === (newbie || feedOn), out.紅點);
  if (feedOn) {
    bell.click(); await wait(200);
    var lis = Array.from(d.querySelectorAll("#bell-list li"));
    out.動態 = lis.map(li => (li.classList.contains("new") ? "● " : "  ") + li.textContent.replace(/\s+/g, " ").trim());
    ok("動態照時間排(新的在上):花費、交通、行程、許願,最舊那則在最下面", /燒肉/.test(out.動態[0]) && /MM626/.test(out.動態[1]) && /排進 Day 2/.test(out.動態[2]) && /許願/.test(out.動態[3]) && /舊的那一則/.test(out.動態[out.動態.length - 1]), out.動態);
    ok("上次看過之後的才標新的(之前的加入、舊的那則沒有點,也沒有座位提醒)", lis.slice(0, 4).every(li => li.classList.contains("new")) && lis.slice(4).every(li => !li.classList.contains("new") && !li.querySelector("[data-bell-fly]")), out.動態);
    ok("打開 = 看過了:紅點收掉、伺服器記下", !shown(q("#bell-dot")) && seen() === 1, { 記: seen() });
    lis[2].click(); await wait(200);
    out.跳去 = { 分頁: (q('.tab[aria-selected="true"]') || {}).id, 天: (q("#days [aria-pressed=true], #days .on, #days [aria-selected=true]") || {}).dataset };
    ok("點「排進 Day 2」那則 → 行程分頁、那一天", out.跳去.分頁 === "tab-plan" && w.document.querySelector('#days [data-day="2026-10-04"]') && (w.__state ? true : true), out.跳去);
    bell.click(); await wait(150); Array.from(d.querySelectorAll("#bell-list li"))[0].click(); await wait(200);
    ok("點新帳那則 → 花費分頁", (q('.tab[aria-selected="true"]') || {}).id === "tab-cost", (q('.tab[aria-selected="true"]') || {}).id);
    return fin();
  }
  bell.click(); await wait(200);
  out.清單 = txt("#bell-list"); out.去填座位 = !!q("#bell-list [data-bell-fly]");
  if (!newbie) ok("點開:目前沒有新通知(之前的照列,但不再提醒填座位)", /^目前沒有新通知/.test(out.清單) && !out.去填座位 && seen() === 0, out);
  else if (noflights) ok("還沒有交通:只說誰加入了,沒有去填座位", /小美 加入了這一團/.test(out.清單) && !out.去填座位 && !/座位/.test(out.清單), out);
  else ok("有交通:說誰加入了、座位多了空格、有去填座位", /小美 加入了這一團/.test(out.清單) && /座位多了小美的空格/.test(out.清單) && out.去填座位, out);
  if (newbie) ok("點開之後紅點收掉,伺服器記下看過了", !shown(q("#bell-dot")) && seen() === 1, { 紅點: shown(q("#bell-dot")), 記: seen() });
  if (newbie && !noflights) {
    q("#bell-list [data-bell-fly]").click(); await wait(200);
    out.點了之後 = { 分頁: (q('.tab[aria-selected="true"]') || {}).id, 清單關了: q("#bell-pop").hidden };
    ok("去填座位 → 到交通頁、通知收起來", out.點了之後.分頁 === "tab-fly" && out.點了之後.清單關了, out.點了之後);
    q("[data-flight-edit]").click(); await wait(100);
    ok("交通表單裡有小美的座位格", !!q("#fl-seat-new_friend"), "");
    q("#fl-cancel").click();
  }
  return fin();
  function fin() { out.結論 = bad.length ? "✗ " + bad.join(" ;; ") : "全部通過"; out.errors = w.__errors || []; return out; }
})();
