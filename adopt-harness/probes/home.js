/* 第 2 期的入口卡:登入、開團、加入、離線。PAGE= 帶 fake= 切角色。 */
var q = s => d.querySelector(s), qa = s => Array.prototype.slice.call(d.querySelectorAll(s));
var txt = s => (q(s) && q(s).textContent || "").replace(/\s+/g, " ").trim();
return {
  url: w.location.search,
  errors: w.__errors || [],
  homeOpen: !q("#home-overlay").hidden,
  title: txt("#home-title"),
  card: txt("#home-card").slice(0, 160),
  buttons: qa("#home-card .btn").map(b => b.textContent.trim()),
  fields: qa("#home-card input, #home-card select").map(i => i.id + "=" + i.value),
  cloud: txt("#cloud-msg"),
  countdown: txt("#countdown"),
  h1: txt("#trip-name"),
  canEdit: d.body.classList.contains("can-edit"),
  stops: qa(".stop").length,
  calls: (w.__calls || []).map(c => c.method + " " + c.url.replace(/^.*\/api\//, "")),
};
