-- DEVELOPMENT DATABASE ONLY, after migrations 001–005, as database owner.
-- Synthetic identities and writes are always rolled back. Run with ON_ERROR_STOP.
begin;
insert into auth.users (id) values
  ('94000000-0000-4000-8000-000000000001'),
  ('94000000-0000-4000-8000-000000000002');
insert into public.cities (id, name, latitude, longitude) values
  ('integration-test-a', 'Test A', 41, 2), ('integration-test-b', 'Test B', 42, 3);
insert into public.city_categories (city_id, id, name) values
  ('integration-test-a', 'test', 'Test'), ('integration-test-b', 'test', 'Test');
insert into public.city_places (id, city_id, name, latitude, longitude) values
  ('95000000-0000-4000-8000-000000000001', 'integration-test-a', 'A', 41, 2),
  ('95000000-0000-4000-8000-000000000002', 'integration-test-b', 'B', 42, 3);
insert into public.city_integrations (user_id, city_id, source, can_write, can_publish, requests_per_minute) values
  ('94000000-0000-4000-8000-000000000001', 'integration-test-a', 'municipal-a', true, false, 2),
  ('94000000-0000-4000-8000-000000000002', 'integration-test-b', 'municipal-b', true, true, 2);
-- An accidental editor membership must not broaden the machine account's permissions.
insert into public.city_memberships (city_id, user_id, role) values
  ('integration-test-b', '94000000-0000-4000-8000-000000000001', 'editor');
insert into public.city_events (id, city_id, place_id, category_id, translations, starts_at, ends_at, publication, source, external_id) values
  ('96000000-0000-4000-8000-000000000001', 'integration-test-a', '95000000-0000-4000-8000-000000000001', 'test', '{"ca":{"title":"A","summary":"Test"}}', now(), now() + interval '1 hour', 'draft', 'municipal-a', 'fixture-1'),
  ('96000000-0000-4000-8000-000000000002', 'integration-test-b', '95000000-0000-4000-8000-000000000002', 'test', '{"ca":{"title":"B","summary":"Test"}}', now(), now() + interval '1 hour', 'published', 'municipal-b', 'fixture-1'),
  ('96000000-0000-4000-8000-000000000003', 'integration-test-a', '95000000-0000-4000-8000-000000000001', 'test', '{"ca":{"title":"Manual","summary":"Test"}}', now(), now() + interval '1 hour', 'published', null, null);

set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000001', true);
do $$
declare affected integer; original timestamptz; advanced timestamptz;
begin
  if public.can_edit_city('integration-test-b') then raise exception 'Machine inherited editor rights'; end if;
  if (select count(*) from public.city_integrations) <> 1 then raise exception 'Registry exposes other accounts'; end if;
  if (select count(*) from public.city_events where city_id like 'integration-test-%') <> 1 then
    raise exception 'Source/city scope leaks other records or hides the owned draft';
  end if;
  select updated_at into original from public.city_events where id = '96000000-0000-4000-8000-000000000001';
  update public.city_events set organizer = 'First edit'
    where id = '96000000-0000-4000-8000-000000000001' and updated_at = original returning updated_at into advanced;
  if advanced is null or advanced <= original then raise exception 'Version did not advance'; end if;
  update public.city_events set organizer = 'Lost update'
    where id = '96000000-0000-4000-8000-000000000001' and updated_at = original;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Stale version overwrote an edit'; end if;
  update public.city_events set organizer = 'Forbidden' where city_id = 'integration-test-b';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-city update allowed'; end if;
  delete from public.city_events where id = '96000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Machine deletion allowed'; end if;
  begin
    update public.city_events set publication = 'published' where id = '96000000-0000-4000-8000-000000000001';
    raise exception 'Unauthorized publication allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.city_events set source = 'another-source' where id = '96000000-0000-4000-8000-000000000001';
    raise exception 'Source reassignment allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.city_events set place_id = '95000000-0000-4000-8000-000000000002' where id = '96000000-0000-4000-8000-000000000001';
    raise exception 'Cross-city place reference allowed';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.city_categories (city_id, id, name) values ('integration-test-a', 'forbidden', 'Forbidden');
    raise exception 'Reference-data modification allowed';
  exception when insufficient_privilege then null; end;
  if not public.consume_culture_api_request() then raise exception 'First request denied'; end if;
  if not public.consume_culture_api_request() then raise exception 'Second request denied'; end if;
  if public.consume_culture_api_request() then raise exception 'Budget exceeded'; end if;
end $$;
reset role;

-- Revoke immediately, without relying on JWT expiry.
update public.city_integrations set enabled = false where user_id = '94000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000001', true);
do $$
begin
  if exists (select 1 from public.city_events where city_id like 'integration-test-%') then raise exception 'Revoked account can read events'; end if;
  if public.consume_culture_api_request() then raise exception 'Revoked account retains budget'; end if;
end $$;

-- Publisher in another city retains only its own records and can publish.
select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000002', true);
do $$
declare affected integer;
begin
  if (select count(*) from public.city_events where city_id like 'integration-test-%') <> 1 then raise exception 'Second integration scope incorrect'; end if;
  update public.city_events set publication = 'draft' where id = '96000000-0000-4000-8000-000000000002';
  update public.city_events set publication = 'published' where id = '96000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Publisher cannot publish its own event'; end if;
end $$;
reset role;
rollback;