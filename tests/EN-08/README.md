# EN-08 — OpenTelemetry and Grafana

EN-08 is an enabler, so it has no screens. Its cards check that the three services emit traces, metrics and
correlation ids, and that a trace follows one approval from the HTTP request to the notification it raises.
Cards T1 to T10 run as vitest commands with no database, Kafka broker or Grafana account. T11 needs the
throwaway Postgres CI builds. T12 needs a Grafana Cloud stack, which Joash creates.

| Jira criterion | Cards |
|---|---|
| Services are instrumented: HTTP/Express, postgres.js, kafkajs | T1 (HTTP), T2 (postgres.js), T3 (kafkajs producer), T4 and T5 (kafkajs consumers) |
| The W3C `traceparent` is carried in Kafka message headers, so a trace continues into notification and registration | T3, T4, T5 |
| The correlation id is the trace id | T6, T7 |
| A Grafana trace shows one approval (D4, POST approve) end to end | T11 (the span tree, in CI), T12 (Grafana itself) |
| Design: exported only through the standard `OTEL_*` variables, a no-op without them | T8, T9 |
| Design: the metrics are the ones EN-17's SLOs and EN-16's canary query | T10 |

| Area | Card | Latest result |
|---|---|---|
| HTTP server span | EN-08-T1 | Not Executed |
| postgres.js spans | EN-08-T2 | Not Executed |
| Kafka producer and the relay | EN-08-T3 | Not Executed |
| Notification consumer | EN-08-T4 | Not Executed |
| Registration consumer | EN-08-T5 | Not Executed |
| Correlation id is the trace id | EN-08-T6 | Not Executed |
| Logs carry the trace id | EN-08-T7 | Not Executed |
| No-op without an endpoint | EN-08-T8 | Not Executed |
| Standard OTEL_* variables | EN-08-T9 | Not Executed |
| Metric names | EN-08-T10 | Not Executed |
| D4 approval, end to end (CI) | EN-08-T11 | Not Executed |
| Grafana shows the trace | EN-08-T12 | Not Executed |

**Not covered, on purpose.**
- **Grafana itself (T12).** No Grafana Cloud stack exists yet. The trace is proven in CI against the SDK's in-memory
  exporter and over OTLP to a local receiver (T9); the screenshot follows once the account does.
- **OpenTelemetry's Express and kafkajs instrumentation packages.** Both hook `require`, which the services' ESM `import`
  of CommonJS packages bypasses, and the relay publishes batches whose messages belong to different traces. The server
  span is named from the route instead, and Kafka publish and consume are wrapped by hand (see `documentation/observability.md`).
- **Temporal workflows and activities.** ADR-0013 names Temporal; the Jira criterion does not.
- **Logs to Loki.** Log lines carry the trace id; they are not yet exported over OTLP.
