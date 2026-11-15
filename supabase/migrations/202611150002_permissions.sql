begin;

-- Security definer avoids recursive membership policies. No public writes to membership.
create function public.can_edit_city(target_city text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.city_memberships
    where city_id = target_city and user_id = (select auth.uid()) and role in ('owner', 'editor')
  );
$$;
revoke all on function public.can_edit_city(text) from public;
grant execute on function public.can_edit_city(text) to anon, authenticated;

alter table public.cities enable row level security;
alter table public.city_memberships enable row level security;
alter table public.city_categories enable row level security;
alter table public.city_places enable row level security;
alter table public.city_festivals enable row level security;
alter table public.city_events enable row level security;
alter table public.city_announcements enable row level security;

grant select on public.cities, public.city_categories, public.city_places,
  public.city_festivals, public.city_events, public.city_announcements to anon, authenticated;
grant select on public.city_memberships to authenticated;
grant insert, update, delete on public.city_categories, public.city_places,
  public.city_festivals, public.city_events, public.city_announcements to authenticated;
revoke insert, update, delete on public.cities, public.city_memberships from anon, authenticated;
revoke all on public.city_memberships from anon;

create policy cities_read on public.cities for select to anon, authenticated using (true);
create policy memberships_own on public.city_memberships for select to authenticated
  using (user_id = (select auth.uid()));
create policy categories_read on public.city_categories for select to anon, authenticated using (true);
create policy places_read on public.city_places for select to anon, authenticated using (true);

create policy festivals_public on public.city_festivals for select to anon, authenticated
  using (publication = 'published');
create policy events_public on public.city_events for select to anon, authenticated
  using (publication = 'published' and (festival_id is null or exists (
    select 1 from public.city_festivals f
    where f.id = festival_id and f.city_id = city_events.city_id and f.publication = 'published'
  )));
create policy announcements_public on public.city_announcements for select to anon, authenticated
  using (publication = 'published' and starts_at <= now() and ends_at > now()
    and (festival_id is null or exists (
      select 1 from public.city_festivals f
      where f.id = festival_id and f.city_id = city_announcements.city_id and f.publication = 'published'
    )));

create policy categories_edit on public.city_categories for all to authenticated
  using (public.can_edit_city(city_id)) with check (public.can_edit_city(city_id));
create policy places_edit on public.city_places for all to authenticated
  using (public.can_edit_city(city_id)) with check (public.can_edit_city(city_id));
create policy festivals_edit on public.city_festivals for all to authenticated
  using (public.can_edit_city(city_id)) with check (public.can_edit_city(city_id));
create policy events_edit on public.city_events for all to authenticated
  using (public.can_edit_city(city_id)) with check (public.can_edit_city(city_id));
create policy announcements_edit on public.city_announcements for all to authenticated
  using (public.can_edit_city(city_id)) with check (public.can_edit_city(city_id));
commit;