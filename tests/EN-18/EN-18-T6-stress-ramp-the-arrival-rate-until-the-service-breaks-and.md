# EN-18-T6 — Stress: ramp the arrival rate until the service breaks, and keep the invariants

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-18-T6 |
| Test Scenario | Stress: ramp the arrival rate until the service breaks, and keep the invariants |
| Pre-conditions | 1. Run in the `Load and chaos` workflow (`.github/workflows/load-chaos.yml`) on a GitHub-hosted runner: a throwaway Postgres service container built by `npm run migrate:all`; never the team's shared database.<br>2. The registration service runs as a real process (`tsx src/index.ts`) with no Kafka, behind the CI-only identity stand-in; k6 is the `grafana/k6` image. |
| Test Steps | 1. Start the workflow by hand with the stress input set.<br>2. `tsx load/support/run.ts stress` ramps the arrival rate stage by stage from 100 req/s upward, registering against an event with far more seats than attempts.<br>3. Find the last stage where p95 stayed at or under 800 ms with no failed requests, and check the database invariants after the overload. |
| Test Data | One event with 200,000 seats; arrival rate ramped from 100 req/s in stages until the runner or the service gives out, or the top stage is done. |
| Expected Result | The highest sustainable rate and the first stage that broke are recorded with the measurement behind each. After the overload, registrations equal claimed seats and no seat is held twice. |
| Acceptance criterion | Stress test (ramp to breaking), run by workflow_dispatch. |
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
