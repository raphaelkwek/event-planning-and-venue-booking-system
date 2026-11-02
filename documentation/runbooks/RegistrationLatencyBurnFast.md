# RegistrationLatencyBurnFast: Registration latency: fast burn (critical)

Alert rule: `observability/prometheus/rules/alerts.yml`. SLO definitions: `documentation/slos.md`.

## Symptoms

Registration requests are slower than 800 ms for most callers, for at least the last hour and still now (both the 1h and 5m windows are over 14.4 times the budget). Attendees see slow or timing-out registration. At this rate 2% of the 30-day budget goes in an hour.

## First checks

1. Open the dashboard below. Is the burn rate high on every window, or only the short ones? Only the short ones means it is already recovering.
2. Find the slow route: the "Slowest routes" panel, or `histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket{service="registration"}[5m])))`.
3. Check the database: `curl -s http://registration:8092/readyz`. A 503 or `database: unreachable` means the pooler or Supabase is the cause, not the code.
4. Check for a deploy in the last hour (`git log --since='2 hours ago' --oneline`). A regression usually starts at a deploy.
5. Check the request rate. Registration's objective is stated at 500 req/s, so a latency burn at a much higher rate is a capacity problem rather than a bug.

## Mitigation

- Roll back the last deploy of registration-service if one lines up with the start.
- If the database is the cause, check long-running queries and lock waits on `registration.seats` (the claim uses `FOR UPDATE SKIP LOCKED`, so waits there are unexpected and worth a note).
- If load is far above 500 req/s, scale the service out (it is stateless) before anything else.
- Do not widen the SLO to silence the alert.

## Escalation

1. Page the service owner: the author of the last change to the service (`git log -5 --format='%an %s' -- <service dir>`).
2. If nobody answers in 15 minutes, or the alert is critical and still firing after your first mitigation, escalate to Joash (observability owner) and the Scrum Master.
3. Write what you saw and did in the team channel as you go: the next person starts from your notes.

## Dashboards

- [slo-registration.json](../../observability/grafana/dashboards/slo-registration.json) (`observability/grafana/dashboards/slo-registration.json`)
- SLO write-up: `documentation/slos.md`
