# EN-05-T8 — Debezium Server's outbox router puts the same message on Kafka as the polling relay does, for every message type

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-05-T8 |
| Test Scenario | Debezium Server's outbox router puts the same message on Kafka as the polling relay does, for every message type |
| Pre-conditions | 1. In the CI job: a throwaway Postgres with `wal_level=logical`, built from every migration; a single-node Redpanda; Debezium Server started with the component's `application.properties`.<br>2. Never the team's Supabase project. |
| Test Steps | 1. For every message type, build the example CloudEvent from `contracts` and insert it into the outbox table of its module in one transaction, with the topic and key the module's writer would use.<br>2. Read the topic with a Kafka consumer.<br>3. Compute what the relay would publish for the same row with `prepareRow`.<br>4. Compare topic, key, value and the `content-type` header, row by row.<br>5. Insert a row whose data holds an empty array and a null.<br>6. Mark an inserted row as published with an update. |
| Test Data | One example message per type from `contracts`, including the ones with empty arrays and null values. |
| Expected Result | For every row the topic, the key, the JSON value and the content-type header equal the relay's, and each message passes `parseCloudEvent`. Messages about one event arrive in insert order. Step 6 produces no message. A difference fails the job and names the message type. |
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
