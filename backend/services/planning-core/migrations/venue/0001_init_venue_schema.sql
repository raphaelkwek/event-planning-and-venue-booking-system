-- ---------------------------------------------------------------------------
-- The venue catalogue (H1). Owned by planning-core's venue module (ADR-0004).
--
-- venue.venues holds every attribute H1 AC1 lists. Layouts and opening hours
-- are jsonb: a layout is a name and its own capacity, and the hours are one
-- entry per day of the week, null when closed. Nothing is ever deleted: a
-- venue that is no longer offered becomes INACTIVE (§4.3).
--
-- venue.venue_staff records who looks after each venue (the creator, to start
-- with), for A3's "own venues" scope. Under the A2 policy any Venue Staff
-- member may maintain any venue.
--
-- venue.venue_history keeps each create and update: who, when, and each
-- changed field's previous and new value (H1 AC5).
-- ---------------------------------------------------------------------------
create schema if not exists venue;

create table venue.venues (
  id                      uuid primary key default gen_random_uuid(),
  name                    text        not null check (length(btrim(name)) > 0),
  building                text        not null check (length(btrim(building)) > 0),
  max_capacity            int         not null check (max_capacity > 0),
  layouts                 jsonb       not null check (jsonb_typeof(layouts) = 'array' and jsonb_array_length(layouts) > 0),
  facilities              text[]      not null default '{}',
  accessibility_features  text[]      not null default '{}',
  operating_hours         jsonb       not null,
  status                  text        not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at              timestamptz not null default now(),
  created_by              uuid,
  updated_at              timestamptz not null default now(),
  updated_by              uuid
);

create table venue.venue_staff (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid        not null references venue.venues (id),
  -- identity.users.id of a Venue Staff member who looks after this venue.
  user_id      uuid        not null,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  unique (venue_id, user_id)
);

create table venue.venue_history (
  id             uuid primary key default gen_random_uuid(),
  venue_id       uuid        not null references venue.venues (id),
  action         text        not null check (action in ('CREATED', 'UPDATED')),
  -- { "<field>": { "previous": <value>, "new": <value> } } for each changed field.
  changes        jsonb       not null,
  actor_user_id  uuid        not null,
  actor_role     text        not null,
  occurred_at    timestamptz not null default clock_timestamp(),
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);

create index venue_history_venue_idx on venue.venue_history (venue_id, occurred_at);
create index venues_name_idx on venue.venues (lower(name));
