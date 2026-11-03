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
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against F3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for CI on the F3 pull request. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
