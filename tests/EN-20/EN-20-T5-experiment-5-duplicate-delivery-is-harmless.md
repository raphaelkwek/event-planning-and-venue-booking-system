# EN-20-T5 — Experiment 5: duplicate delivery is harmless

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-20-T5 |
| Test Scenario | Experiment 5: duplicate delivery is harmless |
| Pre-conditions | 1. Run in the `Load and chaos` workflow (`.github/workflows/load-chaos.yml`): a throwaway Postgres, a Toxiproxy container (`ghcr.io/shopify/toxiproxy`) and, where a broker is needed, a Redpanda container, all on the runner. Never the team's database or Kafka cluster.<br>2. Both consumers reach the broker only through Toxiproxy. |
| Test Steps | 1. Publish an event's listing, an approval and 20 registration messages to Redpanda and let the registration and notification consumers handle them.<br>2. Cut the consumers' connections in the middle (a reset toxic) so some messages are delivered again.<br>3. Replay the whole topic from the beginning, twice. |
| Test Data | One event with 20 seats; 20 registration.confirmed messages. |
| Expected Result | The event has exactly 20 seats and no more after the approval is replayed; the notification service holds exactly 20 notifications for the 20 registrations, from 20 distinct messages; both services' inboxes hold the same rows after the replays as before. Each topic really carried every message three times. |
| Acceptance criterion | Experiment 5: replay a whole topic; no duplicate notifications or side effects. Toxiproxy runs it in CI. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Each of the event, venue-booking and registration topics ended with three copies of every message (end offsets 1,1,20 became 3,3,60) after a 3 s connection reset and two replays of 44 messages. The event still had exactly 20 seats (20 free), the 20 registrations still had exactly 20 notifications from 20 distinct messages, and the inbox rows were unchanged (registration 2, notification 21). |
| Status | Pass |
| Remarks | Automated (load and chaos run in CI) · Commit: faf5ebc · Evidence: `chaos/experiments/05-duplicate-delivery.test.ts` › Experiment 5: duplicate delivery is harmless › replaying every topic twice, after a connection reset, builds no extra seats and sends no extra notifications (EN-20-T5), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
