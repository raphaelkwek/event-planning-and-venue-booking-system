-- Resets the event data created while running functional test cases, so that one
-- case's writes cannot change another's outcome.
--
-- The database is shared by the whole team, so this removes ONLY requests owned by
-- the two seeded organiser accounts, and everything hanging off them. Nobody else's
-- data is touched, and no schema is changed.
--
-- Run it with `npm run test-cases:reset`, or paste it into the Supabase SQL editor.
-- It is test tooling: the "nothing is ever hard-deleted" rule (implementation.md
-- §4.3) governs the application, not the resetting of test fixtures.

begin;

create temporary table test_owned_events on commit drop as
  select id from event.events
  where owner_id in (
    '00000000-0000-0000-0000-000000000001', -- organiser@connectsphere.test
    '00000000-0000-0000-0000-000000000007'  -- organiser2@connectsphere.test
  );

delete from event.event_history  where event_id in (select id from test_owned_events);
delete from event.clarifications where event_id in (select id from test_owned_events);
delete from event.assignments    where event_id in (select id from test_owned_events);
delete from event.outbox         where message_key in (select id::text from test_owned_events);
delete from event.events         where id in (select id from test_owned_events);

-- Coordinator assignment starts from the first coordinator in the pool again.
update event.assignment_cursor set next_index = 0 where id = true;

commit;
