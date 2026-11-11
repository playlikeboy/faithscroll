-- Server mirrors of the app's syncable SQLite tables (src/db/schema.ts), used for Faithscroll Plus
-- cloud backup & sync. Column names match the local snake_case columns.
--
-- Every mirror carries:
--   user_id            owner (defaults to the caller, cascades on account deletion)
--   created_at/updated_at/deleted_at/version   copied from the device (deleted_at = tombstone)
--   server_updated_at  set by trigger on every write; the pull cursor
--
-- Notes
-- * Device-local columns are NOT mirrored: `reminder_notification_id` (a notification id that only
--   means something on one device) and `sermon_recordings.local_file_name` (a file on one device).
-- * Referential integrity between user rows is enforced on the device; the server is a per-user
--   replica, so rows may arrive in any order. Ownership is enforced by RLS.
-- * Polymorphic references (entity_id, source_id, from_id, to_id) are text because they can point
--   at different tables (or, for action items, at Bible verses).

-- ---------------------------------------------------------------------------
-- Bible annotations
-- ---------------------------------------------------------------------------

create table public.highlights (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  verse_id integer not null,
  color text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now()
);

create table public.saved_verses (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_verse_id integer not null,
  end_verse_id integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now()
);

create table public.verse_notes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_verse_id integer not null,
  end_verse_id integer not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now()
);

create table public.collections (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now()
);

create table public.collection_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection_id uuid not null,
  entity_type text not null,
  entity_id text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sermons
-- ---------------------------------------------------------------------------

create table public.sermon_series (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text,
  speaker text,
  church text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now()
);

create table public.sermons (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  speaker text,
  church text,
  series_id uuid,
  sermon_date date,
  main_passage text,
  main_passage_start_verse_id integer,
  main_passage_end_verse_id integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig,
      coalesce(speaker, '') || ' ' || coalesce(church, '') || ' ' || coalesce(main_passage, '')), 'B')
  ) stored
);

create table public.sermon_recordings (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sermon_id uuid not null,
  title text,
  mime_type text not null default 'audio/mp4',
  duration_ms bigint not null default 0,
  size_bytes bigint,
  status text not null default 'recording',
  cloud_status text not null default 'local',
  cloud_path text,
  started_at text,
  ended_at text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now()
);

create table public.sermon_bookmarks (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sermon_id uuid not null,
  recording_id uuid,
  position_ms bigint not null,
  note text,
  reference text,
  start_verse_id integer,
  end_verse_id integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now()
);

create table public.sermon_notes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sermon_id uuid not null,
  content text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (to_tsvector('simple'::regconfig, coalesce(content, ''))) stored
);

create table public.transcripts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sermon_id uuid not null,
  recording_id uuid,
  remote_job_id text,
  language text,
  status text not null default 'pending',
  text text,
  error_code text,
  edited_at text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now()
);

create table public.sermon_recaps (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sermon_id uuid not null,
  transcript_id uuid,
  remote_job_id text,
  status text not null default 'pending',
  -- Stored as text (not jsonb) so the device's JSON round-trips byte-for-byte.
  content_json text,
  provider text,
  model text,
  error_code text,
  generated_at text,
  edited_at text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now()
);

create table public.scripture_references (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_type text not null,
  source_id text not null,
  start_verse_id integer not null,
  end_verse_id integer not null,
  reference_text text not null,
  position_ms bigint,
  origin text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Journal, prayer, actions, links, tags, plans
-- ---------------------------------------------------------------------------

create table public.journal_entries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  content text not null default '',
  entry_type text not null default 'personal',
  prompt text,
  entry_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(content, '')), 'B')
  ) stored
);

create table public.prayer_entries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  content text not null default '',
  category text,
  status text not null default 'praying',
  reminder_at text,
  answered_at text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(content, '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(category, '')), 'C')
  ) stored
);

create table public.prayer_updates (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prayer_id uuid not null,
  content text not null,
  status_change text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now()
);

create table public.action_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  notes text,
  source_type text not null default 'manual',
  source_id text,
  due_at text,
  reminder_at text,
  completed_at text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now()
);

create table public.entity_links (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_type text not null,
  from_id text not null,
  to_type text not null,
  to_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now()
);

-- Locally entity_tags has a composite key and is hard-deleted; the mirror keeps a surrogate id (for
-- the pull cursor) plus a tombstone, and is upserted on its natural key.
create table public.entity_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now(),
  constraint entity_tags_natural_key unique (user_id, entity_type, entity_id, tag_id)
);

create table public.plan_progress (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id text not null,
  status text not null default 'active',
  started_at text not null,
  paused_at text,
  completed_at text,
  reminder_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  server_updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS, privileges, cursor indexes and triggers for every mirror
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  mirrors text[] := array[
    'highlights', 'saved_verses', 'verse_notes', 'collections', 'collection_items',
    'sermon_series', 'sermons', 'sermon_recordings', 'sermon_bookmarks', 'sermon_notes',
    'transcripts', 'sermon_recaps', 'scripture_references', 'journal_entries',
    'prayer_entries', 'prayer_updates', 'action_items', 'entity_links', 'tags',
    'entity_tags', 'plan_progress'
  ];
begin
  foreach t in array mirrors loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);

    execute format(
      'create policy "Owners can read their rows" on public.%I for select to authenticated '
      'using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "Owners can insert their rows" on public.%I for insert to authenticated '
      'with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "Owners can update their rows" on public.%I for update to authenticated '
      'using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "Owners can delete their rows" on public.%I for delete to authenticated '
      'using ((select auth.uid()) = user_id)', t);

    execute format('create index %I on public.%I (user_id, server_updated_at, id)', t || '_pull_cursor_idx', t);

    if t = 'entity_tags' then
      execute format(
        'create trigger sync_touch before insert or update on public.%I '
        'for each row execute function private.sync_touch()', t);
    else
      execute format(
        'create trigger sync_before_write before insert or update on public.%I '
        'for each row execute function private.sync_before_write()', t);
    end if;
  end loop;
end;
$$;

-- Full-text search (Plus "advanced search" across devices). 'simple' config: language-neutral.
create index journal_entries_search_idx on public.journal_entries using gin (search_vector);
create index prayer_entries_search_idx on public.prayer_entries using gin (search_vector);
create index sermons_search_idx on public.sermons using gin (search_vector);
create index sermon_notes_search_idx on public.sermon_notes using gin (search_vector);
