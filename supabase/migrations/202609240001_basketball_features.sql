create table if not exists public.app_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('profile', 'game', 'pose', 'training_adjustment')),
  title text not null check (char_length(title) between 1 and 120),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.shot_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  x double precision not null check (x between 0 and 1),
  y double precision not null check (y between 0 and 1),
  made boolean not null,
  zone text not null check (char_length(zone) between 1 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.training_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_title text not null check (char_length(session_title) between 1 and 80),
  duration_minutes integer not null check (duration_minutes between 5 and 300),
  effort integer not null check (effort between 1 and 5),
  note text not null default '' check (char_length(note) <= 300),
  completed_on date not null default (timezone('Asia/Shanghai', now())::date),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  request_count integer not null default 0 check (request_count between 0 and 30),
  primary key (user_id, usage_day)
);

-- A project-wide ceiling also bounds cost when unverified phone numbers are used
-- to create multiple accounts. Raise this only after reviewing actual usage.
create table if not exists public.ai_site_daily_usage (
  usage_day date primary key,
  request_count integer not null default 0 check (request_count between 0 and 300)
);

create index if not exists app_records_user_created_idx on public.app_records (user_id, created_at desc);
create index if not exists shot_attempts_user_created_idx on public.shot_attempts (user_id, created_at desc);
create index if not exists training_logs_user_day_idx on public.training_logs (user_id, completed_on desc);

alter table public.app_records enable row level security;
alter table public.shot_attempts enable row level security;
alter table public.training_logs enable row level security;
alter table public.ai_daily_usage enable row level security;
alter table public.ai_site_daily_usage enable row level security;

drop policy if exists "Users manage their own reports" on public.app_records;
create policy "Users manage their own reports" on public.app_records
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Users manage their own shots" on public.shot_attempts;
create policy "Users manage their own shots" on public.shot_attempts
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Users manage their own training logs" on public.training_logs;
create policy "Users manage their own training logs" on public.training_logs
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.ai_daily_usage from anon, authenticated;
revoke all on public.ai_site_daily_usage from anon, authenticated;
grant select, insert, update, delete on public.app_records, public.shot_attempts, public.training_logs to authenticated;

create or replace function public.consume_ai_credit()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Shanghai', now()))::date;
  v_count integer;
  v_site_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- Serialize quota checks so both limits are consumed together, even with
  -- simultaneous requests from several accounts.
  perform pg_catalog.pg_advisory_xact_lock(20260924001);
  select request_count into v_count from public.ai_daily_usage
  where user_id = v_user_id and usage_day = v_today;
  select request_count into v_site_count from public.ai_site_daily_usage
  where usage_day = v_today;
  v_count := coalesce(v_count, 0);
  v_site_count := coalesce(v_site_count, 0);

  if v_count >= 30 then
    return jsonb_build_object('allowed', false, 'reason', 'account', 'remaining', 0, 'resets_at', ((v_today + 1)::timestamp at time zone 'Asia/Shanghai'));
  end if;
  if v_site_count >= 300 then
    return jsonb_build_object('allowed', false, 'reason', 'site', 'remaining', 30 - v_count, 'resets_at', ((v_today + 1)::timestamp at time zone 'Asia/Shanghai'));
  end if;

  insert into public.ai_daily_usage as usage (user_id, usage_day, request_count)
  values (v_user_id, v_today, 1)
  on conflict (user_id, usage_day) do update
    set request_count = usage.request_count + 1;
  insert into public.ai_site_daily_usage as usage (usage_day, request_count)
  values (v_today, 1)
  on conflict (usage_day) do update
    set request_count = usage.request_count + 1;

  return jsonb_build_object('allowed', true, 'remaining', 29 - v_count, 'resets_at', ((v_today + 1)::timestamp at time zone 'Asia/Shanghai'));
end;
$$;

create or replace function public.get_ai_usage()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Shanghai', now()))::date;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select usage.request_count into v_count
  from public.ai_daily_usage as usage
  where usage.user_id = v_user_id and usage.usage_day = v_today;

  return jsonb_build_object('used', coalesce(v_count, 0), 'remaining', greatest(0, 30 - coalesce(v_count, 0)), 'resets_at', ((v_today + 1)::timestamp at time zone 'Asia/Shanghai'));
end;
$$;

revoke all on function public.consume_ai_credit() from public, anon;
revoke all on function public.get_ai_usage() from public, anon;
grant execute on function public.consume_ai_credit() to authenticated;
grant execute on function public.get_ai_usage() to authenticated;
