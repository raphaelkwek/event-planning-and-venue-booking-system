# EN-20-T3 — Experiment 3: a slow database never causes over-admission

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-20-T3 |
| Test Scenario | Experiment 3: a slow database never causes over-admission |
| Pre-conditions | 1. Run in the `Load and chaos` workflow (`.github/workflows/load-chaos.yml`): a throwaway Postgres, a Toxiproxy container (`ghcr.io/shopify/toxiproxy`) and, where a broker is needed, a Redpanda container, all on the runner. Never the team's database or Kafka cluster.<br>2. The registration service reaches its database only through Toxiproxy. |
| Test Steps | 1. Add a 500 ms latency toxic to the database proxy.<br>2. Run a k6 burst of register attempts from distinct attendees against an event with 100 seats.<br>3. Count the registrations and claimed seats in the database (read directly, not through the proxy). |
| Test Data | One event with 100 seats; 600 attempts from 600 distinct attendees, 100 at a time. |
| Expected Result | Registrations never exceed 100 and equal the 201 responses k6 saw and the claimed seats; no seat is held twice. The p95 is reported against the 800 ms SLO whether or not it was met. |
| Acceptance criterion | Experiment 3: 500 ms latency on the registration DB connection during a k6 burst; seats are exact. Toxiproxy runs it in CI. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With 500 ms of latency on the registration database connection, a 600-attempt burst gave 100 x 201 and 500 x 409 REGISTRATION_FULL, no error; the database held 100 registrations, 100 claimed seats, 100 distinct attendees and seats, 0 unmatched, 100 outbox rows. p95 was 472 ms without the toxic and 15,097 ms with it, so the 800 ms objective was not met under the toxic, as the evidence says. |
| Status | Pass |
| Remarks | Automated (load and chaos run in CI) · Commit: faf5ebc · Evidence: `chaos/experiments/03-slow-database.test.ts` › Experiment 3: a slow database never causes over-admission › seats stay exact while every database answer takes 500 ms longer (EN-20-T3), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
