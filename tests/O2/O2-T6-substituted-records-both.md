# O2-T6 — Substituting records the original and the substitute

## Specification

| Item | Content |
|---|---|
| Test Case ID | O2-T6 |
| Test Scenario | Setting Substituted records the substitute type and quantity and does not overwrite the originally requested type and quantity |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O2 from `tests/O2/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. A CHAIRS line (quantity 40, Submitted). |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/status` with the body in Test Data.<br>2. As TS, send `GET /api/v1/equipment/request-lines/<id>`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o2Cards.test.ts -t 'O2-T6 '` (or the whole suite) and read the named `O2-T6 ` result. |
| Test Data | `{"status":"SUBSTITUTED","substituteEquipmentTypeId":"<PROJECTORS>","substituteQuantity":3}` |
| Expected Result | HTTP 200; status `SUBSTITUTED`. The line still shows the original type CHAIRS and quantity 40, and separately the substitute type PROJECTORS and quantity 3. The history entry records original (CHAIRS, 40) and substitute (PROJECTORS, 3). |
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
