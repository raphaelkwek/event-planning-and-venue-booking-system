# F3-T7 — One event.cancelled message; the owner, the coordinator, the venue's staff and the reserver each get one notice

## Specification

| Item | Content |
|---|---|
| Test Case ID | F3-T7 |
| Test Scenario | Cancelling writes one `event.cancelled` message that names everyone F3 notifies, and the notification service's rule gives each one notice |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `event/0012`, `event/0013`, `change/0004` and `change/0005`), using the isolated setup in `tests/F3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F3 from `tests/F3/README.md` is loaded. |
| Test Steps | 1. As O, cancel E with the body below.<br>2. Read E's `event.cancelled` messages from the event outbox.<br>3. Pass the message through the notification service's `notificationsFor`.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f3Cards.test.ts -t 'F3-T7 '` and read the named `F3-T7 ` result. |
| Test Data | `{"reason":"The speaker withdrew."}` |
| Expected Result | Step 2 finds exactly one message, on the event topic, with `ownerId` O, `assignedCoordinatorId` C, the reason, `cancelledBy` O, `bookings` B1 at V1 with `staffIds` [VS], and `reservations` R1 × 5 reserved by T. Step 3 gives one notice each to O, C, VS and T, in that order. |
| Created By | Raphael |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against F3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | After O cancelled E, the event outbox held exactly one `event.cancelled` message for E, on the event topic, with `ownerId` O, `assignedCoordinatorId` C, reason `The speaker withdrew.`, `cancelledBy` O, `bookings` B1 (its reference, V1's name, `staffIds` [VS]) and `reservations` one of 5 reserved by T. `notificationsFor` gave exactly four notices, to O, C, VS and T in that order. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: a406635 · Evidence: `backend/services/planning-core/tests/change/api/f3Cards.test.ts` › F3 cards (tests/F3) › F3-T7 one event.cancelled message; the owner, the coordinator, the venue's staff and the reserver each get one notice, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41773031885 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
