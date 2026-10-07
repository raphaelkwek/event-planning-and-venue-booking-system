# P1-T15 — Invalid query names the refused field

## Specification

| Item | Content |
|---|---|
| Test Case ID | P1-T15 |
| Test Scenario | Invalid query names the refused field; real API/database procedure with authentication stubbed |
| Pre-conditions | 1. Migrated throwaway Postgres and CI placeholder configuration from `tests/P1/README.md`.<br>2. The test resets only its actor's fixture, creates a bulk type total 10, and stubs JWT/actor resolution. |
| Test Steps | 1. Record `git rev-parse HEAD`.<br>2. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/p1Cards.test.ts -t 'P1-T15 '`, or run the entire suite using `npm test -w @connectsphere/planning-core` and find its named `P1-T15 ` result.<br>3. Capture output to `tests/P1/evidence/P1-T15-YYYY-MM-DD.txt`, inspect every assertion and update the execution record. |
| Test Data | Equal and reversed endpoints; malformed start timestamp; requested quantities -1 and 1.5. Exact fixture and requests in `backend/services/planning-core/tests/equipment/api/p1Cards.test.ts`. |
| Expected Result | All five GET requests return HTTP 400 VALIDATION_FAILED with the corresponding endsAt, startsAt or requestedQuantity field. All persisted equipment rows remain unchanged. The selected test passes. |
| Created By | Yichen, via Codex |
| Date of Creation | 2026-10-08 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: — · Evidence: — · Defect: — · Story: P1, Sprint 2 · Scope: real API/Postgres with authentication stubbed |
| Executed By | |
| Date of Execution | |
