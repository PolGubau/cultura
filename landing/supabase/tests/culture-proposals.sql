-- DEVELOPMENT DATABASE ONLY, after migrations 001–006. All fixtures roll back.
begin;
insert into auth.users (id) values ('90000000-0000-4000-8000-000000000011'), ('90000000-0000-4000-8000-000000000012');
insert into public.cities (id, name, latitude, longitude) values ('proposal-test-a', 'A', 41, 2), ('proposal-test-b', 'B', 42, 3);
insert into public.city_memberships (city_id, user_id, role) values
  ('proposal-test-a', '90000000-0000-4000-8000-000000000011', 'editor'),
  ('proposal-test-b', '90000000-0000-4000-8000-000000000012', 'editor');
insert into public.city_categories (city_id, id, name) values ('proposal-test-a', 'test', 'Test');
insert into public.city_places (id, city_id, name, latitude, longitude) values
  ('91000000-0000-4000-8000-000000000011', 'proposal-test-a', 'Place', 41, 2);
insert into public.city_event_proposals (id, city_id, title, summary, place_name, starts_at, ends_at) values
  ('94000000-0000-4000-8000-000000000011', 'proposal-test-a', 'Concert', 'Music', 'Place', now(), now() + interval '1 hour'),
  ('94000000-0000-4000-8000-000000000012', 'proposal-test-a', 'Other', 'Music', 'Place', now(), now() + interval '1 hour');

set local role anon;
do $$
begin
  begin perform count(*) from public.city_event_proposals; raise exception 'Anonymous can read proposals';
  exception when insufficient_privilege then null; end;
  begin perform public.submit_city_proposal('proposal-test-a', repeat('a', 64), '{}'::jsonb); raise exception 'Anonymous can submit directly';
  exception when insufficient_privilege then null; end;
  begin perform public.review_city_proposal('94000000-0000-4000-8000-000000000011', 'proposal-test-a', false); raise exception 'Anonymous can review';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role service_role;
do $$
declare payload jsonb := jsonb_build_object('title', 'T', 'summary', 'S', 'description', '', 'place_name', 'P',
  'organizer', '', 'booking_url', null, 'starts_at', now(), 'ends_at', now() + interval '1 hour');
begin
  for i in 1..5 loop
    if not public.submit_city_proposal('proposal-test-a', repeat('a', 64), payload) then raise exception 'Premature rate limit'; end if;
  end loop;
  if public.submit_city_proposal('proposal-test-a', repeat('a', 64), payload) then raise exception 'Rate limit bypass'; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000012', true);
do $$
declare blocked boolean := false;
begin
  if exists(select 1 from public.city_event_proposals where city_id = 'proposal-test-a') then raise exception 'Cross-city read'; end if;
  begin perform public.review_city_proposal('94000000-0000-4000-8000-000000000011', 'proposal-test-a', false);
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'Cross-city review'; end if;
end $$;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000011', true);
do $$
declare event_id uuid; blocked boolean := false;
  payload jsonb := jsonb_build_object('place_id', '91000000-0000-4000-8000-000000000011', 'category_id', 'test',
    'translations', '{"ca":{"title":"Corrected","summary":"Music"}}'::jsonb,
    'starts_at', now(), 'ends_at', now() + interval '1 hour', 'format', 'timed',
    'price', '', 'accessibility', '', 'schedule_notes', '', 'organizer', '', 'status', 'scheduled');
begin
  event_id := public.review_city_proposal('94000000-0000-4000-8000-000000000011', 'proposal-test-a', true, payload);
  if not exists(select 1 from public.city_events where id = event_id and publication = 'published' and translations->'ca'->>'title' = 'Corrected') then
    raise exception 'Acceptance did not publish corrected event';
  end if;
  begin perform public.review_city_proposal('94000000-0000-4000-8000-000000000011', 'proposal-test-a', true, payload);
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'Duplicate acceptance'; end if;
  perform public.review_city_proposal('94000000-0000-4000-8000-000000000012', 'proposal-test-a', false);
  if not exists(select 1 from public.city_event_proposals where id = '94000000-0000-4000-8000-000000000012' and status = 'rejected' and event_id is null) then
    raise exception 'Rejection failed';
  end if;
end $$;
reset role;
rollback;