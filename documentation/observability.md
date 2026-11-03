# Observability: traces, metrics and correlation ids (EN-08)

**Author:** Joash · **Date:** 2026-11-03 · **Jira:** EN-08 (SPM-126) · **Decision:** [ADR-0013](adr/0013-opentelemetry-and-slos.md) · **Cards:** `tests/EN-08/`

planning-core, notification and registration are instrumented with OpenTelemetry. One approval (D4) is one
trace from the HTTP request, through the database transaction and the Kafka message, into the notification
service. The correlation id in the response header, the logs and the message is that trace's id.

Nothing needs to be set up to use the correlation ids and the `traceparent` headers. Sending traces and metrics to
Grafana needs an account and three environment variables.

## What is instrumented

| What | How | Where |
|---|---|---|
| HTTP server requests | `@opentelemetry/instrumentation-http` makes the SERVER span and continues an incoming `traceparent`. `httpTelemetry` renames it after the Express route (`POST /api/v1/events/:id/approve`), sets `http.route`, and records the HTTP metrics. Health probes (`/healthz`, `/readyz`, `/metrics`) are not traced, but they are counted in `http_requests_total` under their own routes (EN-17's SLIs exclude those routes). | `backend/packages/telemetry/src/http.ts`, `sdk.ts` |
| postgres.js | `instrumentSql` wraps the pool in a Proxy. Each query that runs inside a span becomes a CLIENT span named for its operation and table (`INSERT event.outbox`); each `sql.begin` becomes a `db.transaction` span with the queries as children. The statement is recorded with `$1` where a value was, never the value. | `backend/packages/telemetry/src/postgres.ts`; applied in each service's `db.ts` |
| Kafka publish | `withProducerSpans` gives each message its own PRODUCER span and puts that span's `traceparent` in the message's header. Each outbox relay (planning-core's and registration's) continues the trace in the outbox row's `traceparent`, so the span is a child of the transaction that wrote the row. | `backend/packages/telemetry/src/kafka.ts`; `shared/outbox-relay.ts` |
| Kafka consume | `withConsumerSpan` handles each message in a CONSUMER span that is a child of the span in the `traceparent` header (the CloudEvent's own `traceparent` if the header is absent). The notification service's retry and dead-letter publishes are PRODUCER spans under it. | notification `consumer/consumeTraced.ts` and `run.ts`; registration `consumer/run.ts` (seat-builder and event-listings) and `outbox/relay.ts`; the Temporal worker's `temporal/run*Consumer.ts` |
| Correlation id | The active trace id, on the response as `x-correlation-id`, in each log line written inside a span (a request or a consumed message), and in each outbox message as `correlationid`. | `httpTelemetry`; `withTraceFields` in each logger |

The SDK starts in each service's `telemetry.ts` (`shared/telemetry.ts` in planning-core), which `src/index.ts`
imports first, because the HTTP instrumentation patches `http` as it loads.

## Running with no Grafana (the default)

With no `OTEL_EXPORTER_OTLP_ENDPOINT` the SDK exports nothing, opens no connection and prints nothing. It is still
installed, so a laptop gets the same correlation ids, `traceId` in its logs and `traceparent` headers on Kafka
messages as production; the spans themselves are discarded. `OTEL_SDK_DISABLED=true` installs nothing at all: the
correlation id is then the caller's `x-correlation-id` or a UUID, as it was before EN-08.

## Pointing at Grafana Cloud's free tier

Joash creates the account; the steps are the same for anyone.

1. Create a free Grafana Cloud stack at grafana.com. The free tier includes traces, metrics and logs with a monthly
   allowance and short retention (check Grafana's pricing page for today's numbers); a demo needs a small part of it.
2. In the stack's page open **OpenTelemetry** (Configure). It shows the **OTLP endpoint** (like
   `https://otlp-gateway-prod-<region>.grafana.net/otlp`) and the **instance ID**, and lets you create an **access
   token** with the permissions to write metrics and traces.
3. Base64-encode `<instance ID>:<token>` and put these in your private `.env` (it is not committed; `.env.example`
   lists the names without values):

   ```bash
   OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-<region>.grafana.net/otlp
   OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic%20<base64 of instanceID:token>
   OTEL_RESOURCE_ATTRIBUTES=deployment.environment=dev-joash
   ```

   Leave `OTEL_SERVICE_NAME` unset on a laptop: all three services read the same `.env`, and each names itself
   (`planning-core`, `notification`, `registration`). In a deployment, where each service has its own environment, set it
   per service. Never put the token in git, Jira or the team channel.
4. `npm run dev`. Each service logs nothing extra; traces and metrics arrive within about a minute.
5. Approve an event as a coordinator. The response's `x-correlation-id` header (browser developer tools, Network) is the
   trace id. In Grafana open **Explore**, choose the **Tempo** data source, pick the **TraceID** query type, and paste it.

The exporters send OTLP over HTTP with protobuf bodies and nothing else: `OTEL_EXPORTER_OTLP_PROTOCOL` is ignored (Grafana
Cloud takes `http/protobuf`, so nothing needs changing). The standard variables work as documented by OpenTelemetry:
`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` and `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` for a signal of its own,
`OTEL_TRACES_EXPORTER=none` or `OTEL_METRICS_EXPORTER=none` to switch one off, and `OTEL_TRACES_SAMPLER` with
`OTEL_TRACES_SAMPLER_ARG` to sample. Nothing else configures export.

**Sampling.** By default every trace is kept, which suits a demo. For a longer-running environment set
`OTEL_TRACES_SAMPLER=parentbased_traceidratio` and `OTEL_TRACES_SAMPLER_ARG=0.1` to keep a tenth of new traces. Because
the sampler is parent-based, a request that arrives with a `traceparent` follows that header's sampled flag (below).

**An incoming `traceparent` is trusted.** The server continues whatever `traceparent` a request carries, so a caller can
choose the trace id (and therefore the correlation id) and can force a trace to be kept with the sampled flag. The id is
validated as 32 hex characters, so it cannot inject anything into a log line or a header, but it identifies nothing and
authorises nothing: never use a correlation id as proof of who made a request. A trace id a caller reuses joins that
caller's requests into one trace, which is what the header is for. If the cost of forced sampling matters, the gateway
(EN-12) is where an untrusted caller's `traceparent` should be dropped; until then use `OTEL_TRACES_SAMPLER=traceidratio`,
which ignores the incoming flag.

## What the D4 trace looks like

`tests/EN-08/EN-08-T11` (`backend/services/planning-core/tests/shared/d4Trace.test.ts`) approves an event against the
real database and asserts this tree in CI. The screenshot from Grafana (card T12) goes in `documentation/evidence/EN-08/`
once the account exists.

```
POST /api/v1/events/:id/approve                  planning-core   SERVER   http.route, http.response.status_code
  SELECT event.events                            planning-core   CLIENT   the scope check
  db.transaction                                 planning-core   CLIENT
    SELECT event.events                          the scope again, under the row lock
    WITH event.events                            the conditional status update (F1)
    INSERT event.event_history
    INSERT event.outbox                          once for each message the approval writes
    connectsphere.event.v1 publish               planning-core   PRODUCER the outbox relay, up to a second later
      connectsphere.event.v1 process             notification    CONSUMER traceparent header from the producer span
        db.transaction                           notification    CLIENT
          INSERT notification.consumed_messages
          INSERT notification.notifications
```

That tree is what CI printed for `d4Trace.test.ts` (the two `INSERT event.outbox` lines are two messages).

An approval of a venue booking (M1) is the same shape ending in `connectsphere.venue-booking.v1 process` from the
`registration` service, where the seats are built.

## Metrics

Exported over OTLP, with the names and labels that EN-17's SLO rules (`documentation/slos.md`) and EN-16's canary
analysis (`deploy/k8s/analysis/error-rate-and-p95.yaml`) query:

| Metric | Labels | Notes |
|---|---|---|
| `http_request_duration_seconds` (histogram) | `service`, `method`, `route`, `status` | `route` is the pattern, `unmatched` if none matched; `status` is the class: `2xx`, `3xx`, `4xx` or `5xx`. Buckets include 0.4 and 0.8, the objectives. |
| `http_requests_total` (counter) | same | |
| `kafka_consumer_processing_duration_seconds` (histogram) | `topic`, `group`, `outcome` | `outcome` is the handler's result: `stored`, `duplicate`, `ignored`, `retried`, `dead-lettered` (notification), `built`, `applied` (registration), `scheduled` (Temporal worker), `invalid`, or `error` when the handler threw. |
| `kafka_consumer_lag_seconds` (histogram) | `topic`, `group` | The broker's timestamp to the start of handling. For the notification retry worker it counts from when the retry was due (its `connectsphere-not-before` header), because the back-off is deliberate waiting, not lag. |
| `kafka_messages_published_total` (counter) | `topic`, `result` | |

**Two metric paths, one name.** EN-17 (#78, merged) serves the HTTP series from a Prometheus `/metrics` endpoint, which is
what the in-cluster Prometheus scrapes for the canary analysis and the burn-rate alerts. This work sends the same series
over OTLP to Grafana Cloud. The names, labels and buckets are identical to the ones in EN-17's recording rules, alerts
and dashboards (`observability/`) and EN-16's canary analysis, so a query reads the same either way; EN-17's
`notification_visibility_lag_seconds` and over-admission gauges are not duplicated here. Both middlewares run in each app
and record independently. Do not feed both into one data source or every request is counted twice: either scrape
`/metrics`, or set `OTEL_METRICS_EXPORTER=none` and keep OTLP for traces. The `pod` label EN-16's queries filter on comes
from the Prometheus scrape (pod discovery), not from OTLP.

## Logs

Logs stay structured JSON on standard output (implementation.md §9). Inside a request or a consumed message each line
carries `traceId` and `spanId`, and `correlationId` is the trace id, so the lines of one request are the lines that
contain the id shown in its trace (and in its `x-correlation-id` response header). Shipping them to Loki, so that Grafana
shows them next to the trace, is not built (below).

## What this does not do

- **OpenTelemetry's Express package is not used.** It hooks `require`, which an ESM `import` of CommonJS `express`
  bypasses unless node is started with a loader flag. The server span is named from the route instead, so the trace has
  no per-middleware spans.
- **kafkajs is not patched.** The relay publishes a batch whose messages belong to different traces, which a patch of
  `producer.send` cannot split; the wrappers in `kafka.ts` are explicit instead. A new consumer or producer must call
  them (ADR-0013: "a new service or consumer that doesn't propagate trace context" is what a reviewer watches for).
- **Not traced:** Temporal workflows and activities (the worker's Kafka consumers are, and its process reports as
  `planning-core-worker`), the browser, and `fetch` calls (notification's call to `GET /api/v1/users/me` sends no
  `traceparent`).
- **Logs are not exported over OTLP** (no Loki yet), only written to standard output with the trace id.
- **Background work with no request** (the outbox relay's polling, the readiness probe, the completion sweep) makes no
  database spans; a query is traced only inside a span.
- **Container images (EN-10).** The shared packages are compiled in each service's Dockerfile by an explicit list;
  `@connectsphere/telemetry` is in it. A new shared package must be added there too, or the image will not build.
