begin;

create table public.player_profiles (
  user_id uuid primary key
    default auth.uid()
    references auth.users(id) on delete cascade,

  nickname text
    check (nickname is null or char_length(nickname) <= 40),
  age_range text
    check (age_range is null or char_length(age_range) <= 32),
  height_cm numeric(5,1)
    check (height_cm is null or height_cm between 100 and 250),
  weight_kg numeric(5,1)
    check (weight_kg is null or weight_kg between 20 and 250),
  position text
    check (position is null or char_length(position) <= 40),
  dominant_hand text
    check (dominant_hand is null or dominant_hand in ('left', 'right', 'both')),
  training_frequency smallint
    check (training_frequency is null or training_frequency between 0 and 14),
  current_goal text
    check (current_goal is null or char_length(current_goal) <= 300),

  shooting smallint check (shooting is null or shooting between 1 and 10),
  finishing smallint check (finishing is null or finishing between 1 and 10),
  ball_handling smallint check (ball_handling is null or ball_handling between 1 and 10),
  passing smallint check (passing is null or passing between 1 and 10),
  defense smallint check (defense is null or defense between 1 and 10),
  rebounding smallint check (rebounding is null or rebounding between 1 and 10),
  speed smallint check (speed is null or speed between 1 and 10),
  strength smallint check (strength is null or strength between 1 and 10),
  stamina smallint check (stamina is null or stamina between 1 and 10),

  playstyle_type text
    check (playstyle_type is null or char_length(playstyle_type) <= 64),
  playstyle_name text
    check (playstyle_name is null or char_length(playstyle_name) <= 80),
  playstyle_english_name text
    check (playstyle_english_name is null or char_length(playstyle_english_name) <= 80),
  strengths text[] not null default '{}'::text[],
  weaknesses text[] not null default '{}'::text[],
  preferred_role text
    check (preferred_role is null or char_length(preferred_role) <= 80),

  origin text not null default 'v2'
    check (origin in ('v2', 'guest_sync', 'legacy_app_record')),
  source_local_id uuid,
  legacy_app_record_id uuid
    references public.app_records(id) on delete set null,
  legacy_migration_version integer not null default 0
    check (legacy_migration_version >= 0),
  legacy_migrated_at timestamptz,
  schema_version integer not null default 1
    check (schema_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    (legacy_migration_version = 0 and legacy_migrated_at is null)
    or
    (legacy_migration_version > 0 and legacy_migrated_at is not null)
  )
);

create function public.set_player_profiles_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger player_profiles_set_updated_at
before update on public.player_profiles
for each row
execute function public.set_player_profiles_updated_at();

alter table public.player_profiles enable row level security;

revoke all on table public.player_profiles from public, anon, authenticated;
grant select, insert, update on table public.player_profiles to authenticated;

create policy "Users read their own player profile"
on public.player_profiles
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users create their own player profile"
on public.player_profiles
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Users update their own player profile"
on public.player_profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

commit;
