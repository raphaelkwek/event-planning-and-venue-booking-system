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
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
