-- DEVELOPMENT DATABASE ONLY. Run after the three migrations, as the database owner.
-- All fixtures, users and edits are rolled back, including on a failed assertion.
begin;

insert into auth.users (id) values
  ('90000000-0000-4000-8000-000000000001'),
  ('90000000-0000-4000-8000-000000000002'),
  ('90000000-0000-4000-8000-000000000003');
insert into public.cities (id, name, latitude, longitude) values
  ('culture-test-a', 'Test A', 41, 2), ('culture-test-b', 'Test B', 42, 3);
insert into public.city_memberships (city_id, user_id, role) values
  ('culture-test-a', '90000000-0000-4000-8000-000000000001', 'editor'),
  ('culture-test-b', '90000000-0000-4000-8000-000000000002', 'editor'),
  ('culture-test-a', '90000000-0000-4000-8000-000000000003', 'viewer');
insert into public.city_categories (city_id, id, name) values
  ('culture-test-a', 'test', 'Test'), ('culture-test-b', 'test', 'Test');
insert into public.city_places (id, city_id, name, latitude, longitude) values
  ('91000000-0000-4000-8000-000000000001', 'culture-test-a', 'Place A', 41, 2),
  ('91000000-0000-4000-8000-000000000002', 'culture-test-b', 'Place B', 42, 3);
insert into public.city_festivals (id, city_id, name, starts_on, ends_on, publication) values
  ('92000000-0000-4000-8000-000000000001', 'culture-test-a', 'Draft festival', current_date, current_date, 'draft');
insert into public.city_events (id, city_id, place_id, category_id, translations, starts_at, ends_at, publication, festival_id) values
  ('93000000-0000-4000-8000-000000000001', 'culture-test-a', '91000000-0000-4000-8000-000000000001', 'test', '{"ca":{"title":"Public A","summary":"Test"}}', now(), now() + interval '1 hour', 'published', null),
  ('93000000-0000-4000-8000-000000000002', 'culture-test-a', '91000000-0000-4000-8000-000000000001', 'test', '{"ca":{"title":"Draft A","summary":"Test"}}', now(), now() + interval '1 hour', 'draft', null),
  ('93000000-0000-4000-8000-000000000003', 'culture-test-a', '91000000-0000-4000-8000-000000000001', 'test', '{"ca":{"title":"Hidden by festival","summary":"Test"}}', now(), now() + interval '1 hour', 'published', '92000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000004', 'culture-test-b', '91000000-0000-4000-8000-000000000002', 'test', '{"ca":{"title":"Draft B","summary":"Test"}}', now(), now() + interval '1 hour', 'draft', null),
  ('93000000-0000-4000-8000-000000000005', 'culture-test-b', '91000000-0000-4000-8000-000000000002', 'test', '{"ca":{"title":"Public B","summary":"Test"}}', now(), now() + interval '1 hour', 'published', null);
insert into public.city_announcements (city_id, title, message, starts_at, ends_at, publication) values
  ('culture-test-a', 'Active', 'Test', now() - interval '1 hour', now() + interval '1 hour', 'published'),
  ('culture-test-a', 'Expired', 'Test', now() - interval '2 hours', now() - interval '1 hour', 'published'),
  ('culture-test-a', 'Future', 'Test', now() + interval '1 hour', now() + interval '2 hours', 'published');

set local role anon;
do $$
begin
  if (select count(*) from public.city_events where city_id like 'culture-test-%') <> 2 then
    raise exception 'Anonymous can see drafts or an event belonging to a draft festival';
  end if;
  if (select count(*) from public.city_events e join public.city_places p on p.city_id = e.city_id and p.id = e.place_id
      where e.city_id like 'culture-test-%' and p.latitude between 40 and 43 and p.longitude between 1 and 4) <> 2 then
    raise exception 'Public map did not include both cities or exposed hidden events';
  end if;
  if (select count(*) from public.city_announcements where city_id = 'culture-test-a') <> 1 then
    raise exception 'Announcement time window is not enforced';
  end if;
  if public.can_edit_city('culture-test-a') then raise exception 'Anonymous can edit'; end if;
  begin
    insert into public.city_categories values ('culture-test-a', 'forbidden', 'Forbidden');
    raise exception 'Anonymous insert was permitted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
do $$
declare affected integer;
begin
  if not public.can_edit_city('culture-test-a') or public.can_edit_city('culture-test-b') then
    raise exception 'Editor membership scope is incorrect';
  end if;
  if (select count(*) from public.city_events where city_id = 'culture-test-a') <> 3 then
    raise exception 'Editor cannot see own drafts';
  end if;
  if exists(select 1 from public.city_events where city_id = 'culture-test-b' and publication = 'draft') then
    raise exception 'Editor can read another city draft';
  end if;
  if (select count(*) from public.city_memberships) <> 1 then
    raise exception 'Membership list exposes other users';
  end if;
  update public.city_events set organizer = 'Updated' where id = '93000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Editor cannot update own draft'; end if;
  update public.city_events set organizer = 'Forbidden' where id = '93000000-0000-4000-8000-000000000004';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Editor can update another city'; end if;
  begin
    insert into public.city_categories values ('culture-test-b', 'forbidden', 'Forbidden');
    raise exception 'Cross-city insert was permitted';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.city_events set city_id = 'culture-test-b', place_id = '91000000-0000-4000-8000-000000000002'
      where id = '93000000-0000-4000-8000-000000000002';
    raise exception 'Moving an event to an unauthorized city was permitted';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.city_events set place_id = '91000000-0000-4000-8000-000000000002'
      where id = '93000000-0000-4000-8000-000000000002';
    raise exception 'Cross-city resource reference was permitted';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.city_memberships values ('culture-test-b', '90000000-0000-4000-8000-000000000001', 'owner');
    raise exception 'Editor can promote themselves';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000002', true);
do $$
begin
  if public.can_edit_city('culture-test-a') or not public.can_edit_city('culture-test-b') then
    raise exception 'Second city editor permissions are incorrect';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);
do $$
declare affected integer;
begin
  if public.can_edit_city('culture-test-a') then raise exception 'Viewer can edit'; end if;
  update public.city_events set organizer = 'Forbidden' where city_id = 'culture-test-a';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Viewer can update'; end if;
end $$;
reset role;
rollback;
