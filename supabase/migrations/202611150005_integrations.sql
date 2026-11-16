begin;

-- Provision dedicated Supabase Auth users; NEVER give them city_memberships.
create table public.city_integrations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  city_id text not null references public.cities(id),
  source text not null check (length(trim(source)) between 1 and 160),
  can_write boolean not null default false,
  can_publish boolean not null default false,
  enabled boolean not null default true,
  requests_per_minute integer not null default 120 check (requests_per_minute between 1 and 600),
  window_start timestamptz not null default now(),
  requests integer not null default 0,
  unique (city_id, source),
  check (not can_publish or can_write)
);
alter table public.city_integrations enable row level security;
revoke all on public.city_integrations from anon, authenticated;
grant select (user_id, city_id, source, can_write, can_publish, enabled) on public.city_integrations to authenticated;
create policy integrations_own on public.city_integrations for select to authenticated
  using (user_id = (select auth.uid()));

-- Machine accounts cannot inherit editor rights even if accidentally assigned a membership.
create or replace function public.can_edit_city(target_city text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.city_integrations where user_id = (select auth.uid()))
    and exists (select 1 from public.city_memberships
      where city_id = target_city and user_id = (select auth.uid()) and role in ('owner', 'editor'));
$$;

create function public.integration_access(target_city text, target_source text, writing boolean, publishing boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.city_integrations
    where user_id = (select auth.uid()) and enabled and city_id = target_city and source = target_source
      and (not writing or can_write) and (not publishing or can_publish));
$$;
revoke all on function public.integration_access(text, text, boolean, boolean) from public;
grant execute on function public.integration_access(text, text, boolean, boolean) to authenticated;

-- Restrictive scope still applies when another permissive policy allows a published row.
create policy integration_event_scope on public.city_events as restrictive for all to authenticated
  using (not exists (select 1 from public.city_integrations where user_id = (select auth.uid()))
    or public.integration_access(city_id, source, false, false))
  with check (not exists (select 1 from public.city_integrations where user_id = (select auth.uid()))
    or public.integration_access(city_id, source, true, publication = 'published'));
create policy integration_events_read on public.city_events for select to authenticated
  using (public.integration_access(city_id, source, false, false));
create policy integration_events_create on public.city_events for insert to authenticated
  with check (public.integration_access(city_id, source, true, publication = 'published'));
create policy integration_events_update on public.city_events for update to authenticated
  using (public.integration_access(city_id, source, true, publication = 'published'))
  with check (public.integration_access(city_id, source, true, publication = 'published'));
-- No machine DELETE policy: cancellations and unpublishing preserve stable links.

create function public.consume_culture_api_request() returns boolean
language plpgsql security definer set search_path = '' as $$
declare allowed boolean;
begin
  update public.city_integrations
  set requests = case when window_start <= now() - interval '1 minute' then 1 else requests + 1 end,
    window_start = case when window_start <= now() - interval '1 minute' then now() else window_start end
  where user_id = (select auth.uid()) and enabled
    and (window_start <= now() - interval '1 minute' or requests < requests_per_minute)
  returning true into allowed;
  return coalesce(allowed, false);
end;
$$;
revoke all on function public.consume_culture_api_request() from public;
grant execute on function public.consume_culture_api_request() to authenticated;

-- ETags remain distinct even for concurrent updates inside the same transaction.
create function public.advance_city_event_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
create trigger zz_advance_city_event_version before update on public.city_events
  for each row execute function public.advance_city_event_version();
commit;