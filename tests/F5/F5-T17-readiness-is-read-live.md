# F5-T17 — Readiness is read at the moment of confirmation: a reservation released just before is seen

## Specification

| Item | Content |
|---|---|
| Test Case ID | F5-T17 |
| Test Scenario | Readiness is read at the moment of confirmation: a reservation released just before is seen |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F5 from `tests/F5/README.md`: event E1 (Approved, owned by ORG, assigned to C1, `D 14:00`–`D 18:00` UTC, equipment required), booking B1 (Confirmed, V1 `F5 Hall`, looked after by VS) and line L1 (`F5 Chairs` × 5, reserved 5 of 5 by TS). |
| Test Steps | 1. As TS, release L1's reservation with reason `Chairs needed elsewhere` (`POST /api/v1/equipment/request-lines/<L1>/release`).<br>2. As C1, send `POST /api/v1/events/<E1>/confirmation` with no body.<br>3. Read the event, latest history entry, arrangements and outbox with the queries in `tests/F5/README.md`.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f5Cards.test.ts -t 'F5-T17 '` and read the named `F5-T17 ` result. |
| Test Data | Release body: `{"reason":"Chairs needed elsewhere"}`. |
| Expected Result | The release returns HTTP 200. The confirmation returns HTTP 422 `ARRANGEMENTS_NOT_READY` naming "F5 Chairs × 5 is Confirmed", although L1 was reserved when the fixture was loaded. E1 is still `APPROVED`. |
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
