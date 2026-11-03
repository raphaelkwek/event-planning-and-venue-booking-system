# EN-20-T2 — Experiment 2: a broker outage loses no notifications

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-20-T2 |
| Test Scenario | Experiment 2: a broker outage loses no notifications |
| Pre-conditions | 1. Run in the `Load and chaos` workflow (`.github/workflows/load-chaos.yml`): a throwaway Postgres, a Toxiproxy container (`ghcr.io/shopify/toxiproxy`) and, where a broker is needed, a Redpanda container, all on the runner. Never the team's database or Kafka cluster.<br>2. Kafka (Redpanda) is reached only through Toxiproxy. |
| Test Steps | 1. Run the registration outbox relay and the notification consumer against the broker through Toxiproxy.<br>2. Disable the Kafka proxy and register 50 attendees.<br>3. Check the registrations committed and the outbox holds the messages unpublished.<br>4. Enable the proxy again and wait for the outbox to drain. |
| Test Data | One event with 50 seats; 50 distinct attendees. |
| Expected Result | All 50 registrations commit during the outage and every outbox row is pending. After recovery every row is published exactly once (50 messages on the topic, 50 distinct ids) and the notification service stores exactly 50 notifications, one per registration. |
| Acceptance criterion | Experiment 2: Kafka unreachable while writes happen; writes still commit; notifications arrive after recovery, none duplicated. Toxiproxy runs it in CI. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | 50 of 50 registrations committed with Kafka unreachable for 20 s; all 50 outbox rows stayed pending (all retried and failed with ECONNREFUSED) and no notification was stored. After the proxy was enabled the outbox emptied in 13.0 s; the topic held 50 messages with 50 distinct ids and the notification service stored exactly 50 notifications from 50 distinct messages. |
| Status | Pass |
| Remarks | Automated (load and chaos run in CI) · Commit: faf5ebc · Evidence: `chaos/experiments/02-broker-outage.test.ts` › Experiment 2: a broker outage loses no notifications › registrations commit during the outage, and after it every message is published and notified exactly once (EN-20-T2), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
