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
| Actual Result | Cerbos 0.56.0 compiled every policy in policies/ and every test suite passed (event, venue, booking_request, equipment, registration, user). |
| Status | Pass |
| Remarks | Automated (CI step) · Commit: 7f1c8fa · Evidence: the CI job "Lint, typecheck, build, unit tests" › step "Permission policy tests (Cerbos)" (`npm run policies:test`), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41640443625 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
