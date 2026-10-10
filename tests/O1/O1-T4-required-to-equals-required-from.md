# O1-T4 — Required-to equal to required-from is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T4 |
| Test Scenario | Boundary: the end of the period equal to its start is not later than it, so the save is refused and stores nothing |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT. |
| Test Steps | 1. As C1, send `POST /api/v1/equipment/request-lines` with the body in Test Data.<br>2. Count the lines stored for E1 in `equipment.equipment_request_lines`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T4 '` (or the whole suite) and read the named `O1-T4 ` result. |
| Test Data | `{"eventId":"<E1>","lines":[{"equipmentTypeId":"<CHAIRS>","quantity":5,"notes":"","requiredFrom":"D 15:00","requiredTo":"D 15:00"}]}` |
| Expected Result | HTTP 400 `VALIDATION_FAILED`; `error.fields` names `lines.0.requiredTo` with a message that it must be later than required-from. No line exists for E1. |
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
