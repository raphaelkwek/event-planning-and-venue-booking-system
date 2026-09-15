-- Drafts become rows in event.events at status 'DRAFT' rather than a table of
-- their own. A draft is the same record as the event it becomes, so submitting
-- one keeps its id and history instead of copying it to a new row.

-- A draft may leave every field but its name empty (C1), so the columns a
-- submission requires can no longer be NOT NULL at the table level. What makes
-- them mandatory is B2, applied at submission, plus the check below.
alter table event.events alter column reference              drop not null;
alter table event.events alter column purpose                drop not null;
alter table event.events alter column description            drop not null;
alter table event.events alter column proposed_start_at      drop not null;
alter table event.events alter column proposed_end_at        drop not null;
alter table event.events alter column expected_attendance    drop not null;
alter table event.events alter column equipment_required     drop not null;
alter table event.events alter column registration_required  drop not null;
alter table event.events alter column submitted_at           drop not null;

-- C1/C3: a draft records when it was last saved; a submitted request records
-- when it was submitted.
alter table event.events add column if not exists last_saved_at timestamptz not null default now();

-- The B2 rules are not applied while a request is a draft (C1), so the
-- constraints that express them hold only once it has been submitted.
alter table event.events drop constraint if exists ends_after_start;
alter table event.events add constraint ends_after_start
  check (status = 'DRAFT' or proposed_end_at > proposed_start_at);

alter table event.events drop constraint if exists attendance_positive;
alter table event.events add constraint attendance_positive
  check (status = 'DRAFT' or expected_attendance > 0);

-- Everything past Draft carries a reference and a submission timestamp (B1);
-- a draft carries neither (C3).
alter table event.events add constraint submitted_requests_are_referenced
  check (status = 'DRAFT' or (reference is not null and submitted_at is not null));

-- Carry the existing drafts across. Drafts already submitted are skipped:
-- their event row is the record, and the draft row was only its origin.
insert into event.events (
  id, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
  expected_attendance, venue_requirements, accessibility_needs, equipment_required,
  equipment_requirements, registration_required, registration_opens_at,
  registration_closes_at, status, last_saved_at, created_at, created_by, updated_at, updated_by
)
select
  id, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
  expected_attendance, venue_requirements, accessibility_needs, equipment_required,
  equipment_requirements, registration_required, registration_opens_at,
  registration_closes_at, 'DRAFT', last_saved_at, created_at, created_by, updated_at, updated_by
from event.event_drafts
where converted_to_event_id is null;

alter table event.events drop column if exists source_draft_id;

drop table event.event_drafts;

create index on event.events (owner_id, status);
