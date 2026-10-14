# O1-T25 — An identity outage refuses the save and stores nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T25 |
| Test Scenario | When the caller's permissions cannot be verified the save is refused with 503 and nothing is stored |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. The identity lookup is made to fail as it does when the identity service is unreachable. |
| Test Steps | 1. Send `POST /api/v1/equipment/request-lines` with the body of O1-T1.<br>2. Count the lines for E1.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T25 '` (or the whole suite) and read the named `O1-T25 ` result. |
| Test Data | The body of O1-T1. |
| Expected Result | HTTP 503 `IDENTITY_UNAVAILABLE`. No line exists for E1. |
| Created By | Joash, via Claude |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 5d74b7676943cb4a0fb7dc49c76dcae4f614f172 · Evidence: backend/services/planning-core/tests/equipment/api/o1Cards.test.ts › O1-T25, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38195345070 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-12 |
