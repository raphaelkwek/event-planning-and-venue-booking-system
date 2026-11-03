# EN-18-T6 — Stress: ramp the arrival rate until the service breaks, and keep the invariants

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-18-T6 |
| Test Scenario | Stress: ramp the arrival rate until the service breaks, and keep the invariants |
| Pre-conditions | 1. Run in the `Load and chaos` workflow (`.github/workflows/load-chaos.yml`) on a GitHub-hosted runner: a throwaway Postgres service container built by `npm run migrate:all`; never the team's shared database.<br>2. The registration service runs as a real process (`tsx src/index.ts`) with no Kafka, behind the CI-only identity stand-in; k6 is the `grafana/k6` image. |
| Test Steps | 1. Start the stress run the same way: the workflow by hand with the stress input set, or `[full-load]` in the pull request's title.<br>2. `tsx load/support/run.ts stress` ramps the arrival rate stage by stage from 100 req/s upward, registering against an event with far more seats than attempts.<br>3. Find the last stage where p95 stayed at or under 800 ms with no failed requests, and check the database invariants after the overload. |
| Test Data | One event with 200,000 seats; arrival rate ramped from 100 req/s in stages until the runner or the service gives out, or the top stage is done. |
| Expected Result | The highest sustainable rate and the first stage that broke are recorded with the measurement behind each. After the overload, registrations equal claimed seats and no seat is held twice. |
| Acceptance criterion | Stress test (ramp to breaking), run by workflow_dispatch. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Stress: steps of 100 to 2,000 req/s, 250,000 seats. The highest step that held was 250 req/s (p95 9.2 ms); the first that broke was 500 req/s (p95 6,001 ms; about 400 a second completed, k6 out of its 4,000 VUs). Afterwards 82892 registrations, 82892 claimed seats, none twice, no unmatched row. CPU 2.62 ms per request. Started by [full-load] in the pull request title. |
| Status | Pass |
| Remarks | Automated (load and chaos run in CI) · Commit: faf5ebc · Evidence: `.github/workflows/load-chaos.yml` › job `Load (k6 stress, ramp to breaking)`; `documentation/evidence/EN-18/stress`, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
