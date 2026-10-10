# O1-T13 — The coordinator edits a Submitted line

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T13 |
| Test Scenario | A line may be edited while Submitted; its status and its original requester are unchanged |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. A CHAIRS line (quantity 40) recorded by C1 and Submitted, from O1-T1. |
| Test Steps | 1. As C1, send `PUT /api/v1/equipment/request-lines/<id>` with the body in Test Data.<br>2. As C1, send `GET /api/v1/equipment/request-lines/<id>`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T13 '` (or the whole suite) and read the named `O1-T13 ` result. |
| Test Data | `{"equipmentTypeId":"<PROJECTORS>","quantity":45,"notes":"Increase after headcount update","requiredFrom":"D 13:30","requiredTo":"D 18:30"}` |
| Expected Result | HTTP 200. The line now has PROJECTORS, quantity 45, the new notes and times; status is still `SUBMITTED`; requestedBy is still C1 and requestedAt is unchanged. The history has an `EDITED` entry for C1. |
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
