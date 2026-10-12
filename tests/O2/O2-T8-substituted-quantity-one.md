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
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 5d74b7676943cb4a0fb7dc49c76dcae4f614f172 · Evidence: backend/services/planning-core/tests/equipment/api/o2Cards.test.ts › O2-T8, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38195345070 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-12 |
