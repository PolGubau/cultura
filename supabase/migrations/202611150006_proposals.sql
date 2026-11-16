begin;

create table public.city_event_proposals (
  id uuid primary key default gen_random_uuid(),
  city_id text not null references public.cities(id),
  title text not null check (length(trim(title)) between 1 and 160),
  summary text not null check (length(trim(summary)) between 1 and 500),
  description text not null default '' check (length(description) <= 5000),
  place_name text not null check (length(trim(place_name)) between 1 and 160),
  organizer text not null default '' check (length(organizer) <= 160),
  booking_url text check (booking_url is null or (length(booking_url) <= 2048 and booking_url ~ '^https://')),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  event_id uuid references public.city_events(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  check ((status = 'accepted') = (event_id is not null)),
  check ((status = 'pending') = (reviewed_at is null))
);
create index city_proposals_queue on public.city_event_proposals (city_id, status, created_at, id);
alter table public.city_event_proposals enable row level security;
revoke all on public.city_event_proposals from public, anon, authenticated;
grant select on public.city_event_proposals to authenticated;
create policy proposals_editors_read on public.city_event_proposals for select to authenticated
  using (public.can_edit_city(city_id));

-- Only the server's service role can call this. No client can choose its rate key.
create table public.city_proposal_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  requests integer not null default 0
);
create index city_proposal_limits_expiry on public.city_proposal_limits (window_start);
alter table public.city_proposal_limits enable row level security;
revoke all on public.city_proposal_limits from public, anon, authenticated;

create function public.submit_city_proposal(p_city text, p_key text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_key !~ '^[0-9a-f]{64}$' then raise exception 'Invalid rate key'; end if;
  insert into public.city_proposal_limits as limits (key, window_start, requests)
    values (p_key, now(), 1)
    on conflict (key) do update set
      window_start = case when limits.window_start <= now() - interval '1 hour' then now() else limits.window_start end,
      requests = case when limits.window_start <= now() - interval '1 hour' then 1 else limits.requests + 1 end
    returning requests into n;
  if n > 5 then return false; end if;
  insert into public.city_proposal_limits as limits (key, window_start, requests)
    values ('global:' || p_city, now(), 1)
    on conflict (key) do update set
      window_start = case when limits.window_start <= now() - interval '1 hour' then now() else limits.window_start end,
      requests = case when limits.window_start <= now() - interval '1 hour' then 1 else limits.requests + 1 end
    returning requests into n;
  if n > 100 then return false; end if;
  insert into public.city_event_proposals (city_id, title, summary, description, place_name, organizer, booking_url, starts_at, ends_at)
    values (p_city, p_data->>'title', p_data->>'summary', p_data->>'description', p_data->>'place_name',
      p_data->>'organizer', p_data->>'booking_url', (p_data->>'starts_at')::timestamptz, (p_data->>'ends_at')::timestamptz);
  -- Amortized cleanup of expired pseudonymous rate-limit entries.
  if random() < 0.01 then
    delete from public.city_proposal_limits where key in (
      select key from public.city_proposal_limits where window_start < now() - interval '2 hours'
      limit 100 for update skip locked
    );
  end if;
  return true;
end;
$$;
revoke all on function public.submit_city_proposal(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_city_proposal(text, text, jsonb) to service_role;

-- Lock and resolve the proposal in the same transaction as the event insert.
create function public.review_city_proposal(p_id uuid, p_city text, p_accept boolean, p_event jsonb default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare proposal public.city_event_proposals; event_data public.city_events; new_event_id uuid;
begin
  if not public.can_edit_city(p_city) then raise exception 'Permission denied'; end if;
  select * into proposal from public.city_event_proposals where id = p_id and city_id = p_city and status = 'pending' for update;
  if not found then raise exception 'Proposal not pending'; end if;
  if p_accept then
    if p_event is null or jsonb_typeof(p_event) <> 'object' then raise exception 'Event required'; end if;
    event_data := jsonb_populate_record(null::public.city_events, p_event);
    insert into public.city_events (city_id, festival_id, place_id, category_id, translations, starts_at, ends_at,
      format, route, image_url, booking_url, price, accessibility, schedule_notes, organizer, publication, status, cancellation_reason)
    values (p_city, event_data.festival_id, event_data.place_id, event_data.category_id, event_data.translations,
      event_data.starts_at, event_data.ends_at, event_data.format, event_data.route, event_data.image_url,
      event_data.booking_url, event_data.price, event_data.accessibility, event_data.schedule_notes, event_data.organizer,
      'published', event_data.status, event_data.cancellation_reason)
    returning id into new_event_id;
  end if;
  update public.city_event_proposals set status = case when p_accept then 'accepted' else 'rejected' end,
    event_id = new_event_id, reviewed_at = now(), reviewed_by = (select auth.uid()) where id = p_id;
  return new_event_id;
end;
$$;
revoke all on function public.review_city_proposal(uuid, text, boolean, jsonb) from public, anon;
grant execute on function public.review_city_proposal(uuid, text, boolean, jsonb) to authenticated;
commit;
