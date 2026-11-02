# EN-18-T1 — Spike: 500 register attempts a second for 100 seats register exactly 100 attendees

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-18-T1 |
| Test Scenario | Spike: 500 register attempts a second for 100 seats register exactly 100 attendees |
| Pre-conditions | 1. Run in the `Load and chaos` workflow (`.github/workflows/load-chaos.yml`) on a GitHub-hosted runner: a throwaway Postgres service container built by `npm run migrate:all`; never the team's shared database.<br>2. The registration service runs as a real process (`tsx src/index.ts`) with no Kafka, behind the CI-only identity stand-in; k6 is the `grafana/k6` image. |
| Test Steps | 1. Seed one event with a confirmed venue of exactly 100 seats (the real listing and approval handlers).<br>2. Run `tsx load/support/run.ts spike`: k6 sends `POST /api/v1/registrations` at a constant arrival rate of 500 a second for 10 seconds, each request from a different attendee.<br>3. Count the event's registrations and its claimed seats in the database. |
| Test Data | One event, 100 seats; 5,000 attempts from 5,000 distinct attendees (target rate 500 req/s for 10 s). |
| Expected Result | Exactly 100 registrations with status REGISTERED, exactly 100 seats CLAIMED, each by a different attendee, and exactly 100 responses with status 201. The run records the arrival rate k6 actually achieved and the number of iterations it had to drop, so a runner that cannot sustain 500 req/s says so. |
| Acceptance criterion | k6 spike test (500 req/s for 100 seats gives exactly 100 registered). |
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
