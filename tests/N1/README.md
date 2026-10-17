# N1 — Prevent double-booking of a venue

Eight cases, written from the story on 18 Oct 2026, before the code. They use FX-BOOKING
(`tests/L1/README.md`) and the requests L1 raises.

| Acceptance criterion | Cases |
|---|---|
| Periods overlap when one starts before the other ends and ends after the other starts; bookings that only touch are both permitted | N1-T2, N1-T4 |
| CR-01: the periods compared are occupied periods, setup and turnaround included; occupied periods that only touch are both permitted | N1-T5 |
| Confirmation is atomic: of two simultaneous approvals for overlapping periods at a venue, exactly one confirms | N1-T6 |
| The refused approval creates no confirmed booking, leaves its request Pending, and names the conflicting event reference and period | N1-T2, N1-T6 |
| The existing confirmed booking is unchanged by a refused competing approval | N1-T3 |
| Withdrawn, Rejected, Cancelled and Released bookings never block a new booking for the same period | N1-T7 |
| The same overlap rule is applied by venue search (J1), unavailability blocks (I2) and booking approval (M1) | N1-T8, and N1-T1 to N1-T7 for approval |

N1-T1 is the happy path: an approval for a free period confirms the booking.

## How N1 and M1 divide the approval

N1 is the rule that approval enforces, so it can't be tested without an approval. M1 built the
approval on 18 Oct 2026, and N1's branch builds on M1's: Venue Staff of the venue click "Approve" in their "Booking
requests" queue, the request becomes Approved and a confirmed booking is created, or the approval is
refused and nothing changes. These cases test the double-booking rule through that action. M1's own
cases cover the rest of its story: the queue, recorded unavailability, the notifications and CR-02.

**I2 isn't built yet,** so N1-T8 checks venue search and the calendar; unavailability blocks take
the same rule when I2 lands.

## The rule

- Two periods overlap when one starts before the other ends and ends after the other starts. A
  period includes its start but not its end, so 10:00–14:00 and 14:00–18:00 only touch.
- A booking's occupied period runs from its start minus its setup time to its end plus its
  turnaround time (CR-01). Each booking keeps the setup and turnaround it was made with (EN-02.1).
  Until H3 lands, venues have no setup or turnaround of their own, so a new booking's are zero;
  N1-T5 gives the *existing* booking its buffers with the N1 booking statement.
- Only holds and confirmed bookings block. A cancelled event's bookings are released (F4), so
  "cancelled" and "released" are both a booking with status `RELEASED`; withdrawn and rejected are
  requests, which never block anything.
- Postgres decides, with the exclusion constraint on `venue.venue_slots` (EN-02.1, ADR-0006). The
  venue's row is locked first, so two approvals at once queue and the second meets the first's
  committed booking (implementation.md §4.6).

## N1 booking statement

Another event's confirmed booking at `Lee Kong Chian Auditorium` on 2 December 2026. Replace
`<START>`, `<END>`, `<SETUP>` and `<TURNAROUND>` with the case's values. It creates the event too,
owned by `organiser@connectsphere.test`, so `npm run test-cases:reset` removes both. It returns the
event's **reference** and the booking's **id**.

~~~sql
with other as (
  insert into event.events (
    reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
    expected_attendance, equipment_required, registration_required, status, submitted_at,
    last_saved_at, created_by, updated_by
  ) values (
    'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'),
    '00000000-0000-0000-0000-000000000001', 'Other Department Seminar', 'An N1 fixture',
    'Another event already booked at the venue.', timestamptz '2026-12-02 <START>+08',
    timestamptz '2026-12-02 <END>+08', 100, false, false, 'PLANNING', now(), now(),
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'
  )
  returning id, reference
)
insert into venue.venue_slots
  (venue_id, event_id, reference, starts_at, ends_at, setup_minutes, turnaround_minutes, status,
   created_by, updated_by)
select v.id, other.id, 'N1-FX-' || other.reference, timestamptz '2026-12-02 <START>+08',
       timestamptz '2026-12-02 <END>+08', <SETUP>, <TURNAROUND>, 'CONFIRMED',
       '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003'
from venue.venues v, other
where v.name = 'Lee Kong Chian Auditorium' and v.created_by = '00000000-0000-0000-0000-000000000003'
returning id, (select reference from other) as event_reference;
~~~

## N1 release statement (N1-T7)

What F4's cancellation or L5's replacement does to a booking. Replace `<ID>` with the booking's id.

~~~sql
update venue.venue_slots set status = 'RELEASED', updated_at = now() where id = '<ID>';
~~~

## N1 second event statement (N1-T6, N1-T7)

A second Approved event for 2 December 2026, 16:00–20:00, owned by `organiser@connectsphere.test`
and assigned to the coordinator FX-BOOKING's event has. Replace `<COORDINATOR_ID>` with that
coordinator's id (Accounts table, `tests/README.md`). It returns the event's **id** and
**reference**.

~~~sql
with second as (
  insert into event.events (
    reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
    expected_attendance, equipment_required, registration_required, status, submitted_at,
    last_saved_at, created_by, updated_by
  ) values (
    'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'),
    '00000000-0000-0000-0000-000000000001', 'Faculty Awards Night', 'An N1 fixture',
    'A second event wanting the same venue.', timestamptz '2026-12-02 16:00+08',
    timestamptz '2026-12-02 20:00+08', 150, false, false, 'APPROVED', now(), now(),
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'
  )
  returning id, reference
),
assigned as (
  insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
  select id, '<COORDINATOR_ID>', 'TEST', '<COORDINATOR_ID>', '<COORDINATOR_ID>' from second
)
select id, reference from second;
~~~
