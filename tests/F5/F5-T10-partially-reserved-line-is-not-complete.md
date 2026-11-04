# F5-T10 — Boundary just below: a line reserved 4 of 5 is not reserved in full

## Specification

| Item | Content |
|---|---|
| Test Case ID | F5-T10 |
| Test Scenario | Boundary just below: a line reserved 4 of 5 is not reserved in full |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F5 from `tests/F5/README.md`: event E1 (Approved, owned by ORG, assigned to C1, `D 14:00`–`D 18:00` UTC, equipment required), booking B1 (Confirmed, V1 `F5 Hall`, looked after by VS) and line L1 (`F5 Chairs` × 5, reserved 5 of 5 by TS), except that L1 is reserved as a confirmed partial reservation of 4 (requested 5, reserved 4). |
| Test Steps | 1. As C1, send `POST /api/v1/events/<E1>/confirmation` with no body.<br>2. Read the event, latest history entry, arrangements and outbox with the queries in `tests/F5/README.md`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f5Cards.test.ts -t 'F5-T10 '` and read the named `F5-T10 ` result. |
| Test Data | No body. |
| Expected Result | HTTP 422 `ARRANGEMENTS_NOT_READY`. The message contains "Equipment:" and names "F5 Chairs × 5 has 4 of 5 reserved"; it says nothing about the venue. `details.equipment` names L1 with requestedQuantity 5 and reservedQuantity 4. The reservation is still `RESERVED`, 4. Nothing written: E1's status, its history, its slots' status and flags, its reservations and the event outbox read exactly as before. |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-10-20 |

> **Expected results are checked by the story owner** against F5's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | With L1 reserved 4 of 5 through Q1's route (confirmed partial), C1 got 422 ARRANGEMENTS_NOT_READY with exactly "This event can't be confirmed yet. Equipment: F5 Chairs × 5 has 4 of 5 reserved." (nothing about the venue). details.equipment was the single entry for L1 with requestedQuantity 5 and reservedQuantity 4. The reservation was still RESERVED, 4. E1's status and version, its history (entry count and the latest STATUS_CHANGE entry), its slots' status and flags (requires_reconfirmation, period_mismatch, unsuitable, and their arrangement_flags rows), its booking requests, its request lines, its reservations (status and quantity) and the event outbox (row count and every envelope) read exactly as before the request. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: c0f7183 · Evidence: `backend/services/planning-core/tests/change/api/f5Cards.test.ts` › F5 cards (tests/F5) › F5-T10 a line reserved 4 of 5 is not reserved in full (just below), CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41798410254 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
