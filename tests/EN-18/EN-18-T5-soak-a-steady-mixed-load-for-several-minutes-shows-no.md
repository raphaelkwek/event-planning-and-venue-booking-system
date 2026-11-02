# EN-18-T5 — Soak: a steady mixed load for several minutes shows no errors and no unbounded growth

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-18-T5 |
| Test Scenario | Soak: a steady mixed load for several minutes shows no errors and no unbounded growth |
| Pre-conditions | 1. Run in the `Load and chaos` workflow (`.github/workflows/load-chaos.yml`) on a GitHub-hosted runner: a throwaway Postgres service container built by `npm run migrate:all`; never the team's shared database.<br>2. The registration service runs as a real process (`tsx src/index.ts`) with no Kafka, behind the CI-only identity stand-in; k6 is the `grafana/k6` image. |
| Test Steps | 1. Start the `Load and chaos` workflow by hand with the soak input set.<br>2. `tsx load/support/run.ts soak` holds a steady request rate for the chosen minutes: browse the open events, register, view my registrations and withdraw, across many events.<br>3. The harness samples the registration process's resident memory and CPU time every 10 seconds, then checks the database invariants. |
| Test Data | Many events with enough seats; a steady rate of 100 req/s for 5 minutes (workflow input). |
| Expected Result | No 5xx and no timeouts; p95 under 800 ms for registering and under 400 ms for reads; resident memory in the last minute within 25% of the memory after the first minute; every claimed seat matches an active registration (no leak, no ghost seat). |
| Acceptance criterion | Soak test, shorter in CI (a few minutes), run by workflow_dispatch. |
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
