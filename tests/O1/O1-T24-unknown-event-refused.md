# O1-T24 — An event that does not exist is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T24 |
| Test Scenario | Lines can only be recorded for an existing event the caller may see |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT. |
| Test Steps | 1. As C1, send `POST /api/v1/equipment/request-lines` with the body in Test Data.<br>2. Count the lines stored.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T24 '` (or the whole suite) and read the named `O1-T24 ` result. |
| Test Data | `{"eventId":"22222222-2222-4222-8222-222222222222","lines":[{"equipmentTypeId":"<CHAIRS>","quantity":2,"notes":""}]}` |
| Expected Result | HTTP 404 `EVENT_NOT_FOUND`. Nothing is stored. |
| Created By | Joash, via Claude |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 5d74b7676943cb4a0fb7dc49c76dcae4f614f172 · Evidence: backend/services/planning-core/tests/equipment/api/o1Cards.test.ts › O1-T24, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38195345070 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-12 |
