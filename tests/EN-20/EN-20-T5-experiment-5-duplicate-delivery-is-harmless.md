# EN-20-T5 — Experiment 5: duplicate delivery is harmless

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-20-T5 |
| Test Scenario | Experiment 5: duplicate delivery is harmless |
| Pre-conditions | 1. Run in the `Load and chaos` workflow (`.github/workflows/load-chaos.yml`): a throwaway Postgres, a Toxiproxy container (`ghcr.io/shopify/toxiproxy`) and, where a broker is needed, a Redpanda container, all on the runner. Never the team's database or Kafka cluster.<br>2. Both consumers reach the broker only through Toxiproxy. |
| Test Steps | 1. Publish an event's listing, an approval and 20 registration messages to Redpanda and let the registration and notification consumers handle them.<br>2. Cut the consumers' connections in the middle (a reset toxic) so some messages are delivered again.<br>3. Replay the whole topic from the beginning, twice. |
| Test Data | One event with 20 seats; 20 registration.confirmed messages. |
| Expected Result | The event has exactly 20 seats and no more after the approval is replayed; the notification service holds exactly 20 notifications and 20 inbox rows. Replays change nothing. |
| Acceptance criterion | Experiment 5: replay a whole topic; no duplicate notifications or side effects. Toxiproxy runs it in CI. |
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
