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
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
