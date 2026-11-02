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
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
