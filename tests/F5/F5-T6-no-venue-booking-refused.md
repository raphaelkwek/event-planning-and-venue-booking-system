# F5-T6 — An event with no venue booking at all is refused, naming the venue as outstanding

## Specification

| Item | Content |
|---|---|
| Test Case ID | F5-T6 |
| Test Scenario | An event with no venue booking at all is refused, naming the venue as outstanding |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F5 from `tests/F5/README.md`: event E1 (Approved, owned by ORG, assigned to C1, `D 14:00`–`D 18:00` UTC, equipment required), booking B1 (Confirmed, V1 `F5 Hall`, looked after by VS) and line L1 (`F5 Chairs` × 5, reserved 5 of 5 by TS), without B1 (E1 has no slot and no booking request). |
| Test Steps | 1. As C1, send `POST /api/v1/events/<E1>/confirmation` with no body.<br>2. Read the event, latest history entry, arrangements and outbox with the queries in `tests/F5/README.md`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f5Cards.test.ts -t 'F5-T6 '` and read the named `F5-T6 ` result. |
| Test Data | No body. |
| Expected Result | HTTP 422 `ARRANGEMENTS_NOT_READY`. The message starts "This event can't be confirmed yet." and contains "Venue: no venue booking is confirmed." It says nothing about equipment. `details.venue` has one entry and `details.equipment` is empty. Nothing written: E1's status, its history, its slots' status and flags, its reservations and the event outbox read exactly as before. |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-10-20 |

> **Expected results are checked by the story owner** against F5's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | Without B1 (no slot, no booking request), C1 got 422 ARRANGEMENTS_NOT_READY with exactly "This event can't be confirmed yet. Venue: no venue booking is confirmed." (nothing about equipment). details was { venue: [{ kind: NO_CONFIRMED_BOOKING }], equipment: [], flags: [] }. E1's status and version, its history (entry count and the latest STATUS_CHANGE entry), its slots' status and flags (requires_reconfirmation, period_mismatch, unsuitable, and their arrangement_flags rows), its booking requests, its request lines, its reservations (status and quantity) and the event outbox (row count and every envelope) read exactly as before the request. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 5bfb25e · Evidence: `backend/services/planning-core/tests/change/api/f5Cards.test.ts` › F5 cards (tests/F5) › F5-T6 no venue booking at all is refused, naming the venue as outstanding, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41801285931 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
