-- 東京五人行 · Supabase 初始設定
-- 用法:Supabase 專案 → 左側 SQL Editor → New query → 整份貼上 → Run
-- 只需要跑一次。重複跑也安全(用了 if not exists / drop policy if exists)。

-- ============ 1. 資料表 ============

create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  trip         text        not null default 'tokyo-2026',
  date         date        not null,
  title        text        not null,
  category     text        not null default 'other',
  amount       numeric     not null default 0,
  currency     text        not null default 'JPY',
  payer_id     text,
  participants text[]      not null default '{}',
  note         text,
  created_at   timestamptz not null default now()
);

create table if not exists public.stops (
  id         uuid primary key default gen_random_uuid(),
  trip       text        not null default 'tokyo-2026',
  day        date        not null,
  time       text,
  title      text        not null,
  place      text,
  note       text,
  created_at timestamptz not null default now()
);

-- 匯率、暱稱這類單筆設定
create table if not exists public.settings (
  key        text primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);

create index if not exists expenses_trip_date_idx on public.expenses (trip, date);
create index if not exists stops_trip_day_idx     on public.stops (trip, day);

-- ============ 2. 權限:登入過的人才讀得到、寫得進去 ============

alter table public.expenses enable row level security;
alter table public.stops    enable row level security;
alter table public.settings enable row level security;

drop policy if exists "trip members full access" on public.expenses;
create policy "trip members full access" on public.expenses
  for all to authenticated using (true) with check (true);

drop policy if exists "trip members full access" on public.stops;
create policy "trip members full access" on public.stops
  for all to authenticated using (true) with check (true);

drop policy if exists "trip members full access" on public.settings;
create policy "trip members full access" on public.settings
  for all to authenticated using (true) with check (true);

-- 沒登入的人(anon)完全讀不到 —— 上面沒有給 anon 任何 policy,RLS 就會全擋。

-- ============ 3. 即時同步 ============

alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.stops;
alter publication supabase_realtime add table public.settings;

-- ============ 4. 初始資料:機票那筆 ============

insert into public.settings (key, value) values ('rate', '0.21'::jsonb)
  on conflict (key) do nothing;
insert into public.settings (key, value) values ('names', '{}'::jsonb)
  on conflict (key) do nothing;

insert into public.expenses (id, trip, date, title, category, amount, currency, payer_id, participants, note, created_at)
values (
  '00000000-0000-4000-8000-000000000001',
  'tokyo-2026',
  '2026-09-15',
  '樂桃來回機票 MM626／MM631',
  'transport',
  61100,
  'TWD',
  'hsieh_chinhui',
  array['hsieh_chinhui','chang_chiayu','chang_chihwei','chang_yalun','chen_suchih'],
  '訂單 PTETF3 · 含稅與附加費、不含保險 · 含託運行李 1 件/人',
  '2026-09-15T23:09:00+08:00'
) on conflict (id) do nothing;
