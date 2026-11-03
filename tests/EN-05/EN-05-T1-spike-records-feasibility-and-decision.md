# EN-05-T1 — The spike answers both questions with sources, and the decision is written into ADR-0008

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-05-T1 |
| Test Scenario | The spike answers both questions with sources, and the decision is written into ADR-0008 |
| Pre-conditions | 1. The repository is checked out on the pull request's branch.<br>2. No network access is needed: the sources are links, and the findings are quoted in the document. |
| Test Steps | 1. Open `documentation/spikes/EN-05-cdc-spike.md`.<br>2. Find the answer to "does Supabase allow a logical replication slot for an external Debezium connector?" and check that it names the connection type, the IPv6 and IPv4 limits of the Free plan, and the role it needs.<br>3. Find the answer to "can our Kafka run Kafka Connect or something equivalent?" for each of Aiven's free plan, Confluent Cloud and the in-cluster Redpanda.<br>4. Find the decision, and compare it with the decision note at the end of `documentation/adr/0008-kafka-cdc-outbox-cloudevents-schema-registry.md` and with `implementation.md` §3.4. |
| Test Data | The sources linked from the spike document. |
| Expected Result | Every finding has a source link. Each question is answered separately for the development environment and for staging and production. The decision is stated once and says what is and is not built. ADR-0008 and `implementation.md` §3.4 say the same thing as the spike, and say plainly that the polling relay is still the publisher. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
