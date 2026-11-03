# AvailabilityBurnSlow: Availability: slow burn (warning)

Alert rule: `observability/prometheus/rules/alerts.yml`. SLO definitions: `documentation/slos.md`.

## Symptoms

A service is returning 5xx errors at 6 times the 0.1% budget or more over both 6h and 30m. It is not an outage, but the monthly 99.9% objective will be missed if it continues.

## First checks

1. Read the `service` label, then use the dashboard's "5xx rate by route" panel to find the route.
2. Read a sample of its error logs. A single bad input pattern (a client retrying a malformed request) is common.
3. Check whether the 5xx are really ours: a 5xx the service returns on purpose for an upstream failure still counts against us.

## Mitigation

- Ticket it the same day with the route and an example `correlationId`.
- Fix the cause; a request that should be a 4xx (bad input) must not be a 5xx.
- If it is a dependency flapping, add the dependency to the service's readiness story and say so in the ticket.

## Escalation

1. Page the service owner: the author of the last change to the service (`git log -5 --format='%an %s' -- <service dir>`).
2. If nobody answers in 15 minutes, or the alert is critical and still firing after your first mitigation, escalate to Joash (observability owner) and the Scrum Master.
3. Write what you saw and did in the team channel as you go: the next person starts from your notes.

## Dashboards

- [slo-availability.json](../../observability/grafana/dashboards/slo-availability.json) (`observability/grafana/dashboards/slo-availability.json`)
- SLO write-up: `documentation/slos.md`
