-- ============================================================
-- TAMBOV: полная установка базы данных (сайт + VK-бот)
-- ============================================================
-- Как применить: Supabase Dashboard -> SQL Editor -> New query ->
-- вставить ВЕСЬ этот файл -> Run.
--
-- Скрипт идемпотентный: можно запускать несколько раз без вреда.
-- Проект: https://icfihnroblyjjflsfepq.supabase.co
-- ============================================================

-- ============================================================
-- 1. ТАБЛИЦЫ САЙТА
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  created_at timestamptz default now(),
  mod_best_xp integer default 0,
  support_best_xp integer default 0,
  total_sessions integer default 0,
  email text,
  role text default 'player',
  xp integer default 0,
  pts integer default 0,
  total_xp integer default 0,
  total_pts integer default 0,
  mod_correct integer default 0,
  ap_correct integer default 0
);

create table if not exists public.user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mod_resolved integer default 0,
  mod_correct integer default 0,
  mod_mistakes integer default 0,
  sup_resolved integer default 0,
  sup_correct integer default 0,
  sup_mistakes integer default 0,
  shop_spent integer default 0,
  user_stat text,
  nickname text,
  report_xp numeric default 0,
  email text,
  ap_spent integer default 0,
  role text default 'player'
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc'::text, now()),
  user_email text,
  user_id uuid references auth.users(id) on delete set null,
  type text,
  content text
);

create table if not exists public.staff_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_code text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id text primary key default '',
  email text not null,
  link text,
  date text,
  status text,
  xp integer default 0,
  shop_items text,
  roulette_config text
);

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  user_email text,
  nickname text,
  item_name text,
  cost integer,
  type text,
  status text default 'Ожидает выдачи',
  created_at timestamptz default now()
);

-- ============================================================
-- 2. КАРЬЕРА МОДЕРАТОРОВ (сайт + бот)
-- ============================================================

