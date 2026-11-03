# ServiceMetricsMissing: Service metrics missing (warning)

Alert rule: `observability/prometheus/rules/alerts.yml`. SLO definitions: `documentation/slos.md`.

## Symptoms

Prometheus has failed to scrape a ConnectSphere service for 5 minutes (`up` is 0 for the job in the alert's `job` label). The service may be down, or only `/metrics` may be unreachable. Every SLO for that service is blind until this is fixed.

## First checks

1. Is the service itself up? `curl -s http://<host>:<port>/healthz`.
2. If it is up, test `/metrics` with the token: `curl -si -H "Authorization: Bearer $METRICS_TOKEN" http://<host>:<port>/metrics`. 401 means Prometheus has the wrong token; 404 in production means `METRICS_TOKEN` is not set on the service; 429 means a second scraper is sharing the address (the limit is 30 a minute).
3. Check the target in the Prometheus UI (`/targets`) for the exact scrape error.

## Mitigation

- Service down: restart it and see AvailabilityBurnFast.
- Wrong or missing token: set `METRICS_TOKEN` on the service and the same value in Prometheus's credentials file.
- Never open `/metrics` to the public to make the alert go away; fix the credentials.

## Escalation

1. Page the service owner: the author of the last change to the service (`git log -5 --format='%an %s' -- <service dir>`).
2. If nobody answers in 15 minutes, or the alert is critical and still firing after your first mitigation, escalate to Joash (observability owner) and the Scrum Master.
3. Write what you saw and did in the team channel as you go: the next person starts from your notes.

## Dashboards

- [slo-availability.json](../../observability/grafana/dashboards/slo-availability.json) (`observability/grafana/dashboards/slo-availability.json`)
- SLO write-up: `documentation/slos.md`
