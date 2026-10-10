# O2-T15 — Every successive change records who and when

## Specification

| Item | Content |
|---|---|
| Test Case ID | O2-T15 |
| Test Scenario | Each status change records the acting staff member and the timestamp, in order |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O2 from `tests/O2/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. A CHAIRS line (quantity 40, Submitted). |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/status` with `UNDER_REVIEW`, then `CONFIRMED`, then `UNAVAILABLE` with reason `Chairs withdrawn from service`.<br>2. As TS, send `GET /api/v1/equipment/request-lines/<id>`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o2Cards.test.ts -t 'O2-T15 '` (or the whole suite) and read the named `O2-T15 ` result. |
| Test Data | `{"status":"UNDER_REVIEW"}`, `{"status":"CONFIRMED"}`, `{"status":"UNAVAILABLE","reason":"Chairs withdrawn from service"}` |
| Expected Result | The history has the creation entry then three `STATUS_CHANGED` entries in that order (`SUBMITTED`>`UNDER_REVIEW`, `UNDER_REVIEW`>`CONFIRMED`, `CONFIRMED`>`UNAVAILABLE`), each with actor TS and a non-decreasing timestamp. The line ends `UNAVAILABLE`. |
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
