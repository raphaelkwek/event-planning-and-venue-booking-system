# RegistrationLatencyBurnSlow: Registration latency: slow burn (warning)

Alert rule: `observability/prometheus/rules/alerts.yml`. SLO definitions: `documentation/slos.md`.

## Symptoms

Registration is slower than 800 ms for a steady share of requests (6 times the budget or more over both 6h and 30m). Nobody is blocked yet, but at this rate 5% of the 30-day budget goes in six hours.

## First checks

1. Open the dashboard below. Is the burn rate high on every window, or only the short ones? Only the short ones means it is already recovering.
2. Find the slow route: the "Slowest routes" panel, or `histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket{service="registration"}[5m])))`.
3. Check the database: `curl -s http://registration:8092/readyz`. A 503 or `database: unreachable` means the pooler or Supabase is the cause, not the code.
4. Check for a deploy in the last hour (`git log --since='2 hours ago' --oneline`). A regression usually starts at a deploy.
5. Check the request rate. Registration's objective is stated at 500 req/s, so a latency burn at a much higher rate is a capacity problem rather than a bug.

## Mitigation

- File a ticket the same day and look at the slowest route and its query plan (`EXPLAIN (ANALYZE, BUFFERS)` against a copy, never the shared database).
- If it began with a deploy, plan the fix or the rollback for the next working day.
- Watch the fast-burn alert: a slow burn that doubles becomes one.

## Escalation

1. Page the service owner: the author of the last change to the service (`git log -5 --format='%an %s' -- <service dir>`).
2. If nobody answers in 15 minutes, or the alert is critical and still firing after your first mitigation, escalate to Joash (observability owner) and the Scrum Master.
3. Write what you saw and did in the team channel as you go: the next person starts from your notes.

## Dashboards

- [slo-registration.json](../../observability/grafana/dashboards/slo-registration.json) (`observability/grafana/dashboards/slo-registration.json`)
- SLO write-up: `documentation/slos.md`
