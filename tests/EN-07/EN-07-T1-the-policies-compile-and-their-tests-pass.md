# EN-07-T1 — The policies in `policies/` compile and every policy test passes

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-07-T1 |
| Test Scenario | The policies in `policies/` compile and every policy test passes |
| Pre-conditions | 1. Dependencies installed (`npm ci`), on Linux or macOS (Cerbos publishes no Windows build; on Windows this runs in CI). |
| Test Steps | 1. Run `npm run policies:test`.<br>2. Read the summary Cerbos prints. |
| Test Data | The policies and tests in `policies/` as committed: `derived_roles/`, `resources/`, `tests/` and `tests/testdata/`. |
| Expected Result | Cerbos compiles every policy with no error, runs every test suite, and reports every test passed. Every role and action the services ask about appears in a policy, and every combination a test does not list is denied. |
| Acceptance criterion | AC1: Cerbos policies in the repo, evaluated by the gateway, the services and the SPA's navigation. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
