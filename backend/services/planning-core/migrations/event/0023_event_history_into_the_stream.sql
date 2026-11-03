-- EN-03 (SPM-121, ADR-0007): the history written before the stream existed
-- becomes the start of each event's stream, and no history row can reach
-- event.event_history again without reaching the stream too.
--
-- One file, so that nothing written between the trigger and the backfill is
-- missed or copied twice. Creating the trigger locks event.event_history
-- against writes until this file's transaction commits, and the backfill runs
-- after it, so the backfill sees every row there is and no new one can arrive.

-- ---------------------------------------------------------------------------
-- An entry's data, built from the columns of a history row. The one place the
-- shape is defined: the append (repo/eventStream.ts), the trigger and the
-- backfill below, and the tamper check's comparison all use it.
-- ---------------------------------------------------------------------------
create function event.history_entry_data(
  p_entry_type        text,
  p_previous_status   text,
  p_new_status        text,
  p_field_name        text,
  p_previous_value    text,
  p_new_value         text,
  p_triggering_action text
) returns jsonb
language sql immutable
as $$
  select case p_entry_type
    when 'STATUS_CHANGE' then jsonb_build_object(
      'previousStatus', p_previous_status,
      'newStatus', p_new_status,
      'triggeringAction', p_triggering_action
    )
    when 'FIELD_CHANGE' then jsonb_build_object(
      'fieldName', p_field_name,
      'previousValue', p_previous_value,
      'newValue', p_new_value,
      'triggeringAction', p_triggering_action
    )
  end
$$;

-- ---------------------------------------------------------------------------
-- The append writes the stream entry first and then the history row with the
-- entry's id. A history row whose id is not in the stream was written some
-- other way: by code that skipped the append, a hand-written fix, or a test
-- fixture. It is appended here, in the same statement, so the projection can
-- never hold an entry the stream lacks (ADR-0007's "two writes that drift").
-- If the history row is then refused (one of its checks), the statement fails
-- and the entry goes with it.
-- ---------------------------------------------------------------------------
create function event.history_row_reaches_the_stream() returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from event.event_stream s where s.id = new.id) then
    perform event.append_to_stream(
      new.event_id,
      new.entry_type,
      event.history_entry_data(
        new.entry_type, new.previous_status, new.new_status, new.field_name,
        new.previous_value, new.new_value, new.triggering_action
      ),
      new.actor_user_id,
      new.actor_role,
      new.occurred_at,
      new.id
    );
  end if;
  return new;
end;
$$;

create trigger event_history_reaches_the_stream
  before insert on event.event_history
  for each row execute function event.history_row_reaches_the_stream();

-- ---------------------------------------------------------------------------
-- The backfill. Copies every history row that has no stream entry yet into its
-- event's stream, with the row's own id, oldest first, in the order F2 listed
-- them before EN-03 (time, then when recorded, then id), so the history
-- screens show the same entries in the same order.
--
-- Idempotent: a row already in the stream is skipped, so a second run copies
-- nothing. Run here once; `select event.backfill_event_stream();` may be run
-- again by hand, and only ever adds rows that are missing. Returns how many
-- it copied.
-- ---------------------------------------------------------------------------
create function event.backfill_event_stream() returns integer
language plpgsql
as $$
declare
  v_row    record;
  v_copied integer := 0;
begin
  for v_row in
    select h.*
    from event.event_history h
    where not exists (select 1 from event.event_stream s where s.id = h.id)
    order by h.event_id, h.occurred_at, h.created_at, h.id
  loop
    perform event.append_to_stream(
      v_row.event_id,
      v_row.entry_type,
      event.history_entry_data(
        v_row.entry_type, v_row.previous_status, v_row.new_status, v_row.field_name,
        v_row.previous_value, v_row.new_value, v_row.triggering_action
      ),
      v_row.actor_user_id,
      v_row.actor_role,
      v_row.occurred_at,
      v_row.id
    );
    v_copied := v_copied + 1;
  end loop;
  return v_copied;
end;
$$;

select event.backfill_event_stream();
