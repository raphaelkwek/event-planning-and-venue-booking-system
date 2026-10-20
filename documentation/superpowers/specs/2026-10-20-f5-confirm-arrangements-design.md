# F5 — Confirm an event only when venue and equipment are ready (SPM-109): design

**Date:** 2026-10-20 · **Author:** Shawmya, via Claude · **Sprint:** 4 ·
**Branch:** `feature-shawmya/f5-confirm-arrangements`

## 1. The story

As an assigned Event Coordinator, I want to confirm an event only once both the venue and the equipment
are actually arranged, so that a Confirmed event is one I can rely on rather than one that is still
missing something. Revision 4 (CR-03, CR-06).

| # | Acceptance criterion |
|---|---|
| AC1 | Confirmation is performed by the assigned Event Coordinator, on an event in status Approved or Planning. |
| AC2 | Refused unless the event has at least one venue booking and every active venue booking for it is confirmed (L4; CQ-05). A tentative hold (L3) is not sufficient. |
| AC3 | Refused unless the equipment arrangements are complete: every request line reserved in full, or the event marked as requiring no equipment. A partially reserved line is not complete. |
| AC4 | Both conditions are read live from the booking and reservation records at the moment of confirmation; no stored or cached readiness value. |
| AC5 | If either cannot be retrieved, confirmation is refused and nothing is changed. |
| AC6 | A refusal names which arrangement is outstanding, and for equipment the specific lines not reserved in full. |
| AC7 | Refused while any arrangement carries a Requires Reconfirmation or unsuitable flag (I2, S3); the refusal names the flags. |
| AC8 | On success the status becomes Safety Review and the event enters the Safety Officer's queue (U1); the acting coordinator and timestamp are recorded, with a history entry as for any transition (F1). Confirmed only on the Safety Officer's approval. |
| AC9 | The owning organiser is notified, as are the Venue Staff of each booked venue and the Technical Support Staff of any reservation. |
| AC10 | A refused confirmation changes no status, no booking, and no reservation. |

## 2. Decisions (confirmed with Shawmya, 2026-10-20)

1. **CQ-05 is unanswered; build "every", as AC2 reads.** Ready means at least one CONFIRMED booking,
   and no HELD hold and no PENDING booking request left for the event. Released and expired slots, and
   approved, rejected and withdrawn requests, are not active. The rule is one function,
   `venueOutstanding` in `change/domain/readiness.ts`, so "one is enough" is a one-line change.
2. **Flags: what exists now, with a hook for S3.** I2's `requires_reconfirmation` on slots and pending
   requests is checked. S3 (not built) adds "unsuitable" on bookings and "flagged for review" on
   reservations. No column holds either yet, so each arrangement the venue and equipment modules return
   carries `flags: ArrangementFlag[]`. S3 adds its flag kinds to that union and sets them in the same
   reads. Nothing else changes. Cards for the unsuitable flag are `Blocked` on S3.
3. **Equipment:**
   - **Marked "no equipment" (`equipment_required = false`):** complete, with or without lines, as AC3's
     "or" reads.
   - **Equipment required (true, or null on a legacy row):** there must be at least one active line
     (not REMOVED). Zero lines is outstanding ("no equipment has been requested"), because AC3 names
     "marked as requiring no equipment" as the only way for an event without lines to be complete.
   - **A line is reserved in full** when its status is RESERVED and its active reservation's
     `reserved_quantity` equals its `requested_quantity` (Q1 sets requested from the line, or from O2's
     substitute). Every other line is outstanding, named with its type, its quantity and either its
     status or "n of m reserved".
4. **The acting coordinator and the timestamp** are recorded by the F1 history entry
   (`CONFIRM_ARRANGEMENTS`, actor, role, `occurred_at`). No new event columns or migration.
