# G2-T5 — Previewing alters no booking, reservation, flag, request, event or message

## Specification

| Item | Content |
|---|---|
| Test Case ID | G2-T5 |
| Test Scenario | After previewing a change that would flag every arrangement, the stored bookings, booking requests, reservation, both flag tables, the change request, the event and the outboxes are exactly as before |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0019` and `equipment/0009`), using the isolated setup in `tests/G2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-G2 from `tests/G2/README.md` is loaded. Specific set-up: CR proposes `proposedStartAt` `D 15:00` and `expectedAttendance` 150, so approval would flag B1, B2 and R1. |
| Test Steps | 1. Read and note: E's venue slots (status, period, `requires_reconfirmation`, `period_mismatch`, `unsuitable`), E's booking requests (status and both flag columns), R1 (status, quantity, period, `flagged_for_review`), E's rows in `venue.arrangement_flags` and `equipment.reservation_flags`, CR (status, decided by, decided at), E's row (status, version, start, attendance) and the number of E's messages in the change, event, venue and equipment outboxes.<br>2. As C, send `GET /api/v1/change-requests/<CR>/impact` twice.<br>3. Read everything in step 1 again.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/g2Cards.test.ts -t 'G2-T5 '` (or the whole suite) and read the named `G2-T5 ` result. |
| Test Data | CR proposes `proposedStartAt` `D 15:00` and `expectedAttendance` 150. |
| Expected Result | Both calls answer HTTP 200 with the same `impact`, whose `flags` name B1 (`REQUIRES_RECONFIRMATION` and `UNSUITABLE`), B2 (`REQUIRES_RECONFIRMATION`) and R1 (`FLAGGED_FOR_REVIEW`). Everything read in step 3 equals step 1: B1 and B2 still CONFIRMED for `D 14:00`–`D 18:00` with every flag column false, R1 still RESERVED with the same quantity and period and not flagged, no row in either flag table, CR still `PENDING` with no decision, E unchanged (Planning, same version, start `D 14:00`, attendance 80), and no new outbox message of any module. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against G2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the G2 implementation. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
