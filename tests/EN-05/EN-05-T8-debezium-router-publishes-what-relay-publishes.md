# EN-05-T8 — Debezium Server's outbox router puts the same message on Kafka as the polling relay does, for every message type

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-05-T8 |
| Test Scenario | Debezium Server's outbox router puts the same message on Kafka as the polling relay does, for every message type |
| Pre-conditions | 1. In the CI job: a throwaway Postgres with `wal_level=logical`, built from every migration; a single-node Redpanda; Debezium Server started with the component's `application.properties`.<br>2. Never the team's Supabase project. |
| Test Steps | 1. For every message type, build the example CloudEvent from `contracts` and insert it into the outbox table of its module in one transaction, with the topic and key the module's writer would use.<br>2. Read the topic with a Kafka consumer.<br>3. Compute what the relay would publish for the same row with `prepareRow`.<br>4. Compare topic, key, value and the `content-type` header, row by row. Debezium Server can only write a header value as a JSON string, so the header is compared after its quotes are removed.<br>5. Insert a row whose data holds an empty array and a null.<br>6. Mark an inserted row as published with an update. |
| Test Data | One example message per type from `contracts`, including the ones with empty arrays and null values. |
| Expected Result | For every row the topic, the key, the JSON value and the content-type header (once unwrapped) equal the relay's, and each message passes `parseCloudEvent`. Messages about one event arrive in insert order. Step 6 produces no message. A difference fails the job and names the message type. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Debezium Server 3.7.0.Final, started with deploy/k8s/components/cdc/application.properties in a read-only, non-root container with all capabilities dropped, published 72 messages (a full and a minimal shape of every message type, nulls and empty arrays included, across the four planning-core outboxes and the registration service's) that were identical to the relay's: same topic, same key, and a value that equals prepareRow's as a JSON document and passes parseCloudEvent. Five messages about one event arrived in the order written. An UPDATE of an outbox row published nothing. The content-type header arrived as the JSON string "application/cloudevents+json; charset=UTF-8" with the quotes, which the check unwraps and notes. |
| Status | Pass |
| Remarks | Automated (CI job, Postgres, Redpanda and Debezium Server containers; never Supabase) · Commit: 379c576 · Evidence: backend/scripts/cdc-parity-check.ts, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41636336928 job "Schema registry and CDC (Redpanda, Debezium Server)" step "Debezium Server must publish what the relay publishes, for every message type": "Debezium Server published 72 messages identical to the relay's, in order." · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
