# M1 — Approve a venue booking request

Eleven cases, written from the story on 18 Oct 2026, before the code. They use FX-BOOKING
(`tests/L1/README.md`) and the requests L1 raises.

| Acceptance criterion | Cases |
|---|---|
| The queue shows pending requests for the approver's own venues, with booking reference, event reference, date and period, layout, attendance, requesting coordinator, and any K2 justification | M1-T1, M1-T2 |
| Approval sets the request Approved, creates a confirmed booking, and records the approving Venue Staff member and the timestamp | M1-T3 |
| Approval is refused when the period now overlaps a confirmed booking or recorded unavailability; the message names it, no booking is created, the request stays Pending | M1-T4, M1-T5 |
| CR-01: the overlap check uses occupied periods | M1-T6 |
| A confirmed booking makes the venue unavailable on the calendar (I1) and excludes it from search (J1) for that period | M1-T7 |
| The requesting coordinator and the owning organiser are notified of the approval | M1-T8 |
| An already-decided request cannot be approved again, and no second approval timestamp is written | M1-T9 |
| CR-02: approving a replacement releases the disrupted booking with the reason "replaced"; its record is kept | M1-T10 |

M1-T11 checks that only the venue's own Venue Staff can decide its requests.

**M1-T2 waits for K2,** which records the unsuitability justification with the request. Until K2 is
built no request carries one, so the case stays Not Executed, owned by K2.

**Overlaps are Postgres's decision** (ADR-0006): the venue's row is locked, then the confirmed booking
is inserted, and the exclusion constraint on `venue.venue_slots` refuses an overlapping one (N1).
Recorded unavailability is checked with `&&` under the same lock. Each booking keeps its own setup
and turnaround (CR-01); until H3 lands, venues have none, so a new booking's are zero.

## M1 booking statement

Another event's confirmed booking at `Lee Kong Chian Auditorium` on 2 December 2026. Replace
`<START>`, `<END>`, `<SETUP>` and `<TURNAROUND>` with the case's values. It creates the event too,
owned by `organiser@connectsphere.test`, so `npm run test-cases:reset` removes both. It returns the
booking's **id** and the event's **reference**.

~~~sql
with other as (
  insert into event.events (
    reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
    expected_attendance, equipment_required, registration_required, status, submitted_at,
    last_saved_at, created_by, updated_by
  ) values (
    'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'),
    '00000000-0000-0000-0000-000000000001', 'Other Department Seminar', 'An M1 fixture',
    'Another event already booked at the venue.', timestamptz '2026-12-02 <START>+08',
    timestamptz '2026-12-02 <END>+08', 100, false, false, 'PLANNING', now(), now(),
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'
  )
  returning id, reference
)
insert into venue.venue_slots
  (venue_id, event_id, reference, starts_at, ends_at, setup_minutes, turnaround_minutes, status,
   created_by, updated_by)
select v.id, other.id, 'M1-FX-' || other.reference, timestamptz '2026-12-02 <START>+08',
       timestamptz '2026-12-02 <END>+08', <SETUP>, <TURNAROUND>, 'CONFIRMED',
       '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003'
from venue.venues v, other
where v.name = 'Lee Kong Chian Auditorium' and v.created_by = '00000000-0000-0000-0000-000000000003'
returning id, (select reference from other) as event_reference;
~~~

## M1 block statement

Recorded unavailability at `Lee Kong Chian Auditorium` on 2 December 2026, as I2 will record it.
Replace `<START>`, `<END>`, `<TYPE>` and `<REASON>`.

~~~sql
insert into venue.unavailability_blocks
  (venue_id, starts_at, ends_at, reason_type, description, status, created_by, updated_by)
select v.id, timestamptz '2026-12-02 <START>+08', timestamptz '2026-12-02 <END>+08', '<TYPE>', '<REASON>',
       'ACTIVE', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003'
from venue.venues v
where v.name = 'Lee Kong Chian Auditorium' and v.created_by = '00000000-0000-0000-0000-000000000003'
returning id;
~~~
