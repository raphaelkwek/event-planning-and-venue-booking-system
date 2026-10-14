-- ---------------------------------------------------------------------------
-- O1/O2: the equipment an event requires, and Technical Support's updates to it.
--
-- An event's equipment request is made of lines. A line is recorded by the
-- event's assigned coordinator (O1) and moves through statuses as Technical
-- Support arranges the equipment (O2). Nothing is deleted: a removed line has
-- status REMOVED, and request_line_history records every save, edit, removal
-- and status change with the acting user and the time.
--
-- The line's own type and quantity are the originally requested ones. A
-- substitution (O2) is recorded beside them in the substitute_* columns, so the
-- original values are never overwritten.
-- ---------------------------------------------------------------------------
create table equipment.equipment_request_lines (
  id                           uuid primary key default gen_random_uuid(),
  -- The order lines are listed in, and the cursor a list continues from.
  seq                          bigint generated always as identity,
  -- event.events.id and its reference, owned by the event module: no FK across schemas (§4.1).
  event_id                     uuid        not null,
  event_reference              text        not null check (length(btrim(event_reference)) > 0),
  equipment_type_id            uuid        not null references equipment.equipment_types (id),
  quantity                     int         not null check (quantity > 0),
  notes                        text        not null default '',
  required_from                timestamptz not null,
  required_to                  timestamptz not null,
  status                       text        not null default 'SUBMITTED'
    check (status in ('SUBMITTED', 'UNDER_REVIEW', 'CONFIRMED', 'UNAVAILABLE', 'SUBSTITUTED', 'RESERVED', 'REMOVED')),
  -- O1: the coordinator who recorded the line, and when.
  requested_by                 uuid        not null,
  requested_at                 timestamptz not null default clock_timestamp(),
  -- O2: the staff member who last changed the status, and when. Null until the first change.
  status_changed_by            uuid,
  status_changed_at            timestamptz,
  -- O2: why the line is Unavailable.
  unavailable_reason           text,
  -- O2: what replaces the requested equipment when the line is Substituted.
  substitute_equipment_type_id uuid        references equipment.equipment_types (id),
  substitute_quantity          int         check (substitute_quantity > 0),
  created_at                   timestamptz not null default now(),
  created_by                   uuid,
  updated_at                   timestamptz not null default now(),
  updated_by                   uuid,
  constraint request_lines_required_to_after_from check (required_to > required_from),
  constraint request_lines_unavailable_needs_reason
    check (status <> 'UNAVAILABLE' or (unavailable_reason is not null and length(btrim(unavailable_reason)) > 0)),
  constraint request_lines_substituted_needs_substitute
    check (status <> 'SUBSTITUTED' or (substitute_equipment_type_id is not null and substitute_quantity is not null))
);

create unique index equipment_request_lines_seq_idx on equipment.equipment_request_lines (seq);
create index equipment_request_lines_event_idx on equipment.equipment_request_lines (event_id, seq);
create index equipment_request_lines_status_idx on equipment.equipment_request_lines (status, seq);

create table equipment.request_line_history (
  id                  uuid primary key default gen_random_uuid(),
  line_id             uuid        not null references equipment.equipment_request_lines (id),
  action              text        not null check (action in ('CREATED', 'EDITED', 'REMOVED', 'STATUS_CHANGED')),
  previous_status     text,
  new_status          text        not null,
  -- The line as it was when this happened, so a removal still shows what was removed.
  equipment_type_id   uuid        not null,
  equipment_type_name text        not null,
  quantity            int         not null check (quantity > 0),
  -- What else changed: the new values of an edit, a reason, a substitute.
  details             jsonb       not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  actor_user_id       uuid        not null,
  actor_role          text        not null,
  occurred_at         timestamptz not null default clock_timestamp(),
  created_at          timestamptz not null default now(),
  created_by          uuid,
  updated_at          timestamptz not null default now(),
  updated_by          uuid
);

create index request_line_history_line_idx on equipment.request_line_history (line_id, occurred_at);
