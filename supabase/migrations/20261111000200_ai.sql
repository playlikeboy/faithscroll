-- Faithscroll AI: jobs, monthly usage counters, private sermon-audio bucket, retention.
--
-- * Only Edge Functions (service role) create or update jobs and usage; users may read and
--   delete their own job rows. No AI provider keys or prompts live in the database.
-- * `ai_jobs.sermon_id` has no foreign key: sermons can exist only on the device.
-- * Retention: `public.ai_purge_expired_jobs()` deletes finished jobs after N days and
--   `public.ai_expired_audio()` lists audio older than N days for the `ai-retention` function
--   (storage objects must be removed through the Storage API, not by deleting rows).
--   See docs/AI.md for the pg_cron schedule.

-- ---------------------------------------------------------------------------
-- ai_jobs
-- ---------------------------------------------------------------------------

create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_type text not null check (job_type in ('transcribe', 'recap', 'study', 'ask')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  sermon_id uuid,
  -- Request metadata needed to (re)run the job. Never prompts; transcripts/notes are not stored here.
  input jsonb not null default '{}'::jsonb,
  result jsonb,
  provider text,
  model text,
  error_code text,
  attempts integer not null default 0 check (attempts >= 0),
  -- Heartbeat of the worker currently processing the job; stale locks are re-claimed.
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  -- When the result/audio may be purged (set on completion).
  expires_at timestamptz
);

comment on table public.ai_jobs is 'AI work requested by a user (transcription, recap, study, ask). Written only by Edge Functions.';

create index ai_jobs_user_created_idx on public.ai_jobs (user_id, created_at desc);
create index ai_jobs_active_idx on public.ai_jobs (status, locked_at) where status in ('queued', 'processing');
create index ai_jobs_expires_idx on public.ai_jobs (expires_at) where expires_at is not null;

create trigger set_updated_at
  before update on public.ai_jobs
  for each row execute function private.set_updated_at();

alter table public.ai_jobs enable row level security;

revoke all on public.ai_jobs from anon, authenticated;
grant select, delete on public.ai_jobs to authenticated;

create policy "Users can read their own AI jobs"
  on public.ai_jobs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can delete their own AI jobs"
  on public.ai_jobs for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- ai_usage (per user, per calendar month UTC)
-- ---------------------------------------------------------------------------

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start date not null,
  transcribe_seconds integer not null default 0 check (transcribe_seconds >= 0),
  recap_count integer not null default 0 check (recap_count >= 0),
  study_count integer not null default 0 check (study_count >= 0),
  ask_count integer not null default 0 check (ask_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start)
);

comment on table public.ai_usage is 'Monthly AI usage counters used for quota enforcement. Written only by Edge Functions.';

create trigger set_updated_at
  before update on public.ai_usage
  for each row execute function private.set_updated_at();

alter table public.ai_usage enable row level security;

revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;

create policy "Users can read their own AI usage"
  on public.ai_usage for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Quota and job helpers (service role only)
-- ---------------------------------------------------------------------------

