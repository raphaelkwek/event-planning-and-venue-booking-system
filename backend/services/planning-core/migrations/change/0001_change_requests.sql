-- S1 (SPM-57): the change module's first schema. An organiser's request to
-- change an event's significant fields, with the reason and a snapshot of each
-- field's value when the request was made. The event itself is not changed
-- here; S2 applies an approved request. One pending request per event.
create schema if not exists change;

create table change.change_requests (
  id               uuid primary key default gen_random_uuid(),
  -- event.events.id and its reference, owned by the event module: no FK across schemas (§4.1).
  event_id         uuid        not null,
  event_reference  text        not null check (length(btrim(event_reference)) > 0),
  requested_by     uuid        not null,
  requested_at     timestamptz not null default clock_timestamp(),
  reason           text        not null check (length(btrim(reason)) > 0),
  status           text        not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);

create unique index change_requests_one_pending_per_event
  on change.change_requests (event_id) where (status = 'PENDING');
create index change_requests_event_idx on change.change_requests (event_id, requested_at desc);

create table change.change_request_fields (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid  not null references change.change_requests (id),
  field_name      text  not null check (field_name in (
                    'proposedStartAt', 'proposedEndAt', 'expectedAttendance',
                    'venueRequirements', 'equipmentRequired', 'equipmentRequirements')),
  -- The event's value when the request was made (AC3), and the value proposed. JSON null is a real value.
  current_value   jsonb not null,
  proposed_value  jsonb not null,
  constraint change_request_fields_once unique (request_id, field_name)
);

-- Transactional outbox (implementation.md §3.4), the same shape as event.outbox.
create table change.outbox (
  id           uuid primary key default gen_random_uuid(),
  seq          bigint generated always as identity,
  topic        text        not null,
  message_key  text        not null,
  envelope     jsonb       not null,
  created_at   timestamptz not null default now(),
  published_at timestamptz,
  attempts     int         not null default 0,
  last_error   text
);

create index change_outbox_pending_seq_idx on change.outbox (seq) where published_at is null;
