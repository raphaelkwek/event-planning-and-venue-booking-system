# StaffApiLatencyBurnSlow: Staff API latency: slow burn (warning)

Alert rule: `observability/prometheus/rules/alerts.yml`. SLO definitions: `documentation/slos.md`.

## Symptoms

A steady share of staff API requests miss their objective (reads 400 ms, writes 800 ms) at 6 times the budget or more over 6h and 30m.

## First checks

1. Open the dashboard below. Is the burn rate high on every window, or only the short ones? Only the short ones means it is already recovering.
2. Find the slow route: the "Slowest routes" panel, or `histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket{service="planning-core"}[5m])))`.
3. Check the database: `curl -s http://planning-core:8090/readyz`. A 503 or `database: unreachable` means the pooler or Supabase is the cause, not the code.
4. Check for a deploy in the last hour (`git log --since='2 hours ago' --oneline`). A regression usually starts at a deploy.
5. Check the request rate. Registration's objective is stated at 500 req/s, so a latency burn at a much higher rate is a capacity problem rather than a bug.

## Mitigation

- Ticket it the same day. Use the "Slowest routes" panel to name the route, then read its repo query.
- Check whether data growth explains it (a missing index shows up first on the biggest tables, such as event history and venue bookings).
- Re-run the load test (EN-18) against the fix and attach the result.

## Escalation

1. Page the service owner: the author of the last change to the service (`git log -5 --format='%an %s' -- <service dir>`).
2. If nobody answers in 15 minutes, or the alert is critical and still firing after your first mitigation, escalate to Joash (observability owner) and the Scrum Master.
3. Write what you saw and did in the team channel as you go: the next person starts from your notes.

## Dashboards

- [slo-staff-api.json](../../observability/grafana/dashboards/slo-staff-api.json) (`observability/grafana/dashboards/slo-staff-api.json`)
- SLO write-up: `documentation/slos.md`
