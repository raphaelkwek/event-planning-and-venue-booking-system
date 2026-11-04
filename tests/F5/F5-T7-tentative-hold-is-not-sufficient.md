# F5-T7 — A tentative hold alone is not a confirmed booking

## Specification

| Item | Content |
|---|---|
| Test Case ID | F5-T7 |
| Test Scenario | A tentative hold alone is not a confirmed booking |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F5 from `tests/F5/README.md`: event E1 (Approved, owned by ORG, assigned to C1, `D 14:00`–`D 18:00` UTC, equipment required), booking B1 (Confirmed, V1 `F5 Hall`, looked after by VS) and line L1 (`F5 Chairs` × 5, reserved 5 of 5 by TS), without B1, and with a HELD slot H1 at V1 for E1's window instead. |
| Test Steps | 1. As C1, send `POST /api/v1/events/<E1>/confirmation` with no body.<br>2. Read the event, latest history entry, arrangements and outbox with the queries in `tests/F5/README.md`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f5Cards.test.ts -t 'F5-T7 '` and read the named `F5-T7 ` result. |
| Test Data | No body. |
| Expected Result | HTTP 422 `ARRANGEMENTS_NOT_READY`. The message names "no venue booking is confirmed" and H1's reference at `F5 Hall` as "only a tentative hold". H1 is still `HELD`. Nothing written: E1's status, its history, its slots' status and flags, its reservations and the event outbox read exactly as before. |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-10-20 |

> **Expected results are checked by the story owner** against F5's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | With only a HELD slot H1 at V1, C1 got 422 ARRANGEMENTS_NOT_READY with "This event can't be confirmed yet. Venue: no venue booking is confirmed; hold <H1 reference> at F5 Hall is only a tentative hold." H1 was still HELD (requires_reconfirmation false). E1's status and version, its history (entry count and the latest STATUS_CHANGE entry), its slots' status and flags (requires_reconfirmation, period_mismatch, unsuitable, and their arrangement_flags rows), its booking requests, its request lines, its reservations (status and quantity) and the event outbox (row count and every envelope) read exactly as before the request. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: c0f7183 · Evidence: `backend/services/planning-core/tests/change/api/f5Cards.test.ts` › F5 cards (tests/F5) › F5-T7 a tentative hold alone is not sufficient, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41798410254 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
