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
| Actual Result | All 11 settings tests passed, exit 0. This validates configuration rules only; it does not prove Cloud access or a running worker. |
| Status | Pass |
| Remarks | Commit: `516df57` plus the code hashes in `evidence/2026-10-20-local-ci/revision.json`. Evidence: [execution log](evidence/2026-10-20-local-ci/settings.txt). No Cloud worker was started. |
| Executed By | Codex |
| Date of Execution | 2026-10-20 (SGT) |
