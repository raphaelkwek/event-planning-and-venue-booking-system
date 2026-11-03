# AvailabilityBurnFast: Availability: fast burn (critical)

Alert rule: `observability/prometheus/rules/alerts.yml`. SLO definitions: `documentation/slos.md`.

## Symptoms

A service is answering with 5xx errors at 14.4 times the 0.1% budget or more over both 1h and 5m. The alert's `service` label says which of planning-core, registration or notification. Users see errors.

## First checks

1. Read the `service` label on the alert, then open the dashboard and find that service's 5xx rate by route.
2. `curl -s http://<service>:<port>/readyz`. `not_ready` with `database: unreachable` means the database or pooler is the cause.
3. Check the logs for `outcome: "error"` lines and take one `correlationId` through the request.
4. Check for a deploy or a config change in the last hour.
5. Check dependencies: Supabase Auth (JWKS fetch fails make every authenticated call fail), Kafka (should not cause 5xx), Temporal.

## Mitigation

- Roll back the last deploy if it lines up with the start.
- If the database is down, nothing in the service will fix it: escalate to whoever owns the Supabase project.
- If one route is failing, and it is not critical, a temporary refusal at the gateway is better than a flood of 5xx. Record that you did it.
- After recovery, keep the alert's burn-rate panel open for 30 minutes before closing the incident.

## Escalation

1. Page the service owner: the author of the last change to the service (`git log -5 --format='%an %s' -- <service dir>`).
2. If nobody answers in 15 minutes, or the alert is critical and still firing after your first mitigation, escalate to Joash (observability owner) and the Scrum Master.
3. Write what you saw and did in the team channel as you go: the next person starts from your notes.

## Dashboards

- [slo-availability.json](../../observability/grafana/dashboards/slo-availability.json) (`observability/grafana/dashboards/slo-availability.json`)
- SLO write-up: `documentation/slos.md`
