# F5-T13 — Equipment required with no line at all is not complete

## Specification

| Item | Content |
|---|---|
| Test Case ID | F5-T13 |
| Test Scenario | Equipment required with no line at all is not complete |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F5 from `tests/F5/README.md`: event E1 (Approved, owned by ORG, assigned to C1, `D 14:00`–`D 18:00` UTC, equipment required), booking B1 (Confirmed, V1 `F5 Hall`, looked after by VS) and line L1 (`F5 Chairs` × 5, reserved 5 of 5 by TS), except that L1 is not created (E1 still has `equipment_required = true`). |
| Test Steps | 1. As C1, send `POST /api/v1/events/<E1>/confirmation` with no body.<br>2. Read the event, latest history entry, arrangements and outbox with the queries in `tests/F5/README.md`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f5Cards.test.ts -t 'F5-T13 '` and read the named `F5-T13 ` result. |
| Test Data | No body. |
| Expected Result | HTTP 422 `ARRANGEMENTS_NOT_READY`. The message contains "Equipment: no equipment has been requested, and the event is not marked as needing none." Nothing written: E1's status, its history, its slots' status and flags, its reservations and the event outbox read exactly as before. |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-10-20 |

> **Expected results are checked by the story owner** against F5's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | With equipment_required = true and no line, C1 got 422 ARRANGEMENTS_NOT_READY with exactly "This event can't be confirmed yet. Equipment: no equipment has been requested, and the event is not marked as needing none." E1's status and version, its history (entry count and the latest STATUS_CHANGE entry), its slots' status and flags (requires_reconfirmation, period_mismatch, unsuitable, and their arrangement_flags rows), its booking requests, its request lines, its reservations (status and quantity) and the event outbox (row count and every envelope) read exactly as before the request. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 5cd14bb · Evidence: `backend/services/planning-core/tests/change/api/f5Cards.test.ts` › F5 cards (tests/F5) › F5-T13 equipment required with no line at all is not complete, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41793114951 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
