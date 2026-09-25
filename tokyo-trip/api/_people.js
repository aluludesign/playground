// Trippps · 「人」那張表
//
// 一列 = 一個用 LINE 登入過的人,跟他參加哪幾團無關。做兩件事:
//   1. 記下他的名字和頭像(邀請卡上的「xxx 邀請你」要用)
//   2. **試用名額的上限** —— 滿了就不讓新的人進來
//
// 為什麼上限擋在登入,不是擋在加入某一團:Lulu 要限的是「有多少人在用這個東西」,
// 而一個人可以開好幾團。擋在加入的話,三十個人各開五團一樣是三十個人,
// 但擋的位置會變成「你不能再開團了」—— 那不是她要說的那句話。

const NOTION = "https://api.notion.com/v1";
const VERSION = "2022-06-28";
const CALL_MS = 8000;

/* 預設 30。改這裡之前先想清楚:這個數字是**她答應過的事**,不是效能參數。 */
const LIMIT = Number(process.env.TRIP_MAX_PEOPLE || 30);
const DB = process.env.NOTION_DB_PEOPLE || "c38c62febb87434ca29e264cd9fd24b5";

async function notion(path, init) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), CALL_MS);
  try {
    const res = await fetch(NOTION + path, {
      ...init,
      signal: ctl.signal,
      headers: {
        Authorization: "Bearer " + process.env.NOTION_TOKEN,
        "Notion-Version": VERSION,
        "Content-Type": "application/json",
        ...(init && init.headers),
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.message || "Notion 回應 " + res.status);
      err.status = res.status;
      throw err;
    }
    return body;
  } finally { clearTimeout(t); }
}

const rt = v => (v ? [{ type: "text", text: { content: String(v).slice(0, 300) } }] : []);

/* 這個人來了。回 { ok: true } 放行,或 { ok: false, why: "full" } 擋下來。
 *
 * **Notion 出事的時候放行,不是擋下來。** 這張表的用途是記帳和數人頭,
 * 不是安全邊界 —— 真正的安全邊界是簽章過的 cookie 和「成員」那張表。
 * 讓所有人因為一張輔助表讀不到而登不進來,是把一個小故障放大成停機。
 */
async function seeUser(user) {
  if (!process.env.NOTION_TOKEN) return { ok: true, skipped: "沒有 NOTION_TOKEN" };
  try {
    const found = await notion("/databases/" + DB + "/query", {
      method: "POST",
      body: JSON.stringify({ page_size: 1,
        filter: { property: "LINE ID", title: { equals: user.sub } } }),
    });

    if (found.results.length) {
      /* 來過了 —— 名字和頭像可能換了,更新一下。**不佔新的名額。** */
      await notion("/pages/" + found.results[0].id, {
        method: "PATCH",
        body: JSON.stringify({ properties: {
          "名字": { rich_text: rt(user.name) },
          "頭像": { url: user.pic || null },
        } }),
      });
      return { ok: true, returning: true };
    }

    /* 新的人。**先數再寫** —— 反過來的話第三十一個人會先進去再被發現。
       只數到上限就好,不用把整張表撈回來。 */
    const page = await notion("/databases/" + DB + "/query", {
      method: "POST",
      body: JSON.stringify({ page_size: Math.min(100, LIMIT) }),
    });
    const n = page.results.length;
    if (n >= LIMIT) return { ok: false, why: "full", n };

    await notion("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: DB },
        properties: {
          "LINE ID": { title: rt(user.sub) },
          "名字": { rich_text: rt(user.name) },
          "頭像": { url: user.pic || null },
          "第一次登入": { date: { start: new Date().toISOString().slice(0, 10) } },
        },
      }),
    });
    return { ok: true, fresh: true, n: n + 1 };
  } catch (e) {
    return { ok: true, skipped: e.message };
  }
}

module.exports = { seeUser, LIMIT };
