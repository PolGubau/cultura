begin;
create index city_places_map_lat_lng on public.city_places (latitude, longitude, id);
create index city_events_map_place_window on public.city_events (place_id, starts_at, id) include (ends_at)
  where publication = 'published';
commit;