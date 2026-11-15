begin;
insert into public.cities (id, name, timezone, latitude, longitude)
values ('mataro', 'Mataró', 'Europe/Madrid', 41.5381, 2.4447);

insert into public.city_categories (city_id, id, name) values
  ('mataro', 'musica', 'Música'), ('mataro', 'teatre', 'Teatre i dansa'),
  ('mataro', 'tradicio', 'Cultura popular'), ('mataro', 'exposicions', 'Exposicions'),
  ('mataro', 'familiar', 'Familiar'), ('mataro', 'cinema', 'Cinema'),
  ('mataro', 'lletres', 'Lletres i pensament'), ('mataro', 'altres', 'Altres');
-- No invented events or unconfirmed 2027 festival dates.
-- Bootstrap the first owner in the Supabase SQL editor after creating an Auth user.
commit;