/* LINE 登入就知道是誰,許願和 AI 那兩張表不再問「你是誰」(Lulu 的決定)。
 * 欄位看不到,但許出去的願望還是記在自己名下。 */
var q = s => d.querySelector(s), wait = ms => new Promise(r => w.setTimeout(r, ms));
var shown = e => !!e && !e.closest("[hidden]") && e.getBoundingClientRect().height > 0;
return (async function () {
  var out = {};
  q("#tab-wish").click(); await wait(100);
  q("#add-wish-btn").click(); await wait(120);
  out.許願表有你是誰 = shown(q("#wf-by"));
  q("#wf-title").value = "探針的願望";
  q("#wish-form").requestSubmit(); await wait(300);
  var mine = (w.__rows.wishes || []).filter(x => x.title === "探針的願望")[0];
  out.存下去的by = mine ? mine.by : "(沒存)";
  out.投票 = mine ? mine.votes : null;
  var k = q("#ai-kind");
  k.value = "wish"; k.dispatchEvent(new w.Event("change", { bubbles: true })); await wait(50);
  out.AI許願有你是誰 = shown(q("#ai-f-by")) || !q("#ai-f-by").hidden;
  out.結論 = !out.許願表有你是誰 && !out.AI許願有你是誰 && out.存下去的by === "hsieh_chinhui" ? "✓" : "✗";
  out.errors = w.__errors || [];
  return out;
})();
