# EN-18-T2 — Spike: no over-admission, and every other attempt is refused REGISTRATION_FULL

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-18-T2 |
| Test Scenario | Spike: no over-admission, and every other attempt is refused REGISTRATION_FULL |
| Pre-conditions | 1. Run in the `Load and chaos` workflow (`.github/workflows/load-chaos.yml`) on a GitHub-hosted runner: a throwaway Postgres service container built by `npm run migrate:all`; never the team's shared database.<br>2. The registration service runs as a real process (`tsx src/index.ts`) with no Kafka, behind the CI-only identity stand-in; k6 is the `grafana/k6` image. |
| Test Steps | 1. Run the spike scenario of EN-18-T1.<br>2. Tally k6's responses by status and error code, and compare with the database. |
| Test Data | The EN-18-T1 run. |
| Expected Result | Registrations never exceed 100 (over-admission 0). Every request that was not a 201 is a 409 with error code REGISTRATION_FULL: no 429, no 5xx, no timeouts, no other status. The 201s plus the 409s equal the requests k6 completed. |
| Acceptance criterion | k6 spike test (500 req/s for 100 seats gives exactly 100 registered): 0 over-admission, the rest refused. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | In each of the three spikes every attempt that was not a 201 was a 409 REGISTRATION_FULL (4899, 4901, 4901 of them), with 0 rate-limited, 0 server errors and 0 timeouts; the 201s plus the refusals equal the 4999, 5001, 5001 requests k6 completed; registrations never exceeded 100. |
| Status | Pass |
| Remarks | Automated (load and chaos run in CI) · Commit: faf5ebc · Evidence: `.github/workflows/load-chaos.yml` › job `Load (k6 smoke and 500 req/s spike)`, steps `Spike (500 req/s for 10 s, 100 seats), run 1 of 3`, `Spike, run 2 of 3`, `Spike, run 3 of 3`; results in `documentation/evidence/EN-18/spike-1`, `spike-2`, `spike-3`, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
