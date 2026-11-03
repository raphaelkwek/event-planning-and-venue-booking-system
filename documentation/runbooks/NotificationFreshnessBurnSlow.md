# NotificationFreshnessBurnSlow: Notification freshness: slow burn (warning)

Alert rule: `observability/prometheus/rules/alerts.yml`. SLO definitions: `documentation/slos.md`.

## Symptoms

A steady share of notifications are visible later than 10 s after the originating commit (6 times the budget or more over 6h and 30m).

## First checks

1. Open the dashboard. Look at p50 and p99 lag: a high p99 with a normal p50 points at retries; both high points at a slow consumer or relay.
2. Count retried messages in the notification logs over the last day.
3. Check the outbox relay interval in planning-core. The lag includes the time a row waits for the relay's next pass.
4. Check database latency for `notification.notifications` inserts.

## Mitigation

- Ticket it the same day.
- If retries dominate, find the failing insert (the logged error is on the retry header) and fix it.
- If the relay interval dominates, shorten it; it is a setting, not a code change.

## Escalation

1. Page the service owner: the author of the last change to the service (`git log -5 --format='%an %s' -- <service dir>`).
2. If nobody answers in 15 minutes, or the alert is critical and still firing after your first mitigation, escalate to Joash (observability owner) and the Scrum Master.
3. Write what you saw and did in the team channel as you go: the next person starts from your notes.

## Dashboards

- [slo-notification-freshness.json](../../observability/grafana/dashboards/slo-notification-freshness.json) (`observability/grafana/dashboards/slo-notification-freshness.json`)
- SLO write-up: `documentation/slos.md`