5. **One core transaction** (implementation.md §4.7, ADR-0004). The event row is locked `for update`;
   then the event's slots, requests, lines and reservations are read `for share`; then the transition
   is written. A Q2 release, an I2 flag or an M1 decision on those rows waits for the confirmation to
   commit, so nothing read can change before the status does. A change after commit is S3's to flag.
   Lock order is event → venue rows → equipment rows. No other path locks those rows and then the
   event (S2 is request → event; M1, Q1 and Q2 don't lock the event), so there is no cycle.
   **Residual:** a *new* booking request inserted while the confirmation runs is not seen (an insert
   isn't blocked by a share lock). Only the assigned coordinator raises requests, so they would be
   racing themselves.
6. **"Cannot be retrieved" (AC5)** means a read of the venue or equipment records fails: a statement
   timeout, a lost connection or any other database error. The transaction rolls back (nothing is
   changed) and the API answers `503 ARRANGEMENTS_UNAVAILABLE`. A stored readiness value is never
   kept, so there is nothing to fall back to.
7. **Order of checks:** not found / out of scope (404) → not the assigned coordinator (403) → status
   not Approved or Planning (409, F1's message naming both statuses) → readiness (422). A refusal
   writes nothing.
8. **The Safety Officer's queue** is U1's to build. F5's part is the status: an event in Safety Review
   is what that queue lists.

## 3. Data

No migration. Read only:

| Module | Rows | Read through |
|---|---|---|
| venue | `venue_slots` (HELD, CONFIRMED) with `requires_reconfirmation`; `booking_requests` (PENDING) with `requires_reconfirmation`; `venue_staff` of each confirmed booking's venue | `venueArrangementsForEvent(tx, eventId)` in `venue/index.ts` |
| equipment | `equipment_request_lines` (not REMOVED) and their RESERVED `reservations`, with the type's name | `equipmentArrangementsForEvent(tx, eventId)` in `equipment/index.ts` |
| event | the event, locked; the transition and history | `findEventForChange(…, { lock: "update" })`, and a new `confirmEventArrangements(tx, event, actor, notice)` in `event/index.ts` |

## 4. Operations

- **Venue module:** `venueArrangementsForEvent(tx, eventId)` returns `{ bookings, requests }`.
  - Each booking has `{ id, reference, venueId, venueName, startsAt, endsAt, status, flags, staffIds }`.
  - Each request has `{ id, reference, venueName, startsAt, endsAt, flags }`.
  - It takes the rows `for share`.
- **Equipment module:** `equipmentArrangementsForEvent(tx, eventId)` returns the event's active lines in
  list order: `{ id, equipmentTypeName, quantity, status, reservation: { id, requestedQuantity,
  reservedQuantity, reservedBy } | null, flags }`. It takes the rows `for share`.
- **Event module:**
  - `arrangementsConfirmationRefusal(status)` returns F1's refusal message, or null when
    `CONFIRM_ARRANGEMENTS` is permitted.
  - `confirmEventArrangements(tx, eventId, actor, notice)` runs `transitionEvent(… "CONFIRM_ARRANGEMENTS")`
    (history included) and writes `event.arrangements-confirmed` to the event outbox in the same
    transaction.
- **Change module:**
  - `assessReadiness(input)` (domain, pure) returns `{ ready: true }` or `{ ready: false, venue[],
    equipment[], flags[], message }`.
  - `confirmArrangements(tx, eventId, actor)` (repo) runs §2.7's checks, reads both modules (an error
    there becomes `ArrangementsUnavailableError`), assesses, and on ready calls the event module.

**Refusal message.** It starts "This event can't be confirmed yet." and then adds one sentence per
outstanding kind, e.g.:

- "Venue: no venue booking is confirmed." (or "Venue: hold <reference> at Lee Kong Chian Auditorium is only a
  tentative hold; booking request BKR-000012 at Seminar Room 2-1 is still pending.")
- "Equipment: Projector × 2 is Submitted; Chairs × 5 has 3 of 5 reserved."
- "Outstanding flags: booking BKR-… at Lee Kong Chian Auditorium requires reconfirmation."

The same facts are in `details` (`venue`, `equipment`, `flags`) for the screen.

## 5. API

`POST /api/v1/events/{id}/confirmation`, no body, Event Coordinator role (assignment checked inside).
Mounted by the change module.

| Case | Response |
|---|---|
| Confirmed | 200 `{ event: { id, reference, status: "SAFETY_REVIEW", previousStatus, confirmedBy, confirmedAt } }` |
| Unknown id / out of scope | 404 `EVENT_NOT_FOUND` |
| Not the assigned coordinator, or another role | 403 `ROLE_NOT_AUTHORISED` |
| Status not Approved or Planning | 409 `STATUS_TRANSITION_NOT_PERMITTED` (F1's message) |
| Arrangements outstanding or flagged | 422 `ARRANGEMENTS_NOT_READY` (details: venue, equipment, flags) |
| Venue or equipment records unreadable | 503 `ARRANGEMENTS_UNAVAILABLE` |

**Contracts (reviewed PR):**

- error codes `ARRANGEMENTS_NOT_READY` and `ARRANGEMENTS_UNAVAILABLE`;
- message type `event.arrangements-confirmed` on `KAFKA_TOPICS.event`, with data `{ eventId,
  eventReference, eventName, ownerId, confirmedBy, confirmedAt, bookings: [{ bookingId, reference,
  venueName, startsAt, endsAt, staffIds[] }], reservations: [{ reservationId, equipmentTypeName,
  reservedQuantity, reservedBy }] }`;
- OpenAPI path and codes.

**Notification rule** (notification service), one per recipient:

- **The owner:** "Your event EVT-… “name” has its venue and equipment confirmed. It is now in Safety
  Review, awaiting the Safety Officer."
- **Each booking's Venue Staff:** "Event EVT-… “name” has confirmed its arrangements, including booking
  BKR-… at <venue>, <period>. It is now in Safety Review."
- **Each distinct `reservedBy`:** "Event EVT-… “name” has confirmed its arrangements, including the
  equipment you reserved: Projector × 2, Chairs × 5. It is now in Safety Review."

## 6. Screen

On the coordinator's event page (`ReviewDetail`), the assigned coordinator sees "Confirm arrangements"
while the event is Approved or Planning.

- **Clicking it** opens a modal: "Confirm the venue and equipment arrangements? The event moves to Safety
  Review, where the Safety Officer reviews it before it becomes Confirmed." → "Confirm arrangements".
- **A refusal** shows inline in the modal (§7.1): the server's message, plus lists of the outstanding
  venue items, equipment lines and flags from `details`.
- **On success** the modal closes and the status lozenge reads Safety Review. The history shows the
  entry.

## 7. Tests

Cards in `tests/F5/`, written before the code, with fixture **FX-F5**, an API-level fixture in
`tests/F5/README.md`:

- **Event E1:** Approved, owned by ORG, assigned to C1, `D 14:00`–`D 18:00`, equipment required.
- **Venue V1:** looked after by VS. Its booking B1 (CONFIRMED) covers E1's window.
- **Equipment:** line L1 is Chairs × 5 (bulk, total 10), reserved in full by TS.

Named tests are in `tests/change/api/f5Cards.test.ts`.

| Card | AC | Case |
|---|---|---|
| F5-T1 | 1, 8 | Happy path: C1 confirms FX-F5 → 200 Safety Review; history APPROVED → SAFETY_REVIEW, C1, `CONFIRM_ARRANGEMENTS`, time |
| F5-T2 | 1, 8 | From Planning → Safety Review |
| F5-T3 | 3 | Event marked "no equipment", no lines → 200 |
| F5-T4 | 1 | Status partition: Draft, Submitted, Under Review, Awaiting Clarification, Safety Review, Confirmed, Completed, Cancelled, Rejected → 409 naming the status; nothing written |
| F5-T5 | 1 | C2 (not assigned), ORG, VS, TS, ATT → 403; unknown id → 404; nothing written |
| F5-T6 | 2, 6, 10 | No booking at all → 422 naming the venue as outstanding; nothing written |
| F5-T7 | 2, 6, 10 | Only a tentative hold → 422 naming the hold; hold still HELD |
| F5-T8 | 2, 6 | One confirmed booking plus one pending request (L4, CQ-05) → 422 naming the pending request |
| F5-T9 | 2 | Two confirmed bookings at two venues (L4) → 200 |
| F5-T10 | 3, 6, 10 | Partial reservation, boundary: 4 of 5 → 422 naming "Chairs × 5: 4 of 5 reserved"; reservation unchanged |
| F5-T11 | 3 | Boundary: exactly 5 of 5 → 200 (same as T1, stated against T10) |
| F5-T12 | 3, 6 | Two lines, one Submitted and one Confirmed but not reserved → 422 naming both; the reserved line is not named |
| F5-T13 | 3, 6 | Equipment required with no lines → 422 "no equipment has been requested" |
| F5-T14 | 6 | Both outstanding → 422 naming venue and equipment in one refusal |
| F5-T15 | 7, 10 | Booking requires reconfirmation (I2 block) → 422 naming the flag; flag kept |
| F5-T16 | 7 | Unsuitable flag (S3) → 422 naming it — **Blocked on S3** |
| F5-T17 | 4 | Live read: a reservation released (Q2) just before → 422, even though it was reserved earlier |
| F5-T18 | 5 | The venue or equipment read fails → 503 `ARRANGEMENTS_UNAVAILABLE`; nothing written |
| F5-T19 | 9 | Notifications: ORG, VS (each booked venue) and TS (each reserver) are each notified once, naming the event |
| F5-T20 | 10 | After any refusal: event status, slots and reservations, history and outbox are byte-for-byte unchanged (checked in T4–T15) |
| F5-T21 | all | Browser walkthrough (manual) |

Also: domain unit tests for `assessReadiness` at 100%; a contract example for the new message; a
notification rule test; a web test for the button and the refusal; F1-T7 executed; `sprint-4.csv` rows.

## 8. Out of scope

U1 (the Safety Officer's queue and decision), S3 (setting unsuitable and review flags), and CQ-05's
final answer.
