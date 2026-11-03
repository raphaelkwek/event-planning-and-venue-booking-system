-- EN-07.2 (SPM-168, ADR-0010): A3 and A4 enforced by Postgres row-level security,
-- as well as by the repo's query filter, so a query that forgets its WHERE clause
-- still can't return another organiser's event, or an event a coordinator isn't
-- assigned to.
--
-- Who RLS applies to:
-- * connectsphere_request, a role with no login. Each scoped read runs inside a
--   transaction that does SET LOCAL ROLE connectsphere_request and sets the
--   caller's claims with set_config(..., true), which is SET LOCAL:
--   app.user_id (the caller's internal id) and app.access_scope (the scope rule
--   the repo applies: OWNED_BY_USER, ASSIGNED_TO_USER, ALL or another). Both end
--   with the transaction, so Supabase's transaction pooler can't hand them to the
--   next client (src/modules/event/repo/requestRole.ts).
-- * Not the service's login role. It owns these tables, and RLS is enabled, not
--   forced, so the owner bypasses it. That is the role the migrator, the outbox
--   relay, the Temporal worker and the scheduled jobs run as: they act for the
--   system, not for a caller, and read every row on purpose.
--
-- Missing or unknown claims see nothing: the policies fail closed.

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'connectsphere_request') then
    create role connectsphere_request nologin;
  end if;
end
$$;

-- The service's login role switches to it with SET LOCAL ROLE.
grant connectsphere_request to current_user;

grant usage on schema event to connectsphere_request;
-- UPDATE only so that a scoped read can lock the row (FOR UPDATE / FOR SHARE need
-- it); the update policy below refuses every actual change.
grant select, update on event.events to connectsphere_request;
grant select on event.assignments to connectsphere_request;

-- A4: whether the coordinator holds the event's active assignment. SECURITY DEFINER,
-- so it reads event.assignments as the table owner, past that table's own policy;
-- without it the two policies would refer to each other.
create function event.rls_is_assigned(p_event_id uuid, p_coordinator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from event.assignments a
    where a.event_id = p_event_id and a.is_active and a.coordinator_id = p_coordinator_id
  )
$$;

-- The scope rule, the same as scopeCondition in src/modules/event/repo/events.ts.
-- A draft is its owner's alone, even under ALL.
create function event.rls_event_in_scope(p_event_id uuid, p_owner_id uuid, p_status text)
returns boolean
language sql
stable
set search_path = pg_catalog
as $$
  select coalesce(
    case current_setting('app.access_scope', true)
      when 'ALL' then
        p_status <> 'DRAFT' or p_owner_id = nullif(current_setting('app.user_id', true), '')::uuid
      when 'ASSIGNED_TO_USER' then
        p_status <> 'DRAFT' and event.rls_is_assigned(p_event_id, nullif(current_setting('app.user_id', true), '')::uuid)
      when 'OWNED_BY_USER' then
        p_owner_id = nullif(current_setting('app.user_id', true), '')::uuid
      else false
    end,
    false
  )
$$;

revoke all on function event.rls_is_assigned(uuid, uuid) from public;
revoke all on function event.rls_event_in_scope(uuid, uuid, text) from public;
grant execute on function event.rls_is_assigned(uuid, uuid) to connectsphere_request;
grant execute on function event.rls_event_in_scope(uuid, uuid, text) to connectsphere_request;

alter table event.events enable row level security;
alter table event.assignments enable row level security;

create policy events_in_scope on event.events
  for select to connectsphere_request
  using (event.rls_event_in_scope(id, owner_id, status));

-- Locking a row (FOR UPDATE, FOR SHARE) checks this USING clause too. WITH CHECK
-- false means the request role can lock a row in scope but never change one.
create policy events_lock_in_scope on event.events
  for update to connectsphere_request
  using (event.rls_event_in_scope(id, owner_id, status))
  with check (false);

-- An assignment is visible exactly when its event is (the subquery is itself
-- subject to events_in_scope).
create policy assignments_of_events_in_scope on event.assignments
  for select to connectsphere_request
  using (exists (select 1 from event.events e where e.id = assignments.event_id));
