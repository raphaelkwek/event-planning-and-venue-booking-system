# Service level objectives (EN-17)

**Author:** Joash · **Date:** 2026-11-02 · **Jira:** EN-17 · **Decision:** [ADR-0013](adr/0013-opentelemetry-and-slos.md)

This page writes down each objective, the SLI query that measures it, its error budget, and the alert that fires when the budget burns too fast. The rules are in `observability/prometheus/rules/`, tested in `observability/prometheus/tests/`, charted in `observability/grafana/dashboards/`, and each alert has a runbook in `documentation/runbooks/`.

## What observability existed before this work

EN-17 "needs EN-08", which Jira marks Done. The code says otherwise. On 2 Nov 2026, before this pull request:

- There was no `@opentelemetry/*` package anywhere. `backend/services/planning-core/src/shared/tracing.ts` only generates a random `traceparent` for each message.
- There were no metrics, no `/metrics` endpoint and no exporter. Logs go to standard output only (ADR-0013 sends them to Loki; that was not built).
- Only planning-core had a correlation id (`backend/services/planning-core/src/app.ts:31`). Registration and notification had none.
- The structured JSON logger exists in all three services (`backend/services/planning-core/src/shared/logger.ts:13`).

So EN-08's tracing, Tempo and Loki are still not built. To make the SLOs measurable this pull request added the **minimum** an SLI needs and nothing more:

| Added | Where |
|---|---|
| `http_request_duration_seconds` (histogram) and `http_requests_total` (counter), labelled `service`, `method`, `route` (the route pattern, never the raw URL) and `status` (`2xx`, `4xx`, `5xx`) | `backend/packages/observability/src/metrics.ts:57` |
| `GET /metrics`, rate-limited before its token check, off in production unless `METRICS_TOKEN` is set | `backend/packages/observability/src/metrics.ts:91` |
| `notification_visibility_lag_seconds` (histogram) | `backend/services/notification/src/metrics.ts:15` |
| `registration_over_admission_seats` and `registration_invariant_check_success` (gauges) | `backend/services/registration/src/overAdmission.ts:34` |

Not built, and not claimed: OpenTelemetry tracing, Grafana Tempo and Loki, a Prometheus or Grafana server, Alertmanager routing. The rules, the Prometheus config and the dashboards are validated in CI (`promtool` from the `prom/prometheus` image, a JSON check, a runbook check). Nothing was deployed and no alert has fired in a real environment.

## The objectives

All windows are 30 days. A **burn rate** of 1 spends the budget exactly over the window. Alerts follow the Google SRE Workbook's multi-window, multi-burn-rate pattern (chapter 5): the **fast** alert needs both the 1 hour and 5 minute windows over 14.4 times the budget (2% of the budget in an hour; severity critical), the **slow** alert needs both the 6 hour and 30 minute windows over 6 times the budget (5% in six hours; severity warning). The short window stops an alert that has already recovered from firing.

| # | Objective | SLI (the bad share of events) | Error budget | Alerts |
|---|---|---|---|---|
| 1 | Registration p95 at most 800 ms, at 500 req/s | Registration requests slower than 800 ms | 5% of requests | `RegistrationLatencyBurnFast`, `RegistrationLatencyBurnSlow` |
| 2 | Zero over-admission | `registration_over_admission_seats` above 0 | None: any violation pages | `RegistrationOverAdmission`, `RegistrationInvariantCheckFailing` |
| 3 | Staff API p95 at most 400 ms for reads and 800 ms for writes, at 300 users | Staff requests slower than their objective | 5% of requests | `StaffApiLatencyBurnFast`, `StaffApiLatencyBurnSlow` |
| 4 | 99% of notifications visible within 10 s of the commit | Notifications that took longer than 10 s | 1% of notifications | `NotificationFreshnessBurnFast`, `NotificationFreshnessBurnSlow` |
| 5 | 99.9% availability | Requests answered with a 5xx, per service | 0.1% of requests (43.2 minutes of full outage a month) | `AvailabilityBurnFast`, `AvailabilityBurnSlow`, `ServiceMetricsMissing` |

The brief says "notification freshness within 10 s"; ADR-0013 sets the share at 99%, which is what the budget uses.

Burn-rate thresholds follow from the budget: for objective 1 the fast alert fires when more than 72% of requests are slow (14.4 times 5%), the slow alert at 30%. For objective 5 the fast alert fires at a 1.44% error share and the slow alert at 0.6%. A 5% budget makes the latency alerts blunt on purpose: they catch an outage, not a drift. The p95 panels on the dashboards show the drift.

### 1. Registration latency

- **Good event:** a registration-service request (any route except `/healthz`, `/readyz`, `/metrics` and unmatched paths) that finished within 0.8 s.
- **SLI query** (recording rule `sli:registration_latency_slow:ratio_rate5m`, also `30m`, `1h`, `6h`):

```promql
1 - (
  sum(rate(http_request_duration_seconds_bucket{service="registration",route!~"/healthz|/readyz|/metrics|unmatched",le="0.8"}[5m]))
  /
  sum(rate(http_request_duration_seconds_count{service="registration",route!~"/healthz|/readyz|/metrics|unmatched"}[5m]))
)
```

- **Caveats.** The "at 500 req/s" is the load the objective is stated for (EN-18 tests it); the alert fires at any load. The registration routes (R2) do not exist yet, so this SLI has no data until they ship: the dashboard is empty and the alert cannot fire.

