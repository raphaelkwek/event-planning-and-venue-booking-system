# O1-T11 — Technical Support sees the saved lines

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T11 |
| Test Scenario | Saved lines are visible to Technical Support Staff |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT. |
| Test Steps | 1. As C1, save the two lines of O1-T2 with `POST /api/v1/equipment/request-lines`.<br>2. As TS, send `GET /api/v1/equipment/request-lines` (no event filter).<br>3. As TS, send `GET /api/v1/equipment/request-lines/<id>` for the CHAIRS line.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T11 '` (or the whole suite) and read the named `O1-T11 ` result. |
| Test Data | The body of O1-T2. |
| Expected Result | TS's list returns HTTP 200 with both lines, each with status `SUBMITTED`, the event's reference and the equipment type name. The detail returns the CHAIRS line with the coordinator who recorded it (C1). |
| Created By | Joash, via Claude |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 5d74b7676943cb4a0fb7dc49c76dcae4f614f172 · Evidence: backend/services/planning-core/tests/equipment/api/o1Cards.test.ts › O1-T11, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38195345070 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-12 |
