# A4 — Act only on the events assigned to me (CR-05)

Fifteen cases, written from the story (revision 5, with the Week 9 answers) on 2 Nov 2026,
before the code. T1 to T13 are API-level procedures: HTTP requests with authentication stubbed,
against a migrated throwaway Postgres, automated one test per card. T14 is the signed-in browser
walk-through, done by hand. T15 waits for F3.

A4 replaces part of A3 (coordinators saw every event) and part of D1 (the queue held every assigned
request). Both stay Done; their cases are updated in the same PR and name A4.

| Acceptance criterion | Cases |
|---|---|
| A coordinator performs coordinator actions (D2–D5, F3–F5, G1, L1–L6, O1, S2) only on events assigned to them; on any other event the action is refused, nothing is stored, and the message states that the event is not assigned to them | A4-T4, A4-T5, A4-T6, A4-T7, A4-T8, A4-T10, A4-T15 |
| A coordinator's review queue (D1) and event list contain only the events assigned to them | A4-T1, A4-T2, A4-T10, A4-T14 |
| Week 9 (CQ-07): coordinators manage only events the Lead assigned them and cannot claim an unassigned one; the Lead does not coordinate | A4-T3, A4-T9, A4-T12 |
| The Lead sees all events and all assignments (E5) | A4-T11, A4-T14 |
| The Lead is an internal role governed by A2: its own permitted functions, and navigation shows only those | A4-T9, A4-T12, A4-T14 |
| Filtering is applied when a list is retrieved, so an event outside the coordinator's assignments returns no event data (as in A3) | A4-T1, A4-T3, A4-T13 |

## Decisions these cases follow

Agreed with the story owner on 2 Nov 2026, before the cases were written:

- **A coordinator sees no trace of an event not assigned to them (CQ-11 is open).** Lists, the event
  page and every read beneath it (history, clarifications, venue requests, holds, equipment lines)
  treat the event as if it did not exist. If the customer's CQ-11 answer allows read-only viewing,
  T3 and T13 change; the action cases do not.
- **One refusal for "not yours" and "does not exist".** An action on an event the coordinator isn't
  assigned to answers HTTP 404 `EVENT_NOT_FOUND`, "No event with that reference is assigned to you."
  A made-up id gets the same answer. The message states that the event is not assigned to them (AC1)
  without revealing that it exists (`implementation.md` §6).
- **An action on a record that belongs to an event** (a booking request, a hold, an equipment line, a
  change request) answers that record's 404 code with the same wording:

  | Record | Code | Message |
  |---|---|---|
  | Booking request | `BOOKING_REQUEST_NOT_FOUND` | No booking request with that id is on an event assigned to you. |
  | Hold | `HOLD_NOT_FOUND` | No hold with that id is on an event assigned to you. |
  | Equipment line | `EQUIPMENT_LINE_NOT_FOUND` | No equipment request line with that id is on an event assigned to you. |
  | Change request | `CHANGE_REQUEST_NOT_FOUND` | No change request with that id is on an event assigned to you. |

- **Reassignment moves access at once.** After the Lead reassigns an event (E4), the previous
  coordinator gets "not found" for it, including from old links and notifications.

## Partitions

A coordinator's relationship to an event is one of: assigned to them (E1, E2, E6), assigned to
another coordinator (E4), unassigned (E3), or someone else's draft (E5). Every list and read case
covers all four. Reassignment (T10) is the boundary between "assigned to them" and "assigned to
another": the same event, one moment either side.

D3 is the organiser's answer to a clarification, so A4 restricts no coordinator action there. The
coordinator's side of it, reading the answer, is covered by T13.

## Fixture FX-A4 (API level)

- **Actors:** C1 (Coordinator One), C2 (Coordinator Two), LEAD (Event Coordinator Lead), ORG (the
  owner of every event), VS (Venue Staff of V1), TS (Technical Support).
- **Events,** all owned by ORG, proposed `D 14:00`–`D 18:00` UTC, D sixty days ahead
  (`tests/support/eventDates.ts`):

  | Event | Name | Status | Assigned to |
  |---|---|---|---|
  | E1 | `A4 Under Review` | Under Review | C1 |
  | E2 | `A4 Approved` | Approved, equipment required | C1 |
  | E3 | `A4 Unassigned` | Submitted | nobody (the Lead's queue) |
  | E4 | `A4 Other Coordinator` | Under Review | C2 |
  | E5 | `A4 Draft` | Draft | — |
  | E6 | `A4 Submitted` | Submitted | C1 (as FX-ASSIGNED) |

- **Venue** V1 `A4 Hall`, looked after by VS, open on D's weekday; V2 `A4 Annex`, the same.
- **On E2:** booking request BR1 for V1, Pending, by C1; hold H1 on V2, Requested, by C1; equipment
  type `A4 Chairs` (bulk, total 10) and line EL1 `A4 Chairs` × 5, by C1; change request CR1, Pending,
  raised by ORG, proposing expected attendance `120`.

Every refusal card snapshots, before and after its steps: the event rows (status, version, fields),
their status history, clarifications, booking requests, holds and slots, equipment lines, change
requests and the event outbox. "Nothing stored" means each reads exactly as before.
