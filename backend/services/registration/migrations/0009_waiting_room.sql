-- ---------------------------------------------------------------------------
-- EN-19: the virtual waiting room (ADR-0011). Why Postgres and not Redis:
-- this service has no Redis, the queue must be exact (a lost or duplicated
-- place is a fairness bug, not a cache miss), and the rate it hands out
-- places is a few hundred a second, which one small row per join carries
-- easily. The gateway's Redis stays a counter store for rate limits.
--
-- The queue needs no worker. When an attendee joins, the event's gate row is
-- locked for an instant and hands out the next admission time: one slot per
-- 1/N second, never earlier than now. The attendee is admitted when the clock
-- reaches their slot, so the rate is N a second per event by construction.
-- A poll is a plain read: position is the number of slots still ahead.
--
-- Nothing is deleted (implementation.md §4.3). An entry is waiting until its
-- admit_at, admitted until its token expires (admit_at plus the token's life),
-- used once it has registered, and expired after that; all derived from the
-- clock except consumed_at.
-- ---------------------------------------------------------------------------
create table registration.waiting_room_gates (
  -- planning-core's event id. Another service's id: no foreign key (ADR-0004).
  event_id      uuid primary key,
  -- The earliest time the next joiner may be admitted.
  next_slot_at  timestamptz not null,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);

create table registration.waiting_room_entries (
  -- Unguessable: it is also how the attendee polls for their place.
  id           uuid primary key default gen_random_uuid(),
  seq          bigint generated always as identity,
  event_id     uuid        not null,
  -- identity.users.id of the attendee. Another service's id: no foreign key.
  attendee_id  uuid        not null,
  joined_at    timestamptz not null,
  -- When this entry is admitted: the gate's slot at the time of joining.
  admit_at     timestamptz not null,
  -- Set when the entry's token has been spent on a registration (single use).
  consumed_at  timestamptz,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  constraint waiting_room_entries_admit_after_join check (admit_at >= joined_at)
);

-- Position and wait: the entries of an event ordered by their slot.
create index waiting_room_entries_queue_idx on registration.waiting_room_entries (event_id, admit_at);

-- Joining again finds the attendee's latest entry for the event.
create index waiting_room_entries_attendee_idx on registration.waiting_room_entries (event_id, attendee_id, seq desc);