### 2. Zero over-admission

- **SLI:** the **database invariant**, not a counter in the claim path. `registration_over_admission_seats` is evaluated on each scrape from the seat table and counts rows that break the one-seat-one-holder rule (a claimed seat with no holder; a seat number twice in a booking). `backend/services/registration/src/overAdmission.ts:20`.
- **Why not a counter.** The claim code (R2) is not merged, and a counter kept by the code that could be wrong shares its blind spot. The invariant is read from the data.
- **What it can and cannot see.** Both rows are already refused by constraints (`backend/services/registration/migrations/0001_init_registration_schema.sql:44`), so a healthy system reports 0 forever; the gauge is a canary for a constraint being dropped, left `NOT VALID` or bypassed. It does not see "more registrations than seats" because there is no registrations table yet. When R2 adds one, extend the query with registrations that hold no seat and seats with two registrations.
- **Alerts.** `RegistrationOverAdmission` fires on any value above 0, with no delay. `RegistrationInvariantCheckFailing` fires if the check cannot run for 10 minutes (`registration_invariant_check_success` is 0), because an unreadable SLI is not a zero.

### 3. Staff API latency

- **Good event:** a planning-core request that finished within 0.4 s for `GET` and `HEAD`, or within 0.8 s for any other method.
- **SLI query** (`sli:staff_api_latency_slow:ratio_rate5m` and the other windows):

```promql
1 - (
  (
    sum(rate(http_request_duration_seconds_bucket{service="planning-core",route!~"/healthz|/readyz|/metrics|unmatched",method=~"GET|HEAD",le="0.4"}[5m]))
    +
    sum(rate(http_request_duration_seconds_bucket{service="planning-core",route!~"/healthz|/readyz|/metrics|unmatched",method!~"GET|HEAD",le="0.8"}[5m]))
  )
  /
  sum(rate(http_request_duration_seconds_count{service="planning-core",route!~"/healthz|/readyz|/metrics|unmatched"}[5m]))
)
```

- **Caveat.** The objective is stated at 300 users; the alert does not know the load.

### 4. Notification freshness

- **Good event:** a notification that became visible within 10 s of the originating commit.
- **How it is measured.** When the consumer commits a notification, it observes the seconds since the CloudEvent's `time` (the moment the originating change committed) in `notification_visibility_lag_seconds` (`backend/services/notification/src/metrics.ts:23`). A duplicate message records nothing. A producer clock ahead of the consumer's counts as 0.
- **SLI query** (`sli:notification_freshness_late:ratio_rate5m` and the other windows):

```promql
1 - (
  sum(rate(notification_visibility_lag_seconds_bucket{service="notification",le="10"}[5m]))
  /
  sum(rate(notification_visibility_lag_seconds_count{service="notification"}[5m]))
)
```

- **Caveat.** It measures notifications that arrive. If the pipeline stops, no observation is made and the ratio has no data; the dashboard's stored rate falls to zero and `ServiceMetricsMissing` covers a service that cannot be scraped. A "no notifications at all for N minutes" alert needs a traffic baseline and is a follow-up.

### 5. Availability

- **Good event:** a request not answered with a 5xx. 4xx refusals are correct behaviour and do not count against the budget.
- **SLI query** (`sli:availability_errors:ratio_rate5m` and the other windows), one series per service:

```promql
sum by (service) (rate(http_requests_total{route!~"/healthz|/readyz|/metrics|unmatched",status="5xx"}[5m]))
/
sum by (service) (rate(http_requests_total{route!~"/healthz|/readyz|/metrics|unmatched"}[5m]))
```

- **Caveat.** The measure is what the service answered, not what a user saw: it cannot see a service that is down, a request that never arrived, or the gateway. A probe from outside (a blackbox exporter) is the follow-up once there is a deployment.
- **`ServiceMetricsMissing`** fires when Prometheus cannot scrape a service for 5 minutes, because every SLO for it is then blind.

## Running and checking it

```bash
# Unit tests for the instrumentation and the rule files' companion checks
npm run test:unit
npx tsx --test documentation/scripts/check-observability.test.ts

# Rules and alert tests (promtool 2.55 or newer; CI uses the prom/prometheus image)
promtool check rules observability/prometheus/rules/*.yml
promtool check config --syntax-only observability/prometheus/prometheus.yml
(cd observability/prometheus/tests && promtool test rules *.test.yml)
```

The test files feed synthetic series to each alert group and assert, at chosen times, that the alert fires, or stays quiet, in these cases: a total outage (both alerts fire); a steady 8-times burn (slow only); half the budget spent steadily (nothing); a burst that has recovered (the fast alert has stopped). The over-admission, invariant-check and target-down alerts have their own file. A mutation check was run by hand: raising the availability thresholds made the tests fail.

The generated files (`rules/*.yml`, `tests/*.yml`, the dashboards and runbooks) were produced by small scripts and are committed as plain files; edit them directly.

## Pointing Prometheus at the services

`observability/prometheus/prometheus.yml` scrapes `planning-core:8090`, `notification:8091` and `registration:8092` every 15 seconds with a bearer token from a credentials file. Set the same `METRICS_TOKEN` on each service. `/metrics` is rate-limited to 30 requests a minute per address, is not under `/api/v1`, and must not be routed through the gateway.
