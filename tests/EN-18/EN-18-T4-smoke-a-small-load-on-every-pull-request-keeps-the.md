# EN-18-T4 — Smoke: a small load on every pull request keeps the invariants

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-18-T4 |
| Test Scenario | Smoke: a small load on every pull request keeps the invariants |
| Pre-conditions | 1. Run in the `Load and chaos` workflow (`.github/workflows/load-chaos.yml`) on a GitHub-hosted runner: a throwaway Postgres service container built by `npm run migrate:all`; never the team's shared database.<br>2. The registration service runs as a real process (`tsx src/index.ts`) with no Kafka, behind the CI-only identity stand-in; k6 is the `grafana/k6` image. |
| Test Steps | 1. Run `tsx load/support/run.ts smoke` as the pull request job does.<br>2. Check the same database invariants as EN-18-T1. |
| Test Data | One event, 20 seats; 400 attempts from distinct attendees at 40 req/s for 10 s. |
| Expected Result | Exactly 20 registered, 0 over-admission, every other attempt refused REGISTRATION_FULL, and p95 under 800 ms. |
| Acceptance criterion | Soak and stress tests, with a small smoke run on pull requests. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Smoke: 20 seats, 40 req/s for 10 s. 20 registered, 380 refused REGISTRATION_FULL, no other response, 0 over-admission; p95 6.3 ms (limit 800 ms); 40.0 req/s achieved. |
| Status | Pass |
| Remarks | Automated (load and chaos run in CI) · Commit: faf5ebc · Evidence: `.github/workflows/load-chaos.yml` › job `Load (k6 smoke and 500 req/s spike)`, step `Smoke (40 req/s for 10 s, 20 seats)`; `documentation/evidence/EN-18/smoke`, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
