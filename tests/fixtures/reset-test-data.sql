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

-- I2's record of which block flagged which booking, hold or request, and the messages a block
-- wrote, keyed by the block. Before the requests, slots and blocks they point at.
delete from venue.block_disruptions where block_id in (
  select id from venue.unavailability_blocks where venue_id in (select id from test_owned_venues));
delete from venue.block_disruptions where booking_request_id in (
  select id from venue.booking_requests where event_id in (select id from test_owned_events));
delete from venue.outbox where message_key in (
  select id::text from venue.unavailability_blocks where venue_id in (select id from test_owned_venues));

-- H3-T10's record of which booking a venue's new times made overlap which, and the messages
-- it wrote, keyed by the flagged slot. Before the slots they point at. H3-T11: a side may be a
-- pending request, which may be the seeded organisers' at another venue, so before the requests.
delete from venue.buffer_conflicts where venue_id in (select id from test_owned_venues);
delete from venue.buffer_conflicts where booking_request_id in (
    select id from venue.booking_requests where event_id in (select id from test_owned_events))
  or other_booking_request_id in (
    select id from venue.booking_requests where event_id in (select id from test_owned_events));
delete from venue.outbox where message_key in (
  select id::text from venue.venue_slots where venue_id in (select id from test_owned_venues));

-- L3's holds at those venues or for the seeded organisers' events, with their outbox messages.
-- Before the slots and the requests a hold points at.
delete from venue.outbox where message_key in (
  select id::text from venue.holds
  where venue_id in (select id from test_owned_venues) or event_id in (select id from test_owned_events));
delete from venue.holds
  where venue_id in (select id from test_owned_venues) or event_id in (select id from test_owned_events);

-- S3's record of which approved change flagged which booking, hold or request, at those
-- venues or for the seeded organisers' events. Before the slots and requests it points at.
-- Skipped where migration venue/0018 isn't applied yet.
do $$
begin
  if to_regclass('venue.arrangement_flags') is not null then
    delete from venue.arrangement_flags
      where event_id in (select id from test_owned_events)
         or slot_id in (select id from venue.venue_slots where venue_id in (select id from test_owned_venues))
         or booking_request_id in (select id from venue.booking_requests where venue_id in (select id from test_owned_venues));
  end if;
end $$;

-- Booking requests (L1, L2) at those venues or for the seeded organisers' events, with their
-- outbox messages. Before the slots, which a replacement request may point at (CR-02).
delete from venue.outbox where message_key in (
  select id::text from venue.booking_requests
  where venue_id in (select id from test_owned_venues) or event_id in (select id from test_owned_events));
delete from venue.booking_requests
  where venue_id in (select id from test_owned_venues) or event_id in (select id from test_owned_events);
delete from venue.venue_slots           where venue_id in (select id from test_owned_venues);
delete from venue.unavailability_blocks where venue_id in (select id from test_owned_venues);
delete from venue.venue_history where venue_id in (select id from test_owned_venues);
delete from venue.venue_staff   where venue_id in (select id from test_owned_venues);
delete from venue.venues        where id in (select id from test_owned_venues);

-- Equipment the seeded Technical Support account created (P2), including all
-- audit, reservation, unavailability, unit and request line rows that refer to those types.
-- Request lines and their reservations go first: reservations reference lines (Q1).
create temporary table test_owned_equipment on commit drop as
  select id from equipment.equipment_types
  where created_by = '00000000-0000-0000-0000-000000000004'; -- techsupport@connectsphere.test

-- Equipment request lines (O1, O2) for those events or those types, with their history and the
-- notification messages their status changes wrote. Lines carry no foreign key to an event.
create temporary table test_owned_lines on commit drop as
  select id from equipment.equipment_request_lines
  where event_id in (select id from test_owned_events)
     or equipment_type_id in (select id from test_owned_equipment)
     or substitute_equipment_type_id in (select id from test_owned_equipment);

delete from equipment.outbox
  where message_key in (select id::text from test_owned_lines);
delete from equipment.request_line_history
  where line_id in (select id from test_owned_lines);

-- Q1: the reservations of those lines, and the unit and bulk rows each one groups. A
-- reservation's type is its line's type or substitute, so every reservation of a test-owned
-- type belongs to a test-owned line. Skipped where migration equipment/0005 isn't applied yet.
do $$
begin
  if to_regclass('equipment.reservations') is not null then
    -- S3's flags on those reservations, before the reservations. Skipped where migration
    -- equipment/0009 isn't applied yet.
    if to_regclass('equipment.reservation_flags') is not null then
      delete from equipment.reservation_flags
        where reservation_id in (select id from equipment.reservations
                                 where request_line_id in (select id from test_owned_lines)
                                    or equipment_type_id in (select id from test_owned_equipment));
    end if;
    delete from equipment.unit_reservations
      where reservation_id in (select id from equipment.reservations
                               where request_line_id in (select id from test_owned_lines));
    delete from equipment.bulk_reservations
      where reservation_id in (select id from equipment.reservations
                               where request_line_id in (select id from test_owned_lines));
    delete from equipment.reservations
      where request_line_id in (select id from test_owned_lines);
  end if;
end $$;

delete from equipment.equipment_request_lines
  where id in (select id from test_owned_lines);

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
