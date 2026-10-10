# O1-T14 — The coordinator edits an Under Review line

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T14 |
| Test Scenario | A line may be edited while Under Review |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. A CHAIRS line (quantity 40) with status `UNDER_REVIEW`, set by TS. |
| Test Steps | 1. As C1, send `PUT /api/v1/equipment/request-lines/<id>` with the body in Test Data.<br>2. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T14 '` (or the whole suite) and read the named `O1-T14 ` result. |
| Test Data | `{"equipmentTypeId":"<CHAIRS>","quantity":35,"notes":"Reduced","requiredFrom":"D 14:00","requiredTo":"D 18:00"}` |
| Expected Result | HTTP 200. Quantity is 35 and the status is still `UNDER_REVIEW`. |
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
