begin;

-- The starts_at index also scans the growing archive for today's agenda.
-- Give the planner an alternative that starts with the non-expired events.
create index city_events_public_end_window
  on public.city_events (city_id, ends_at, starts_at, id)
  where publication = 'published';

-- Support stable ordering, including ties, without scanning draft events.
create index city_events_public_order
  on public.city_events (city_id, starts_at, id)
  where publication = 'published';

-- Used by the membership RLS policy, whose first filter is user_id.
create index city_memberships_user_city
  on public.city_memberships (user_id, city_id);

commit;