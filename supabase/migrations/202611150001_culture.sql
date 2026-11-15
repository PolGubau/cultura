-- New cultural platform. Does NOT modify the legacy native app's tables.
begin;

create table public.cities (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  timezone text not null default 'Europe/Madrid',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180)
);

create table public.city_memberships (
  city_id text not null references public.cities(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  primary key (city_id, user_id)
);

create table public.city_categories (
  city_id text not null references public.cities(id),
  id text not null check (id ~ '^[a-z0-9-]+$'),
  name text not null check (length(trim(name)) between 1 and 80),
  primary key (city_id, id)
);

create table public.city_places (
  id uuid primary key default gen_random_uuid(),
  city_id text not null references public.cities(id),
  name text not null check (length(trim(name)) between 1 and 160),
  address text not null default '',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  unique (city_id, id)
);

create table public.city_festivals (
  id uuid primary key default gen_random_uuid(),
  city_id text not null references public.cities(id),
  name text not null check (length(trim(name)) between 1 and 160),
  description text not null default '',
  starts_on date not null,
  ends_on date not null,
  logo_url text check (logo_url is null or logo_url ~ '^https://'),
  primary_color text not null default '#9f1239' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  auto_activate boolean not null default true,
  priority integer not null default 0 check (priority between 0 and 100),
  publication text not null default 'draft' check (publication in ('draft', 'published')),
  created_at timestamptz not null default now(),
  unique (city_id, id),
  check (ends_on >= starts_on)
);

create table public.city_events (
  id uuid primary key default gen_random_uuid(),
  city_id text not null references public.cities(id),
  festival_id uuid,
  place_id uuid not null,
  category_id text not null,
  -- Each locale has title, summary and description. Catalan is required.
  translations jsonb not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  format text not null default 'timed' check (format in ('timed', 'exhibition')),
  -- Route is optional; the place remains the meeting point.
  route jsonb,
  image_url text check (image_url is null or image_url ~ '^https://'),
  booking_url text check (booking_url is null or booking_url ~ '^https://'),
  price text not null default '',
  accessibility text not null default '',
  schedule_notes text not null default '',
  organizer text not null default '',
  source text,
  external_id text,
  publication text not null default 'draft' check (publication in ('draft', 'published')),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, id),
  unique (city_id, source, external_id),
  foreign key (city_id, festival_id) references public.city_festivals(city_id, id),
  foreign key (city_id, place_id) references public.city_places(city_id, id),
  foreign key (city_id, category_id) references public.city_categories(city_id, id),
  check (ends_at > starts_at),
  check (jsonb_typeof(translations) = 'object'),
  check (length(trim(coalesce(translations->'ca'->>'title', ''))) between 1 and 160),
  check (length(trim(coalesce(translations->'ca'->>'summary', ''))) between 1 and 500),
  check (status <> 'cancelled' or length(trim(coalesce(cancellation_reason, ''))) > 0)
);

create table public.city_announcements (
  id uuid primary key default gen_random_uuid(),
  city_id text not null references public.cities(id),
  festival_id uuid,
  title text not null check (length(trim(title)) between 1 and 160),
  message text not null check (length(trim(message)) between 1 and 2000),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  publication text not null default 'draft' check (publication in ('draft', 'published')),
  foreign key (city_id, festival_id) references public.city_festivals(city_id, id),
  check (ends_at > starts_at)
);

create index city_events_window on public.city_events (city_id, starts_at, ends_at) where publication = 'published';
create index city_events_festival on public.city_events (city_id, festival_id);
create index city_announcements_window on public.city_announcements (city_id, ends_at);

create function public.validate_city_event() returns trigger language plpgsql set search_path = '' as $$
declare point jsonb;
begin
  new.updated_at := now();
  if new.route is not null then
    if jsonb_typeof(new.route) <> 'array' or jsonb_array_length(new.route) < 2 then
      raise exception 'A route needs at least two points';
    end if;
    for point in select * from jsonb_array_elements(new.route) loop
      if jsonb_typeof(point->'lat') is distinct from 'number'
        or jsonb_typeof(point->'lng') is distinct from 'number'
        or (point->>'lat')::double precision not between -90 and 90
        or (point->>'lng')::double precision not between -180 and 180 then
        raise exception 'Invalid route coordinates';
      end if;
    end loop;
  end if;
  return new;
end;
$$;
create trigger validate_city_event before insert or update on public.city_events
  for each row execute function public.validate_city_event();
commit;