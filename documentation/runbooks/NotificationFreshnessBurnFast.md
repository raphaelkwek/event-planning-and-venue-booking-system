# NotificationFreshnessBurnFast: Notification freshness: fast burn (critical)

Alert rule: `observability/prometheus/rules/alerts.yml`. SLO definitions: `documentation/slos.md`.

## Symptoms

Notifications are taking longer than 10 s to appear for most changes. Organisers and coordinators are not seeing approvals, decisions or reminders when they happen. Either the pipeline is behind or it has stopped.

## First checks

1. Open the dashboard. Is the stored rate zero (the consumer is stopped) or normal with high lag (the consumer is behind)?
2. `curl -s http://notification:8091/readyz`: the `kafka` check says whether the broker is reachable. The service stays ready when the broker is down, because the outbox holds the messages.
3. In the notification logs look for `could not start the consumers` (it retries every 15 s) and for `retried` or `dead-lettered` outcomes.
4. Check the retry topic `connectsphere.notification.retry.v1` and the DLQ `connectsphere.notification.dlq.v1` for a build-up.
5. On the producer side, check the planning-core outbox relay is publishing: a growing `outbox` table with old rows means planning-core is the bottleneck, not notification.

## Mitigation

- Restart the notification service if the consumers did not start (the inbox makes a replay safe).
- If Kafka is down, nothing to do but wait and tell people: nothing is lost, the outbox is holding it.
- If a poison message is stuck, it goes to the DLQ by itself after the retry limit; read it, fix the cause, then replay it.
- Tell staff in the team channel that notifications are delayed, not lost.

## Escalation

1. Page the service owner: the author of the last change to the service (`git log -5 --format='%an %s' -- <service dir>`).
2. If nobody answers in 15 minutes, or the alert is critical and still firing after your first mitigation, escalate to Joash (observability owner) and the Scrum Master.
3. Write what you saw and did in the team channel as you go: the next person starts from your notes.

## Dashboards

- [slo-notification-freshness.json](../../observability/grafana/dashboards/slo-notification-freshness.json) (`observability/grafana/dashboards/slo-notification-freshness.json`)
- SLO write-up: `documentation/slos.md`