create table if not exists public.moderator_careers (
  site_user_id text primary key,
  email text,
  nickname text,
  vk_user_id text,
  rank text not null default 'junior_moderator'
    check (rank in ('junior_moderator', 'moderator', 'senior_moderator', 'km', 'zgm', 'gm')),
  active boolean not null default true,
  appointed_at timestamptz not null default now(),
  rank_started_at timestamptz not null default now(),
  source text not null default 'site',
  source_sheet text,
  source_row integer,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists moderator_careers_vk_user_id_idx
  on public.moderator_careers (vk_user_id);

create table if not exists public.moderator_report_reviews (
  report_id text primary key,
  site_user_id text,
  email text,
  vk_user_id text,
  requested_status text,
  final_status text,
  xp integer not null default 0,
  verdict text not null default 'pending'
    check (verdict in ('pending', 'approved', 'rejected')),
  reason_code text,
  reason_text text,
  actor_vk_user_id text,
  actor_site_user_id text,
  source text,
  staff_peer_id text,
  staff_conversation_message_id bigint,
  staff_message_text text,
  staff_attachments text,
  notification_status text,
  notification_error text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists moderator_report_reviews_site_user_idx
  on public.moderator_report_reviews (site_user_id, created_at desc);

create table if not exists public.moderator_promotion_alerts (
  id text primary key,
  site_user_id text not null,
  vk_user_id text,
  from_rank text not null,
  to_rank text not null,
  eligibility_type text not null check (eligibility_type in ('regular', 'early')),
  days_on_rank integer not null default 0,
  approved_reports integer not null default 0,
  high_reports integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'promoted', 'postponed', 'cancelled')),
  staff_peer_id text,
  staff_conversation_message_id bigint,
  decided_by_vk_user_id text,
  decided_at timestamptz,
  remind_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists moderator_promotion_alerts_status_idx
  on public.moderator_promotion_alerts (status, created_at desc);

-- ============================================================
-- 3. ТАБЛИЦЫ VK-БОТА
-- ============================================================

create table if not exists public.vk_links (
  vk_user_id text primary key,
  site_user_id text not null,
  email text not null,
  nickname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vk_links_site_user_id_key
  on public.vk_links (site_user_id);

create table if not exists public.vk_link_codes (
  code text primary key,
  site_user_id text not null,
  email text not null,
  nickname text,
  status text not null default 'pending' check (status in ('pending', 'used', 'expired')),
  used_by_vk_user_id text,
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vk_link_codes_site_user_id_idx
  on public.vk_link_codes (site_user_id, created_at desc);

create index if not exists vk_link_codes_status_expires_idx
  on public.vk_link_codes (status, expires_at);

create table if not exists public.vk_report_sessions (
  session_key text primary key,
  vk_user_id text not null,
  peer_id text not null,
  step text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vk_report_sessions_updated_at_idx
  on public.vk_report_sessions (updated_at);

create table if not exists public.vk_group_bindings (
  peer_id text primary key,
  group_type text not null,
  title text,
  set_by_vk_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Актуальный check-констрейнт для типов бесед (пересоздаём при каждом запуске)
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.vk_group_bindings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%group_type%'
  loop
    execute format('alter table public.vk_group_bindings drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.vk_group_bindings
  add constraint vk_group_bindings_group_type_check
  check (group_type in ('reports', 'staff', 'candidates', 'general', 'ai', 'nomod', 'off'));

create index if not exists vk_group_bindings_type_idx
  on public.vk_group_bindings (group_type);

create table if not exists public.vk_staff_roles (
  vk_user_id text primary key,
  role text not null check (role in ('gm', 'zgm', 'curator', 'km', 'moderator')),
  title text,
  note text,
  granted_by_vk_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vk_moderation_actions (
  id text primary key,
  peer_id text,
  target_vk_user_id text not null,
  actor_vk_user_id text not null,
  action_type text not null check (action_type in (
    'oral_warn', 'warn', 'strict_warn', 'mute', 'ban',
    'private_room_block', 'global_block', 'reset'
  )),
  duration_text text,
  duration_minutes integer,
  reason text,
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired')),
  cancelled_by_vk_user_id text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists vk_moderation_actions_target_idx
  on public.vk_moderation_actions (target_vk_user_id, created_at desc);

create table if not exists public.vk_google_sheet_events (
  id bigint generated always as identity primary key,
  sheet_name text,
  row_number integer,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received',
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.vk_application_decisions (
  id text primary key,
  peer_id text,
  row_number integer not null,
  sheet_name text,
  actor_vk_user_id text not null,
  verdict text not null,
  reason text,
  previous_verdict text,
  spreadsheet_url text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.vk_ai_memory (
  vk_user_id text primary key,
  display_name text,
  memory jsonb not null default '{}'::jsonb,
  summary text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.vk_ai_messages (
  id bigint generated always as identity primary key,
  vk_user_id text not null,
  peer_id text,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists vk_ai_messages_user_idx
  on public.vk_ai_messages (vk_user_id, created_at desc);

create table if not exists public.vk_ai_image_generations (
  id bigint generated always as identity primary key,
  vk_user_id text not null,
  peer_id text,
  prompt text not null,
  image_url text,
  vk_attachment text,
  status text not null default 'created',
  error_message text,
  created_at timestamptz not null default now()
);

-- Кеш VK-attachment для фирменных карточек (v51)
create table if not exists public.vk_card_cache (
  card_key text primary key,
  attachment text not null,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 4. RLS-ПОЛИТИКИ
-- ============================================================
-- Авторизованные пользователи сайта (authenticated) — полный доступ
-- к таблицам сайта. Анонимы — ничего.
-- VK-бот работает через service_role и обходит RLS.

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles',
    'reports',
    'user_stats',
    'activity_log',
    'admin_logs',
    'staff_access',
    'moderator_careers',
    'moderator_report_reviews',
    'moderator_promotion_alerts',
    'vk_links',
    'vk_link_codes'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists site_select ON public.%I', t);
    execute format('drop policy if exists site_insert ON public.%I', t);
    execute format('drop policy if exists site_update ON public.%I', t);
    execute format('drop policy if exists site_delete ON public.%I', t);
    execute format(
      'create policy site_select on public.%I for select to authenticated using (true)', t);
    execute format(
      'create policy site_insert on public.%I for insert to authenticated with check (true)', t);
    execute format(
      'create policy site_update on public.%I for update to authenticated using (true) with check (true)', t);
    execute format(
      'create policy site_delete on public.%I for delete to authenticated using (true)', t);
  end loop;
end $$;

-- Таблицы только для бота: включаем RLS без политик
-- (service_role обходит RLS, а посторонним доступ закрыт)
do $$
declare
  t text;
begin
  foreach t in array array[
    'vk_report_sessions',
    'vk_group_bindings',
    'vk_staff_roles',
    'vk_moderation_actions',
    'vk_google_sheet_events',
    'vk_application_decisions',
    'vk_ai_memory',
    'vk_ai_messages',
    'vk_ai_image_generations',
    'vk_card_cache'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ============================================================
-- 5. STORAGE: бакет для доказательств отчётов
-- ============================================================

insert into storage.buckets (id, name, public)
values ('report-proofs', 'report-proofs', true)
on conflict (id) do nothing;

-- ============================================================
-- 6. ПРОВЕРКА: выведет все таблицы и политики
-- ============================================================

select tablename, policyname, cmd, roles::text
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
