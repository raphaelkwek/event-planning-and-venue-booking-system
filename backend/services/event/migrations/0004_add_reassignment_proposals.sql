-- ---------------------------------------------------------------------------
-- Coordinator reassignment proposals (E2) — propose -> accept/decline.
--
-- Rows are never deleted: a resolved proposal (ACCEPTED/DECLINED) stays as
-- history, and only a PENDING one blocks a new proposal for the same event.
-- ---------------------------------------------------------------------------
create table event.reassignment_proposals (
  id                       uuid primary key default gen_random_uuid(),
  event_id                 uuid        not null references event.events (id),
  -- identity.users.id of the coordinator active at the time of proposing.
  outgoing_coordinator_id  uuid        not null,
  -- identity.users.id of the coordinator nominated to take over.
  nominee_coordinator_id   uuid        not null,
  status                   text        not null check (status in ('PENDING', 'ACCEPTED', 'DECLINED')),
  proposed_at              timestamptz not null default now(),
  resolved_at              timestamptz,
  created_at               timestamptz not null default now(),
  created_by               uuid,
  updated_at               timestamptz not null default now(),
  updated_by               uuid
);

-- E2: only one pending reassignment proposal may exist per event at a time.
-- A single-row insert makes this atomic (implementation.md §4.5), the same
-- technique as assignments_one_active_per_event.
create unique index reassignment_proposals_one_pending_per_event
  on event.reassignment_proposals (event_id) where status = 'PENDING';

create index on event.reassignment_proposals (event_id, proposed_at);
