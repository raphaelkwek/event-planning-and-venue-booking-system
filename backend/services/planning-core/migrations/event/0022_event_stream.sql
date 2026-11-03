-- EN-03 (SPM-121, ADR-0007): the event store.
--
-- Everything that happens to an event's history is an entry in that event's
-- stream, in order, and nothing in the stream is ever changed or removed. The
-- history table (event.event_history) stays as a projection of the stream,
-- written in the same transaction as each append (repo/eventStream.ts), so the
-- screens that list history keep reading one indexed table.
--
-- Each entry stores the hash of the entry before it, so editing an entry after
-- the fact breaks the chain where the edit was made. `npm run event-store:verify`
-- recomputes every chain and fails on the first broken link.
--
-- Numbered 0022: event 0014 to 0021 are reserved for packages still open
-- (U1, A4, the enablers). migrate.ts tracks each file by name, so the gap does
-- no harm.

create table event.event_stream (
  id            uuid        primary key default gen_random_uuid(),
  -- event.events.id. No foreign key: the events row is a projection of this
  -- stream, not its parent.
  aggregate_id  uuid        not null,
  -- 1 for an event's first entry, then one more for each entry after it.
  version       integer     not null check (version > 0),
  type          text        not null check (type in ('STATUS_CHANGE', 'FIELD_CHANGE')),
  -- What happened, as event.history_entry_data (0023) builds it from a history
  -- row: previousStatus, newStatus and triggeringAction for a status change;
  -- fieldName, previousValue, newValue and triggeringAction for a field change.
  data          jsonb       not null check (jsonb_typeof(data) = 'object'),
  -- identity.users.id. Cross-module reference, no FK. Null only for a
  -- system-initiated change, such as the completion sweep.
  actor_user_id uuid,
  actor_role    text        not null,
  occurred_at   timestamptz not null,
  -- The previous entry's hash, or 64 zeros for version 1.
  prev_hash     text        not null check (prev_hash ~ '^[0-9a-f]{64}$'),
  -- sha256(prev_hash || canonical JSON of this entry), lowercase hex. See
  -- event.stream_entry_canonical below for the canonical form.
  hash          text        not null check (hash ~ '^[0-9a-f]{64}$'),
  created_at    timestamptz not null default now(),
  created_by    uuid,
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  -- The optimistic guard: two appends that computed the same next version for
  -- one event cannot both be stored. The second waits for the first to commit
  -- and is then refused (23505), so its transaction stores nothing.
  constraint event_stream_one_entry_per_version unique (aggregate_id, version),
  constraint event_stream_status_change_names_its_status
    check (type <> 'STATUS_CHANGE' or data ->> 'newStatus' is not null),
  constraint event_stream_field_change_names_its_field
    check (type <> 'FIELD_CHANGE' or data ->> 'fieldName' is not null)
);

