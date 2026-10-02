-- Status changes (F1) and field-level amendments (D3) are both append-only
-- records of what happened to an event, so they become one history. An entry is
-- either a status change or a field change; entry_type says which, and the
-- checks below make sure each carries the columns that kind needs.

create table event.event_history (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid        not null references event.events (id),
  entry_type        text        not null check (entry_type in ('STATUS_CHANGE', 'FIELD_CHANGE')),
  previous_status   text,
  new_status        text,
  field_name        text,
  previous_value    text,
  new_value         text,
  -- identity.users.id. Null only for a system-initiated change.
  actor_user_id     uuid,
  actor_role        text        not null,
  triggering_action text        not null,
  occurred_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  created_by        uuid,
  updated_at        timestamptz not null default now(),
  updated_by        uuid,
  constraint status_change_names_its_status
    check (entry_type <> 'STATUS_CHANGE' or new_status is not null),
  constraint field_change_names_its_field
    check (entry_type <> 'FIELD_CHANGE' or field_name is not null)
);

create index on event.event_history (event_id, occurred_at);

insert into event.event_history (
  id, event_id, entry_type, previous_status, new_status, actor_user_id, actor_role,
  triggering_action, occurred_at, created_at, created_by, updated_at, updated_by
)
select
  id, event_id, 'STATUS_CHANGE', previous_status, new_status, actor_user_id, actor_role,
  triggering_action, occurred_at, created_at, created_by, updated_at, updated_by
from event.status_history;

-- event_field_edits recorded no role. Its only source was an organiser answering
-- a clarification, the one role permitted to do that, so the role is known.
insert into event.event_history (
  id, event_id, entry_type, field_name, previous_value, new_value, actor_user_id, actor_role,
  triggering_action, occurred_at, created_at, created_by, updated_at, updated_by
)
select
  id, event_id, 'FIELD_CHANGE', field_name, previous_value, new_value, edited_by, 'EVENT_ORGANISER',
  'RESPOND_TO_CLARIFICATION', edited_at, created_at, created_by, updated_at, updated_by
from event.event_field_edits;

drop table event.status_history;
drop table event.event_field_edits;
