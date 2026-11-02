# StaffApiLatencyBurnFast: Staff API latency: fast burn (critical)

Alert rule: `observability/prometheus/rules/alerts.yml`. SLO definitions: `documentation/slos.md`.

## Symptoms

Staff screens are slow: reads over 400 ms or writes over 800 ms for most requests, now and for the last hour. Coordinators and venue staff report spinners or timeouts.

## First checks

1. Open the dashboard below. Is the burn rate high on every window, or only the short ones? Only the short ones means it is already recovering.
2. Find the slow route: the "Slowest routes" panel, or `histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket{service="planning-core"}[5m])))`.
3. Check the database: `curl -s http://planning-core:8090/readyz`. A 503 or `database: unreachable` means the pooler or Supabase is the cause, not the code.
4. Check for a deploy in the last hour (`git log --since='2 hours ago' --oneline`). A regression usually starts at a deploy.
5. Check the request rate. Registration's objective is stated at 500 req/s, so a latency burn at a much higher rate is a capacity problem rather than a bug.
6. Staff reads and writes have different objectives. The two p95 panels show which side is slow; a slow write often means a long transaction in a cross-module rule (F4, F5, S2).

## Mitigation

- Roll back the last planning-core deploy if one lines up.
- If one route dominates, check its query and the locks it takes. Do not add retries: a retry on a slow write makes it slower.
- If the database is saturated, ask whether the outbox relay or a nightly job (`jobs:complete-events`, hold expiries) is running and pause it.

## Escalation

1. Page the service owner: the author of the last change to the service (`git log -5 --format='%an %s' -- <service dir>`).
2. If nobody answers in 15 minutes, or the alert is critical and still firing after your first mitigation, escalate to Joash (observability owner) and the Scrum Master.
3. Write what you saw and did in the team channel as you go: the next person starts from your notes.

## Dashboards

- [slo-staff-api.json](../../observability/grafana/dashboards/slo-staff-api.json) (`observability/grafana/dashboards/slo-staff-api.json`)
- SLO write-up: `documentation/slos.md`
