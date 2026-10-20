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
| Actual Result | `vitest run tests/temporal/completeEvent.unit.test.ts`: 1 file, 8 tests passed, on Temporal's time-skipping test server (no Docker, no cloud). The completion activity does not run before the effective deadline; an earlier or later rescheduled end time moves it; a not-due answer waits and retries; cancelled, missing and no-end-time events stop without completing. |
| Status | Pass |
| Remarks | Commit: d6ddffb · Evidence: the vitest output (CI's unit job runs it too) · Environment: local unit run on Temporal's time-skipping test server (no Docker, no Temporal Cloud) · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |