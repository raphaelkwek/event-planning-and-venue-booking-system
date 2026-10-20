# EN-11-T1 — Validate Temporal worker connection settings without using live credentials

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-11-T1 |
| Test Scenario | Validate Temporal worker connection settings without using live credentials |
| Pre-conditions | Dependencies installed; run from `backend/services/planning-core`. No database or Temporal namespace is needed. |
| Test Steps | 1. Run `npx --no-install vitest run --config vitest.unit.config.ts tests/temporal/domain/settings.test.ts`.<br>2. Check all 11 assertions and the process exit status. |
| Test Data | The literal dummy environment fixtures in `tests/temporal/domain/settings.test.ts`; no real API key. |
| Expected Result | All 11 tests pass. Missing address disables the worker; invalid settings name fields without values; API-key connections enable TLS and namespace routing; whitespace is trimmed and the default task queue is planning-core. |
| Created By | Yichen, via Codex |
| Date of Creation | 2026-10-20 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | `vitest run tests/temporal/domain/settings.test.ts`: 1 file, 11 tests passed, exit status 0. A missing address disables the worker; invalid settings name the field without echoing a value; an API key turns TLS on and routes by namespace; whitespace is trimmed and the task queue defaults to planning-core. |
| Status | Pass |
| Remarks | Commit: d6ddffb · Evidence: the vitest output (CI's unit job runs it too) · Environment: local unit run (no database, no Temporal Cloud) · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |