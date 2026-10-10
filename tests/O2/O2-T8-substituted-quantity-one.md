# O2-T8 — A substitute quantity of 1 is accepted

## Specification

| Item | Content |
|---|---|
| Test Case ID | O2-T8 |
| Test Scenario | Boundary exactly at the minimum substitute quantity |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O2 from `tests/O2/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. A CHAIRS line (quantity 40, Submitted). |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/status` with the body in Test Data.<br>2. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o2Cards.test.ts -t 'O2-T8 '` (or the whole suite) and read the named `O2-T8 ` result. |
| Test Data | `{"status":"SUBSTITUTED","substituteEquipmentTypeId":"<PROJECTORS>","substituteQuantity":1}` |
| Expected Result | HTTP 200; status `SUBSTITUTED` with substitute quantity 1 and original quantity 40. |
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
