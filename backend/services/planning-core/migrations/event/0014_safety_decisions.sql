-- U1 (CR-06): the Safety Officer's decision on an event in Safety Review. One row per
-- review: an event that returns to Planning and reaches Safety Review again is a new review,
-- keyed by when it entered Safety Review (review_started_at, the time of that status change in
-- event.event_history). The unique key is what makes "one decision per review" hold under
-- concurrent requests, and what makes an earlier approval stop counting after rework.
--
-- The row is the permanent record (F2): officer, time, decision, reason, and the arrangements a
-- request for changes named. Append-only: nothing updates or deletes it (implementation.md §4.3).
-- A passed check is an APPROVE row for the review the event is in; the coordinator's Mark
-- Confirmed reads it.
--
-- event_id gets its foreign key NOT VALID here and validated in 0015, so the scan runs in a
-- transaction of its own (migrate.ts applies one file per transaction).
create table event.safety_decisions (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid        not null,
  review_started_at timestamptz not null,
  decision          text        not null check (decision in ('APPROVE', 'REQUEST_CHANGES', 'REJECT')),
  reason            text,
  -- The venue bookings and equipment reservations a request for changes named: {"bookings": [..], "reservations": [..]}.
  flagged           jsonb       not null default '{"bookings": [], "reservations": []}'::jsonb
                    check (jsonb_typeof(flagged) = 'object'),
  -- identity.users.id: another service's data, no foreign key (implementation.md §4.1).
  decided_by        uuid        not null,
  decided_at        timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  constraint safety_decisions_reason_required
    check (decision = 'APPROVE' or length(btrim(coalesce(reason, ''))) > 0),
  constraint safety_decisions_one_per_review unique (event_id, review_started_at)
);

alter table event.safety_decisions
  add constraint safety_decisions_event_id_fkey foreign key (event_id) references event.events (id) not valid;

create index safety_decisions_event_idx on event.safety_decisions (event_id, decided_at desc);
