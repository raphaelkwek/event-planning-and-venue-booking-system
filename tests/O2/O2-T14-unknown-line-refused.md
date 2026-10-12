# O2-T14 — A line that does not exist is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | O2-T14 |
| Test Scenario | A status change for an unknown line id is refused |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O2 from `tests/O2/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT. |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/33333333-3333-4333-8333-333333333333/status` with `{"status":"CONFIRMED"}`.<br>2. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o2Cards.test.ts -t 'O2-T14 '` (or the whole suite) and read the named `O2-T14 ` result. |
| Test Data | `{"status":"CONFIRMED"}` |
| Expected Result | HTTP 404 `EQUIPMENT_LINE_NOT_FOUND`. |
| Created By | Joash, via Claude |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 5d74b7676943cb4a0fb7dc49c76dcae4f614f172 · Evidence: backend/services/planning-core/tests/equipment/api/o2Cards.test.ts › O2-T14, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38195345070 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-12 |
