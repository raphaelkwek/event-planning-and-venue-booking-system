# EN-18-T3 — Spike: registration latency p95 is measured against the 800 ms SLO at the rate achieved

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-18-T3 |
| Test Scenario | Spike: registration latency p95 is measured against the 800 ms SLO at the rate achieved |
| Pre-conditions | 1. Run in the `Load and chaos` workflow (`.github/workflows/load-chaos.yml`) on a GitHub-hosted runner: a throwaway Postgres service container built by `npm run migrate:all`; never the team's shared database.<br>2. The registration service runs as a real process (`tsx src/index.ts`) with no Kafka, behind the CI-only identity stand-in; k6 is the `grafana/k6` image. |
| Test Steps | 1. Run the spike scenario of EN-18-T1.<br>2. Read k6's `http_req_duration` p95 for all attempts, for the 201 responses alone, and for the 409 refusals alone. |
| Test Data | The EN-18-T1 run. |
| Expected Result | The three p95 figures are recorded next to the arrival rate achieved, with a plain statement of whether 800 ms was met at that rate. The evidence says what the runner could and could not sustain, and does not claim 500 req/s if k6 reports less. |
| Acceptance criterion | Registration submit latency p95 of 800 ms or less at 500 req/s (architecture §6); results committed as evidence. |
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
