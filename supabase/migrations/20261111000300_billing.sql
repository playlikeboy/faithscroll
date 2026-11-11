-- Faithscroll billing: server-side mirror of the RevenueCat "plus" entitlement.
--
-- * Written ONLY by the `revenuecat-webhook` Edge Function (service role) through the
--   `billing_*` functions below. Users can read their own row; they can never write it.
-- * One row per user (the app has a single entitlement, `plus`). The row is kept after expiry so
--   the app can say when Plus ended; `expires_at` decides whether it is active.
-- * Idempotent: every RevenueCat event id is recorded once (`private.revenuecat_events`), and an
--   older event can never overwrite state written by a newer one (`last_event_at`).
-- * AI functions gate features with `public.has_active_plus(user_id)` (service role).

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  entitlement text not null default 'plus' check (entitlement <> ''),
  product_id text,
  -- RevenueCat store id: APP_STORE, PLAY_STORE, PROMOTIONAL, ...
  store text,
  environment text check (environment is null or environment in ('SANDBOX', 'PRODUCTION')),
  period_type text,
  -- Null = non-expiring grant (e.g. lifetime/promotional). Active while null or in the future.
  expires_at timestamptz,
  last_event_id text,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is
  'Plus entitlement per user, mirrored from RevenueCat webhooks. Read: owner. Write: service role only.';

create index subscriptions_expires_idx on public.subscriptions (expires_at);

create trigger set_updated_at
  before update on public.subscriptions
  for each row execute function private.set_updated_at();

alter table public.subscriptions enable row level security;

revoke all on table public.subscriptions from anon, authenticated;
grant select on table public.subscriptions to authenticated;

create policy "Users can read their own subscription"
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

-- No insert/update/delete policies: only the service role (which bypasses RLS) writes.

-- ---------------------------------------------------------------------------
-- Processed webhook events (dedupe). Not exposed through the API.
-- ---------------------------------------------------------------------------

create table private.revenuecat_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

create index revenuecat_events_received_idx on private.revenuecat_events (received_at);

-- ---------------------------------------------------------------------------
-- Entitlement check used by AI Edge Functions
-- ---------------------------------------------------------------------------

create or replace function public.has_active_plus(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = p_user_id
      and s.entitlement = 'plus'
      and (s.expires_at is null or s.expires_at > now())
  );
$$;

-- ---------------------------------------------------------------------------
-- Webhook writers (service role only). Each runs in one transaction: the event id is recorded
-- only if the state change succeeds, so RevenueCat retries after a failure are processed again.
-- Returns 'applied', 'duplicate' or 'stale'.
-- ---------------------------------------------------------------------------

create or replace function public.billing_apply_event(
  p_event_id text,
  p_event_type text,
  p_event_at timestamptz,
  p_user_id uuid,
  p_product_id text,
  p_store text,
  p_environment text,
  p_period_type text,
  p_expires_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_event_id is null or p_event_id = '' or p_user_id is null or p_event_at is null then
    raise exception 'invalid billing event';
  end if;

  insert into private.revenuecat_events (event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict (event_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return 'duplicate';
  end if;

  -- The user may have deleted their account since the purchase: nothing to mirror.
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    return 'stale';
  end if;

  insert into public.subscriptions as s (
    user_id, entitlement, product_id, store, environment, period_type, expires_at, last_event_id, last_event_at
  )
  values (
    p_user_id, 'plus', p_product_id, p_store, p_environment, p_period_type, p_expires_at, p_event_id, p_event_at
  )
  on conflict (user_id) do update
    set product_id = coalesce(excluded.product_id, s.product_id),
        store = coalesce(excluded.store, s.store),
        environment = coalesce(excluded.environment, s.environment),
        period_type = coalesce(excluded.period_type, s.period_type),
        expires_at = excluded.expires_at,
        last_event_id = excluded.last_event_id,
        last_event_at = excluded.last_event_at
    where s.last_event_at is null or s.last_event_at <= excluded.last_event_at;
  get diagnostics v_rows = row_count;

  return case when v_rows = 0 then 'stale' else 'applied' end;
end;
$$;

-- TRANSFER: the purchase moved from `p_from` app users to `p_to` (e.g. restored on another
-- account). Moves the most recent state to the new owner and removes it from the old ones.
create or replace function public.billing_transfer(
  p_event_id text,
  p_event_at timestamptz,
  p_from uuid[],
  p_to uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
  v_source public.subscriptions%rowtype;
begin
  if p_event_id is null or p_event_id = '' or p_event_at is null then
    raise exception 'invalid billing transfer';
  end if;

  insert into private.revenuecat_events (event_id, event_type)
  values (p_event_id, 'TRANSFER')
  on conflict (event_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return 'duplicate';
  end if;

  select * into v_source
  from public.subscriptions s
  where s.user_id = any (coalesce(p_from, '{}'::uuid[]))
  order by s.last_event_at desc nulls last
  limit 1;

  delete from public.subscriptions s where s.user_id = any (coalesce(p_from, '{}'::uuid[]));

  if p_to is null or v_source.user_id is null or not exists (select 1 from auth.users u where u.id = p_to) then
    return 'stale';
  end if;

  insert into public.subscriptions as s (
    user_id, entitlement, product_id, store, environment, period_type, expires_at, last_event_id, last_event_at
  )
  values (
    p_to, v_source.entitlement, v_source.product_id, v_source.store, v_source.environment,
    v_source.period_type, v_source.expires_at, p_event_id, p_event_at
  )
  on conflict (user_id) do update
    set product_id = excluded.product_id,
        store = excluded.store,
        environment = excluded.environment,
        period_type = excluded.period_type,
        expires_at = excluded.expires_at,
        last_event_id = excluded.last_event_id,
        last_event_at = excluded.last_event_at
    where s.last_event_at is null or s.last_event_at <= excluded.last_event_at;

  return 'applied';
end;
$$;

-- Housekeeping for pg_cron: forget processed event ids after N days (RevenueCat retries for ~80 min).
create or replace function public.billing_purge_events(p_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  delete from private.revenuecat_events e where e.received_at < now() - make_interval(days => greatest(p_days, 1));
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.has_active_plus(uuid) from public, anon, authenticated;
revoke all on function public.billing_apply_event(text, text, timestamptz, uuid, text, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.billing_transfer(text, timestamptz, uuid[], uuid) from public, anon, authenticated;
revoke all on function public.billing_purge_events(integer) from public, anon, authenticated;

grant execute on function public.has_active_plus(uuid) to service_role;
grant execute on function public.billing_apply_event(text, text, timestamptz, uuid, text, text, text, text, timestamptz)
  to service_role;
grant execute on function public.billing_transfer(text, timestamptz, uuid[], uuid) to service_role;
grant execute on function public.billing_purge_events(integer) to service_role;
