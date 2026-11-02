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
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
