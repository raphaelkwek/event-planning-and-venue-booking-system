# F4 — Release the arrangements of a cancelled event

Eight cases, written from the story (SPM-111) on 29 Oct 2026, following the design in
`documentation/superpowers/specs/2026-10-29-f3-f4-cancel-event-design.md` (section 4 is the card table). F4-T1 to F4-T7 are API-level
procedures (HTTP requests with authentication stubbed, against a migrated throwaway Postgres), automated one test per card in
`backend/services/planning-core/tests/change/api/f4Cards.test.ts`. F4-T4 is automated only: the release is forced to fail inside the test.
F4-T8 is the signed-in browser walkthrough, done by hand.

| Acceptance criterion | Cases |
|---|---|
| AC1: release is triggered by cancellation (F3), for every booking, hold, reservation and registration | F4-T1, F4-T8 |
| AC2: bookings and holds are released; the venue is available again in the calendar (I1) and search (J1) | F4-T1, F4-T2, F4-T8 |
| AC3: reservations are released; the quantities are available again | F4-T3, F4-T8 |
| AC4: registrations and waitlist entries become Cancelled, and attendees are told | F4-T7 (Blocked on #80 and #88) |
| AC5: all or nothing; the user is told when the cancellation did not complete | F4-T4 |
| AC6: released records are kept, with the reason, the user and the time | F4-T5 |
| AC7: releasing again changes nothing; a retried cancellation reaches the same end state | F4-T6 |

## How F4 works

F4 adds the releases to F3's cancellation transaction (`change/repo/cancelEvent.ts`), through the functions L4 and Q2 built for it:
`releaseVenueArrangementsForEvent` (venue module) and `releaseEventReservations` (equipment module). Every release records the reason
`event cancelled`, the cancelling user and the time. Any failure rolls the cancellation back with them (500 `CANCELLATION_FAILED`).

Lock order: the pending change request, then the rows of the event's venues in ascending id, then the event, then the holds, requests and
slots. This is the venue module's order (implementation.md §4.6: venue rows, then event rows, then holds, requests and slots). I2's block
locks the venue and then the events it returns to Planning, so a block and a cancellation of an event booked at that venue queue on the
venue instead of deadlocking. The cancellation used to lock the event first; the review of #72 found the deadlock, and
`f4Cards.test.ts` › `F4 lock order` races the two deterministically. A hold or request at a venue the cancellation had not
locked, committed between its venue locks and its event lock, would have had its venue locked after the event; since the follow-up
review (#91) the cancellation reads the event's venues again once it holds the event and, if it gained one, writes nothing and tries
again with that venue locked first (up to three attempts, then 409 `CANCELLATION_CONTENDED`).

## What F4 does not do

Registrations and the waitlist (AC4) are not released in F4's transaction, because they live in the registration service (EN-13, merged
30 Oct in #73), whose schema planning-core never reads. That service cancels the event's registrations and waitlist entries, retires its
seats and tells the attendees when it consumes `event.cancelled` from `connectsphere.event.v1`: R1–R4 (#80) and R5–R7 (#88) build that
consumer. Until they merge, F4-T7 is Blocked and `released.registrations` is always 0. ADR-0009's CancelEvent Temporal workflow is not
built; the consumer takes its place. Venue search (J1) is not called by the cards: it reads the same slots as the calendar, and FX-F4's period is
outside any opening hours a test venue would have.

## Fixture FX-F4 (API level)

FX-F3's actors (`tests/F3/README.md`), with:

- Event E: owned by O, assigned to C, status Planning, `D 14:00`–`D 18:00` UTC.
- Venue V1 and venue V2, each looked after by VS. Confirmed booking B1 at V1 for E's period; hold H, placed, at V2 for E's period; pending
  booking request P at V1 for `D 19:00`–`D 21:00`.
- A bulk equipment type of 10 chairs; lines L1 (5) and L2 (3) reserved in full by T through Q1's route (reservations R1 and R2).

## Fixture FX-F4 (browser level, F4-T8)

FX-F3's browser fixture, with the equipment line reserved in full and the coordinator, not the organiser, cancelling.

## Isolated automated setup and execution

As `tests/F3/README.md`. Run one card with

`npm test -w @connectsphere/planning-core -- tests/change/api/f4Cards.test.ts -t 'F4-Tn '`
