# EN-11-T2 — Complete an event only after its end and respect rescheduling

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-11-T2 |
| Test Scenario | Complete an event only after its end and respect rescheduling |
| Pre-conditions | Dependencies installed; a machine permitted to launch the Temporal time-skipping test server. Run from `backend/services/planning-core`. |
| Test Steps | 1. Run `npx --no-install vitest run --config vitest.unit.config.ts tests/temporal/completeEvent.unit.test.ts`.<br>2. Check the original deadline, earlier/later rescheduling, database not-due rechecks and cancelled/missing/no-end outcomes. |
| Test Data | Fresh random event IDs and fake completion activities provided by the test; 1-hour, 2-hour, 3-hour, 5-hour, 6-hour and 10-hour virtual deadlines. No live application data. |
| Expected Result | All 8 timer tests pass. No completion activity runs before the effective deadline; cancelled/missing events stop without completion; a not-due response waits before retrying. |
| Created By | Yichen, via Codex |
| Date of Creation | 2026-10-20 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The full unit run attempted this suite, but its beforeAll could not start the ephemeral Temporal server: Operation not permitted (os error 1). The eight timer scenarios did not execute. |
| Status | Blocked |
| Remarks | Commit: `516df57` plus the code hashes in `evidence/2026-10-20-local-ci/revision.json`. Evidence: [execution log](evidence/2026-10-20-local-ci/unit-coverage.txt). No Cloud worker was started. |
| Executed By | Codex |
| Date of Execution | 2026-10-20 (SGT) |
