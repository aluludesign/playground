// 東京五人行 · 雲端連線設定
//
// 填法:Supabase 專案 → Settings → API
//   supabaseUrl     = Project URL          (長得像 https://xxxxxxxx.supabase.co)
//   supabaseAnonKey = Project API keys 的 anon / public key
//
// anon key 本來就是設計成放在前端的,公開沒關係 —— 真正的門鎖是資料表的
// RLS 政策(見 supabase-setup.sql):沒登入就什麼都讀不到。
// 帳號密碼不要寫進這個檔案。
//
// 兩個都留空的話,網站會退回離線模式(紀錄只存在自己的瀏覽器)。

window.TRIP_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  trip: "tokyo-2026",
};
