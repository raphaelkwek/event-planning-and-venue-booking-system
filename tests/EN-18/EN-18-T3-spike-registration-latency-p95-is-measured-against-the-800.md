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
| Actual Result | p95 of all attempts 463, 401, 411 ms; of the registered 729, 613, 612 ms; of the refused 425, 377, 376 ms, at 499.7, 499.9, 499.9 req/s achieved. 800 ms met at the rate achieved in all three. A later run of the same code on a slower runner gave p95 712, 798 and 736 ms at about 490 req/s with 52 to 98 iterations dropped (run 41535317066): recorded in the evidence README, not a failure of the card. |
| Status | Pass |
| Remarks | Automated (load and chaos run in CI) · Commit: faf5ebc · Evidence: `.github/workflows/load-chaos.yml` › job `Load (k6 smoke and 500 req/s spike)`, steps `Spike (500 req/s for 10 s, 100 seats), run 1 of 3`, `Spike, run 2 of 3`, `Spike, run 3 of 3`; results in `documentation/evidence/EN-18/spike-1`, `spike-2`, `spike-3`, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
