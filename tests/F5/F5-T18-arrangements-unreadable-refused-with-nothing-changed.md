# F5-T18 — If the venue or the equipment records can't be read, confirmation is refused with 503 and nothing changes

## Specification

| Item | Content |
|---|---|
| Test Case ID | F5-T18 |
| Test Scenario | If the venue or the equipment records can't be read, confirmation is refused with 503 and nothing changes |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F5 from `tests/F5/README.md`: event E1 (Approved, owned by ORG, assigned to C1, `D 14:00`–`D 18:00` UTC, equipment required), booking B1 (Confirmed, V1 `F5 Hall`, looked after by VS) and line L1 (`F5 Chairs` × 5, reserved 5 of 5 by TS). The venue module's read of E1's arrangements is made to fail (in the automated test, its function rejects with a database error); then, separately, the equipment module's read is made to fail. |
| Test Steps | 1. As C1, send `POST /api/v1/events/<E1>/confirmation` with no body. Once with the venue read failing, once with the equipment read failing.<br>2. Read the event, latest history entry, arrangements and outbox with the queries in `tests/F5/README.md`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f5Cards.test.ts -t 'F5-T18 '` and read the named `F5-T18 ` result. |
| Test Data | No body. |
| Expected Result | HTTP 503 `ARRANGEMENTS_UNAVAILABLE` each time, with the message "The venue and equipment arrangements could not be checked, so the event was not confirmed. Nothing was changed. Try again." Nothing written: E1's status, its history, its slots' status and flags, its reservations and the event outbox read exactly as before. |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-10-20 |

> **Expected results are checked by the story owner** against F5's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
