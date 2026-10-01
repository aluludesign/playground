/* 通知的小鈴鐺(2026-09-29,Lulu):AI 和漢堡選單中間。團主和副團主(2026-10-02 起)才有,看到的一樣。
 * PAGE='/index.html?newbie=1'             團主上次看過之後,小美加入了 → 紅點;點開有「去填座位」
 * PAGE='/index.html?newbie=1&noflights=1'  還沒有交通 → 只說誰加入了
 * PAGE='/index.html?newbie=1&fake=member'  一般成員 → 沒有鈴鐺
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
  if (member) { ok("一般成員沒有鈴鐺", !out.鈴鐺, out); return fin(); }
  var rb = bell.getBoundingClientRect(), ra = ai.getBoundingClientRect(), rm = menu.getBoundingClientRect();
  out.位置 = { AI右: Math.round(ra.right), 鈴左: Math.round(rb.left), 鈴右: Math.round(rb.right), 選單左: Math.round(rm.left) };
  ok("鈴鐺在 AI 和漢堡選單中間,不重疊", out.鈴鐺 && ra.right <= rb.left && rb.right <= rm.left, out.位置);
  ok(newbie ? "有新成員 → 紅點" : "沒有新成員 → 沒有紅點", out.紅點 === newbie, out.紅點);
  bell.click(); await wait(200);
  out.清單 = txt("#bell-list"); out.去填座位 = !!q("#bell-list [data-bell-fly]");
  if (!newbie) ok("點開:目前沒有新通知", /目前沒有新通知/.test(out.清單) && seen() === 0, out);
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
