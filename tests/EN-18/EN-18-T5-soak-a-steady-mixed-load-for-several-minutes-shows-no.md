# EN-18-T5 — Soak: a steady mixed load for several minutes shows no errors and no unbounded growth

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-18-T5 |
| Test Scenario | Soak: a steady mixed load for several minutes shows no errors and no unbounded growth |
| Pre-conditions | 1. Run in the `Load and chaos` workflow (`.github/workflows/load-chaos.yml`) on a GitHub-hosted runner: a throwaway Postgres service container built by `npm run migrate:all`; never the team's shared database.<br>2. The registration service runs as a real process (`tsx src/index.ts`) with no Kafka, behind the CI-only identity stand-in; k6 is the `grafana/k6` image. |
| Test Steps | 1. Start the soak: run the `Load and chaos` workflow by hand with the soak input set (offered once the workflow is on the default branch), or put `[full-load]` in the pull request's title.<br>2. `tsx load/support/run.ts soak` holds a steady request rate for the chosen minutes: browse the open events, register, view my registrations and withdraw, across many events.<br>3. The harness samples the registration process's resident memory and CPU time every 10 seconds, then checks the database invariants. |
| Test Data | Many events with enough seats; a steady rate of 100 req/s for 5 minutes (workflow input). |
| Expected Result | No 5xx and no timeouts; p95 under 800 ms for registering and under 400 ms for reads; resident memory in the last minute within 25% of the memory after the first minute; every claimed seat matches an active registration (no leak, no ghost seat). |
| Acceptance criterion | Soak test, shorter in CI (a few minutes), run by workflow_dispatch. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Soak: 100 req/s for 5 minutes (about 36,000 requests) over 10 events: 6000 registered and 6000 withdrawn, 24000 reads answered, no 5xx, 429 or timeout; p95 8.7 ms to register and 7.5 ms to read; resident memory 151 MB in the second minute and 154 MB in the last (1.9%); every claimed seat matched an active registration and the database matched k6's counts. CPU 2.43 ms per request. Started by [full-load] in the pull request title (no dispatch before the workflow is on the default branch). |
| Status | Pass |
| Remarks | Automated (load and chaos run in CI) · Commit: faf5ebc · Evidence: `.github/workflows/load-chaos.yml` › job `Load (k6 soak)`; `documentation/evidence/EN-18/soak`, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
