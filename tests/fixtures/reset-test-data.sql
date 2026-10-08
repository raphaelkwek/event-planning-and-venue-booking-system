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

delete from event.event_history            where event_id in (select id from test_owned_events);
delete from event.clarifications           where event_id in (select id from test_owned_events);
delete from event.reassignment_proposals   where event_id in (select id from test_owned_events);
delete from event.assignments              where event_id in (select id from test_owned_events);
delete from event.outbox                   where message_key in (select id::text from test_owned_events);
delete from event.events                   where id in (select id from test_owned_events);

-- Coordinator assignment starts from the first coordinator in the pool again.
update event.assignment_cursor set next_index = 0 where id = true;

-- Venues the seeded Venue Staff account created (H1), with their history, staff links,
-- slots and unavailability blocks (FX-CALENDAR, I1).
create temporary table test_owned_venues on commit drop as
  select id from venue.venues
  where created_by = '00000000-0000-0000-0000-000000000003'; -- venuestaff@connectsphere.test

delete from venue.venue_slots           where venue_id in (select id from test_owned_venues);
delete from venue.unavailability_blocks where venue_id in (select id from test_owned_venues);
delete from venue.venue_history where venue_id in (select id from test_owned_venues);
delete from venue.venue_staff   where venue_id in (select id from test_owned_venues);
delete from venue.venues        where id in (select id from test_owned_venues);

-- Equipment the seeded Technical Support account created (P2), including all
-- audit, reservation, unavailability and unit rows that refer to those types.
create temporary table test_owned_equipment on commit drop as
  select id from equipment.equipment_types
  where created_by = '00000000-0000-0000-0000-000000000004'; -- techsupport@connectsphere.test

delete from equipment.inventory_history
  where equipment_type_id in (select id from test_owned_equipment);
delete from equipment.unit_reservations
  where unit_id in (
    select id from equipment.equipment_units
    where equipment_type_id in (select id from test_owned_equipment)
  );
delete from equipment.bulk_reservations
  where equipment_type_id in (select id from test_owned_equipment);
delete from equipment.unavailability
  where equipment_type_id in (select id from test_owned_equipment);
delete from equipment.equipment_units
  where equipment_type_id in (select id from test_owned_equipment);
delete from equipment.equipment_types
  where id in (select id from test_owned_equipment);

-- The seeded accounts' notifications (T2), and the inbox rows of the messages that raised them.
create temporary table test_notification_messages on commit drop as
  select distinct source_message_id as message_id from notification.notifications
  where recipient_user_id::text like '00000000-0000-0000-0000-00000000000_';

delete from notification.notifications
  where recipient_user_id::text like '00000000-0000-0000-0000-00000000000_';
delete from notification.consumed_messages
  where message_id in (select message_id from test_notification_messages)
    and not exists (select 1 from notification.notifications n where n.source_message_id = message_id);

commit;
