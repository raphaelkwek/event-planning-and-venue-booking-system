# O1-T23 — An unknown equipment type is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T23 |
| Test Scenario | A line must name an equipment type that exists; otherwise nothing is stored |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT. |
| Test Steps | 1. As C1, send `POST /api/v1/equipment/request-lines` with the body in Test Data.<br>2. Count the lines for E1.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T23 '` (or the whole suite) and read the named `O1-T23 ` result. |
| Test Data | `{"eventId":"<E1>","lines":[{"equipmentTypeId":"11111111-1111-4111-8111-111111111111","quantity":2,"notes":""}]}` |
| Expected Result | HTTP 404 `EQUIPMENT_TYPE_NOT_FOUND`. No line exists for E1. |
| Created By | Joash, via Claude |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | UI walk-through in Chrome pending at the sprint review |
| Executed By | |
| Date of Execution | |