-- ---------------------------------------------------------------------------
-- The canonical form an entry is hashed over.
--
-- A JSON object of the entry's id, aggregateId, version, type, data,
-- actorUserId, actorRole and occurredAt, written as PostgreSQL's jsonb text:
-- - object keys sorted by their length in bytes, then bytewise, at every level;
-- - one space after each colon and each comma, and no other whitespace;
-- - strings escaped as JSON requires (\" \\ \n and so on), other characters
--   kept as UTF-8; a missing actor is JSON null;
-- - occurredAt in UTC with six fractional digits, e.g. 2026-11-03T01:02:03.456789Z,
--   the precision timestamptz stores, so the text never depends on the session's
--   time zone or loses a microsecond.
-- The hash is sha256 over the UTF-8 bytes of prev_hash followed directly by
-- that text, in lowercase hex. tests/event/repo/eventStream.test.ts pins an
-- example (EN-03-T2), so a change to this function fails the build.
-- ---------------------------------------------------------------------------
create function event.stream_entry_canonical(
  p_id            uuid,
  p_aggregate_id  uuid,
  p_version       integer,
  p_type          text,
  p_data          jsonb,
  p_actor_user_id uuid,
  p_actor_role    text,
  p_occurred_at   timestamptz
) returns text
language sql stable
as $$
  select jsonb_build_object(
    'id', p_id,
    'aggregateId', p_aggregate_id,
    'version', p_version,
    'type', p_type,
    'data', p_data,
    'actorUserId', p_actor_user_id,
    'actorRole', p_actor_role,
    'occurredAt', to_char(p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  )::text
$$;

create function event.stream_entry_hash(p_prev_hash text, p_canonical text) returns text
language sql stable strict
as $$
  select encode(sha256(convert_to(p_prev_hash || p_canonical, 'UTF8')), 'hex')
$$;

-- ---------------------------------------------------------------------------
-- The one append. It takes the event's next version and the previous entry's
-- hash, hashes the new entry and inserts it, in the caller's transaction.
--
-- It takes no lock of its own, so it leaves implementation.md §4.6's lock order
-- as it was: every writer already holds the event's row lock (F1's conditional
-- update, G1's FOR UPDATE, S2's update) before it appends, so appends to one
-- event queue there. If two ever met here without that lock, the unique
-- constraint above refuses the second.
--
-- repo/eventStream.ts calls it and then writes the projection and the outbox
-- row; 0023's trigger and backfill call it for history written any other way.
-- ---------------------------------------------------------------------------
create function event.append_to_stream(
  p_aggregate_id  uuid,
  p_type          text,
  p_data          jsonb,
  p_actor_user_id uuid,
  p_actor_role    text,
  p_occurred_at   timestamptz default null,
  p_id            uuid default null
) returns table (entry_id uuid, entry_version integer, entry_occurred_at timestamptz, entry_hash text)
language plpgsql
as $$
declare
  v_id          uuid        := coalesce(p_id, gen_random_uuid());
  -- The history's default before EN-03: the start of the writing transaction.
  v_occurred_at timestamptz := coalesce(p_occurred_at, now());
  v_version     integer;
  v_prev_hash   text;
  v_hash        text;
begin
  select s.version + 1, s.hash
  into v_version, v_prev_hash
  from event.event_stream s
  where s.aggregate_id = p_aggregate_id
  order by s.version desc
  limit 1;

  v_version   := coalesce(v_version, 1);
  v_prev_hash := coalesce(v_prev_hash, repeat('0', 64));
  v_hash := event.stream_entry_hash(
    v_prev_hash,
    event.stream_entry_canonical(
      v_id, p_aggregate_id, v_version, p_type, p_data, p_actor_user_id, p_actor_role, v_occurred_at
    )
  );

  insert into event.event_stream (
    id, aggregate_id, version, type, data, actor_user_id, actor_role, occurred_at,
    prev_hash, hash, created_by, updated_by
  ) values (
    v_id, p_aggregate_id, v_version, p_type, p_data, p_actor_user_id, p_actor_role, v_occurred_at,
    v_prev_hash, v_hash, p_actor_user_id, p_actor_user_id
  );

  return query select v_id, v_version, v_occurred_at, v_hash;
end;
$$;

-- ---------------------------------------------------------------------------
-- Append-only. An entry is never updated or deleted, and the stream is never
-- truncated (implementation.md §4.3: nothing is ever deleted). The triggers
-- refuse each, whoever asks.
-- ---------------------------------------------------------------------------
create function event.refuse_stream_rewrite() returns trigger
language plpgsql
as $$
begin
  raise exception 'event.event_stream is append-only: % is not allowed (ADR-0007)', tg_op
    using hint = 'Record what changed as a new entry instead.';
end;
$$;

create trigger event_stream_append_only
  before update or delete on event.event_stream
  for each row execute function event.refuse_stream_rewrite();

create trigger event_stream_never_truncated
  before truncate on event.event_stream
  for each statement execute function event.refuse_stream_rewrite();

-- ---------------------------------------------------------------------------
-- Privileges. The app and these migrations connect as the same role, through
-- DATABASE_URL, and that role owns the table. An owner holds every privilege
-- until it gives them up, so it keeps SELECT and INSERT only. No other role is
-- given anything, including any default privileges that granted it access when
-- the table was created. In CI the role is a superuser, which privileges don't
-- bind, so there the triggers above are what refuse a rewrite.
-- ---------------------------------------------------------------------------
do $$
declare
  v_grantee text;
begin
  for v_grantee in
    select distinct a.grantee::regrole::text
    from pg_class c
    cross join lateral aclexplode(c.relacl) a
    where c.oid = 'event.event_stream'::regclass
      and a.grantee <> 0
      and a.grantee <> (select oid from pg_roles where rolname = current_user)
  loop
    execute format('revoke all on table event.event_stream from %s', v_grantee);
  end loop;
end;
$$;

revoke all on table event.event_stream from public;
revoke all on table event.event_stream from current_user;
grant select, insert on table event.event_stream to current_user;
