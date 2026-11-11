-- Faithscroll core schema: profiles, user preferences and shared helper functions.
--
-- Principles
-- * Private by default: every table has RLS enabled and only `authenticated` users can reach
--   their own rows. `anon` has no privileges on any table.
-- * Helper functions live in the non-exposed `private` schema with an empty search_path.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helper trigger functions
-- ---------------------------------------------------------------------------

-- Keeps `updated_at` current for server-owned tables (profiles, user_preferences).
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Sync mirrors (versioned rows). Runs BEFORE INSERT OR UPDATE.
-- * `server_updated_at` is always set by the server (clients cannot fake pull cursors).
--   clock_timestamp() (not now()) so rows written by one statement get distinct values.
-- * Optimistic concurrency: an UPDATE must carry a strictly higher `version` than the stored row.
--   Stale writes are skipped (the trigger returns NULL), so they are absent from the upsert's
--   returned rows; the client then fetches the newer server row and runs its conflict rules.
-- * A tombstone request for a row the device no longer has (no version known) is accepted and
--   bumps the version itself.
-- * `user_id` can never change.
create or replace function private.sync_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id cannot be changed' using errcode = '42501';
    end if;
    if new.version <= old.version then
      if new.version = old.version and new.deleted_at is not null and old.deleted_at is null then
        new.version := old.version + 1;
      else
        return null;
      end if;
    end if;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- Sync mirrors without versions (set-like tables such as entity_tags): last write wins.
create or replace function private.sync_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot be changed' using errcode = '42501';
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 200),
  avatar_url text check (char_length(avatar_url) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public-facing profile of an auth user. Visible only to its owner.';

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create trigger set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_preferences: one row per auth user (mirrors the app's persisted preferences)
-- ---------------------------------------------------------------------------

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme_preference text not null default 'system',
  scripture_size_index smallint not null default 2,
  translation_id text not null default 'WEB',
  reading_goal text,
  daily_reminder_time text,
  daily_reminder_enabled boolean not null default false,
  recording_consent_at timestamptz,
  ai_processing_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_preferences is 'Per-user app preferences. Owner-only.';

alter table public.user_preferences enable row level security;
revoke all on table public.user_preferences from anon;

create policy "Users can read their own preferences"
  on public.user_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own preferences"
  on public.user_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own preferences"
  on public.user_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create trigger set_updated_at
  before update on public.user_preferences
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- New-user bootstrap
-- ---------------------------------------------------------------------------

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 200), ''),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'avatar_url', ''), 2000), '')
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Apple only shares the user's name on the first sign-in; the app saves it with
-- auth.updateUser({ data: { full_name } }). Copy it into an empty profile name.
create or replace function private.handle_user_metadata_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set display_name = nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200), '')
  where id = new.id
    and display_name is null;
  return new;
end;
$$;

create trigger on_auth_user_metadata_updated
  after update of raw_user_meta_data on auth.users
  for each row
  when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
  execute function private.handle_user_metadata_update();
