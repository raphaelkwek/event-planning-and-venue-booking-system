create schema if not exists event;

-- Human-readable event references (B1): EVT-000001, EVT-000002, ...
create sequence if not exists event.event_reference_seq;

-- ---------------------------------------------------------------------------
-- Drafts (C1, C2, C3)
--
-- A draft has no status column: its presence in this table IS status Draft.
-- On submission the draft is marked converted rather than deleted — nothing in
-- this system is ever hard-deleted (implementation.md §4.3).
-- ---------------------------------------------------------------------------
create table event.event_drafts (
  id                     uuid primary key default gen_random_uuid(),
  -- identity.users.id. Cross-service reference, no FK (plan.md §4).
  owner_id               uuid        not null,
  name                   text        not null,
  purpose                text,
  description            text,
  proposed_start_at      timestamptz,
  proposed_end_at        timestamptz,
  expected_attendance    integer,
  venue_requirements     jsonb,
  accessibility_needs    text,
  equipment_required     boolean,
  equipment_requirements jsonb,
  registration_required  boolean,
  registration_opens_at  timestamptz,
  registration_closes_at timestamptz,
  last_saved_at          timestamptz not null default now(),
  converted_to_event_id  uuid,
  converted_at           timestamptz,
  created_at             timestamptz not null default now(),
  created_by             uuid,
  updated_at             timestamptz not null default now(),
  updated_by             uuid
);

create index on event.event_drafts (owner_id);
create index on event.event_drafts (owner_id, converted_at);

-- ---------------------------------------------------------------------------
-- Events (B1 onward)
--
-- The status check lists all ten permitted statuses (F1), but no row is ever
-- inserted at 'DRAFT': a draft lives in event_drafts until it is submitted.
-- The first status_history row records 'DRAFT' as the previous status to
-- describe the real-world prior state.
-- ---------------------------------------------------------------------------
create table event.events (
  id                     uuid primary key default gen_random_uuid(),
  reference              text        not null unique,
  -- identity.users.id of the submitting organiser, who owns the event (B1).
  owner_id               uuid        not null,
  name                   text        not null,
  purpose                text        not null,
  description            text        not null,
  proposed_start_at      timestamptz not null,
  proposed_end_at        timestamptz not null,
  expected_attendance    integer     not null,
  venue_requirements     jsonb,
  accessibility_needs    text,
  equipment_required     boolean     not null,
  equipment_requirements jsonb,
  registration_required  boolean     not null,
  registration_opens_at  timestamptz,
  registration_closes_at timestamptz,
  status                 text        not null check (status in (
                           'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'AWAITING_CLARIFICATION',
                           'APPROVED', 'PLANNING', 'CONFIRMED', 'COMPLETED',
                           'CANCELLED', 'REJECTED'
                         )),
  submitted_at           timestamptz not null,
  -- D1: the coordinator who opened the request for review, which need not be
  -- the coordinator assigned to it by E1.
  reviewing_coordinator_id uuid,
  review_started_at      timestamptz,
  -- D4/D5: a recorded decision. Present means the event cannot be decided again.
  decided_by             uuid,
  decided_at             timestamptz,
  rejection_reason       text,
  source_draft_id        uuid references event.event_drafts (id),
  created_at             timestamptz not null default now(),
  created_by             uuid,
  updated_at             timestamptz not null default now(),
  updated_by             uuid,
  constraint ends_after_start check (proposed_end_at > proposed_start_at),
  constraint attendance_positive check (expected_attendance > 0)
);

create index on event.events (owner_id);
create index on event.events (status);
create index on event.events (submitted_at);

alter table event.event_drafts
  add constraint event_drafts_converted_to_event_fk
  foreign key (converted_to_event_id) references event.events (id);

-- ---------------------------------------------------------------------------
-- Coordinator assignment (E1 — stubbed in this release)
-- ---------------------------------------------------------------------------
create table event.assignments (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid        not null references event.events (id),
  -- identity.users.id of a user holding EVENT_COORDINATOR.
  coordinator_id  uuid        not null,
  assignment_rule text        not null,
  assigned_at     timestamptz not null default now(),
  ended_at        timestamptz,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  created_by      uuid,
  updated_at      timestamptz not null default now(),
  updated_by      uuid
);

-- E1: an event has at most one active assigned coordinator at any time.
create unique index assignments_one_active_per_event
  on event.assignments (event_id) where is_active;

-- Round-robin pointer for the stub allocation rule. One row, ever.
create table event.assignment_cursor (
  id         boolean primary key default true check (id),
  next_index integer     not null default 0,
  updated_at timestamptz not null default now()
);

insert into event.assignment_cursor (id, next_index) values (true, 0)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Status history (F1, F2) — append only, never edited or deleted
-- ---------------------------------------------------------------------------
create table event.status_history (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid        not null references event.events (id),
  previous_status   text,
  new_status        text        not null,
  actor_user_id     uuid,
  actor_role        text        not null,
  triggering_action text        not null,
  occurred_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  created_by        uuid,
  updated_at        timestamptz not null default now(),
  updated_by        uuid
);

create index on event.status_history (event_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Clarifications (D2, D3) — one row per round, retained in order
-- ---------------------------------------------------------------------------
create table event.clarifications (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid        not null references event.events (id),
  message          text        not null,
  requested_by     uuid        not null,
  requested_at     timestamptz not null default now(),
  status           text        not null check (status in ('OPEN', 'RESPONDED')),
  response_message text,
  responded_by     uuid,
  responded_at     timestamptz,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);

create index on event.clarifications (event_id, requested_at);

-- ---------------------------------------------------------------------------
-- Field-level edit history (D3: originals retained alongside amended values)
-- ---------------------------------------------------------------------------
create table event.event_field_edits (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid        not null references event.events (id),
  field_name     text        not null,
  previous_value text,
  new_value      text,
  source         text        not null check (source in ('CLARIFICATION_RESPONSE')),
  edited_by      uuid        not null,
  edited_at      timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);

create index on event.event_field_edits (event_id, edited_at);

-- ---------------------------------------------------------------------------
-- Transactional outbox (implementation.md §3.4)
-- ---------------------------------------------------------------------------
create table event.outbox (
  id           uuid primary key default gen_random_uuid(),
  topic        text        not null,
  message_key  text        not null,
  envelope     jsonb       not null,
  created_at   timestamptz not null default now(),
  published_at timestamptz,
  attempts     int         not null default 0,
  last_error   text
);

create index on event.outbox (published_at) where published_at is null;
