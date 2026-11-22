/* 留言裡的網址自動變成連結（Lulu 11-22）：先跳脫，再把 http(s):// 開頭的那一段包成 <a>，一律底線＋primary（樣式在各元件的 css） */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export function linkifyHTML(text) {
  // 網址只吃 ASCII 的網址字元（後面緊貼中文、全形標點不會被包進去）；& 跳脫後是 &amp;
  return esc(text).replace(/https?:\/\/(?:[A-Za-z0-9\-._~:/?#[\]@!$'()*+,;=%]|&amp;)+/g, (u) => {
    const tail = (u.match(/[).,;:!?']+$/) || [""])[0];
    const url = tail ? u.slice(0, -tail.length) : u;
    return `<a href="${url}" target="_blank" rel="noopener">${url}</a>${tail}`;
  });
}