-- Atomically add `p_amount` to a usage counter if it stays within `p_limit`.
-- Returns true when the usage was recorded, false when it would exceed the limit.
create or replace function public.ai_consume_quota(
  p_user_id uuid,
  p_kind text,
  p_amount integer,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period date := date_trunc('month', timezone('utc', now()))::date;
  v_ok boolean;
begin
  if p_kind not in ('transcribe', 'recap', 'study', 'ask') or p_amount < 0 then
    raise exception 'invalid quota request';
  end if;

  insert into public.ai_usage (user_id, period_start)
  values (p_user_id, v_period)
  on conflict (user_id, period_start) do nothing;

  update public.ai_usage u
  set
    transcribe_seconds = u.transcribe_seconds + case when p_kind = 'transcribe' then p_amount else 0 end,
    recap_count = u.recap_count + case when p_kind = 'recap' then p_amount else 0 end,
    study_count = u.study_count + case when p_kind = 'study' then p_amount else 0 end,
    ask_count = u.ask_count + case when p_kind = 'ask' then p_amount else 0 end
  where u.user_id = p_user_id
    and u.period_start = v_period
    and (case p_kind
           when 'transcribe' then u.transcribe_seconds
           when 'recap' then u.recap_count
           when 'study' then u.study_count
           else u.ask_count
         end) + p_amount <= p_limit
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

-- Give back usage reserved for a job that failed (never below zero).
create or replace function public.ai_release_quota(
  p_user_id uuid,
  p_kind text,
  p_amount integer,
  p_period date
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage u
  set
    transcribe_seconds = greatest(0, u.transcribe_seconds - case when p_kind = 'transcribe' then p_amount else 0 end),
    recap_count = greatest(0, u.recap_count - case when p_kind = 'recap' then p_amount else 0 end),
    study_count = greatest(0, u.study_count - case when p_kind = 'study' then p_amount else 0 end),
    ask_count = greatest(0, u.ask_count - case when p_kind = 'ask' then p_amount else 0 end)
  where u.user_id = p_user_id and u.period_start = p_period;
$$;

-- Claim a job for processing: queued jobs, or processing jobs whose worker heartbeat is stale.
-- Increments `attempts`; returns the claimed row, or nothing when the job is not claimable.
create or replace function public.ai_claim_job(
  p_job_id uuid,
  p_stale_seconds integer,
  p_max_attempts integer
)
returns setof public.ai_jobs
language sql
security definer
set search_path = ''
as $$
  update public.ai_jobs j
  set
    status = 'processing',
    attempts = j.attempts + 1,
    locked_at = now(),
    started_at = coalesce(j.started_at, now())
  where j.id = p_job_id
    and j.attempts < p_max_attempts
    and (
      j.status = 'queued'
      or (j.status = 'processing' and (j.locked_at is null or j.locked_at < now() - make_interval(secs => p_stale_seconds)))
    )
  returning j.*;
$$;

revoke all on function public.ai_consume_quota(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.ai_release_quota(uuid, text, integer, date) from public, anon, authenticated;
revoke all on function public.ai_claim_job(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.ai_consume_quota(uuid, text, integer, integer) to service_role;
grant execute on function public.ai_release_quota(uuid, text, integer, date) to service_role;
grant execute on function public.ai_claim_job(uuid, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Private bucket for sermon audio: sermon-audio/<auth.uid()>/<sermonId>/<recordingId>.m4a
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sermon-audio',
  'sermon-audio',
  false,
  26214400, -- 25 MiB: the transcription provider's per-file upload limit
  array['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/wav', 'audio/webm']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Users can only touch objects inside their own top-level folder. Uploads (including TUS
-- resumable uploads with x-upsert) need insert + select + update.
create policy "Users can read their own sermon audio"
  on storage.objects for select to authenticated
  using (bucket_id = 'sermon-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload their own sermon audio"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'sermon-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can replace their own sermon audio"
  on storage.objects for update to authenticated
  using (bucket_id = 'sermon-audio' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'sermon-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own sermon audio"
  on storage.objects for delete to authenticated
  using (bucket_id = 'sermon-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Retention (cron-ready; scheduled from docs/AI.md)
-- ---------------------------------------------------------------------------

-- Delete finished jobs (and their stored results) older than p_days, plus abandoned jobs.
create or replace function public.ai_purge_expired_jobs(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.ai_jobs j
  where (j.status in ('completed', 'failed') and coalesce(j.completed_at, j.updated_at) < now() - make_interval(days => p_days))
     or (j.expires_at is not null and j.expires_at < now())
     or (j.status in ('queued', 'processing') and j.updated_at < now() - interval '2 days');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Object paths in sermon-audio older than p_days (the ai-retention function deletes them
-- through the Storage API so the underlying files are removed too).
create or replace function public.ai_expired_audio(p_days integer default 30, p_limit integer default 500)
returns table (name text)
language sql
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'sermon-audio'
    and o.created_at < now() - make_interval(days => p_days)
  order by o.created_at
  limit p_limit;
$$;

revoke all on function public.ai_purge_expired_jobs(integer) from public, anon, authenticated;
revoke all on function public.ai_expired_audio(integer, integer) from public, anon, authenticated;
grant execute on function public.ai_purge_expired_jobs(integer) to service_role;
grant execute on function public.ai_expired_audio(integer, integer) to service_role;
